-- Present attendance as separate subscription periods. Historical attendance is
-- retained; each approved subscription owns its own session window and totals.

CREATE OR REPLACE FUNCTION private.list_student_attendance_subjects()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'subject', group_row.subject,
    'subscription_id', subscription.id,
    'started_at', subscription.started_at,
    'expires_at', subscription.expires_at,
    'groups', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'group_id', group_row.id,
      'group_name', group_row.name,
      'teacher_name', teacher.full_name,
      'total_sessions', stats.total_sessions,
      'present_count', stats.present_count,
      'absent_count', stats.absent_count
    ))
  ) ORDER BY group_row.subject, subscription.started_at DESC), '[]'::JSONB)
  INTO result
  FROM public.student_teacher_subscriptions AS subscription
  JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  JOIN public.profiles AS teacher ON teacher.id = subscription.teacher_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(*)::INTEGER AS total_sessions,
      pg_catalog.count(attendance.id)::INTEGER AS present_count,
      (pg_catalog.count(*) - pg_catalog.count(attendance.id))::INTEGER AS absent_count
    FROM public.class_sessions AS session
    LEFT JOIN public.class_attendance AS attendance
      ON attendance.session_id = session.id AND attendance.student_id = actor_id
      AND attendance.status IN ('PRESENT', 'LATE')
    WHERE session.group_id = group_row.id AND session.status = 'COMPLETED'
      AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
  ) AS stats
  WHERE subscription.student_id = actor_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
    AND subscription.approved_at IS NOT NULL;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_student_subscription_attendance(p_subscription_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'session_id', session.id,
    'subscription_id', subscription.id,
    'subscription_started_at', subscription.started_at,
    'subscription_expires_at', subscription.expires_at,
    'group_id', group_row.id,
    'group_name', group_row.name,
    'teacher_name', teacher.full_name,
    'subject', group_row.subject,
    'session_date', session.session_date,
    'start_time', session.start_time,
    'end_time', session.end_time,
    'status', COALESCE(attendance.status, 'ABSENT'),
    'attended_at', attendance.attended_at
  ) ORDER BY session.session_date DESC, session.start_time DESC), '[]'::JSONB)
  INTO result
  FROM public.student_teacher_subscriptions AS subscription
  JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  JOIN public.profiles AS teacher ON teacher.id = subscription.teacher_id
  JOIN public.class_sessions AS session ON session.group_id = group_row.id AND session.status = 'COMPLETED'
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = session.id AND attendance.student_id = actor_id
    AND attendance.status IN ('PRESENT', 'LATE')
  WHERE subscription.id = p_subscription_id
    AND subscription.student_id = actor_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
    AND subscription.approved_at IS NOT NULL
    AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo');
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_student_attendance(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.student_id = p_student_id AND subscription.teacher_id = actor_id
      AND subscription.approved_at IS NOT NULL
      AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
  ) THEN RAISE EXCEPTION 'Student not found for this teacher.'; END IF;

  SELECT pg_catalog.jsonb_build_object(
    'student_id', student.id,
    'student_name', student.full_name,
    'sessions', COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'session_id', session.id,
      'subscription_id', subscription.id,
      'subscription_started_at', subscription.started_at,
      'subscription_expires_at', subscription.expires_at,
      'group_id', group_row.id,
      'group_name', group_row.name,
      'subject', group_row.subject,
      'session_date', session.session_date,
      'start_time', session.start_time,
      'end_time', session.end_time,
      'status', COALESCE(attendance.status, 'ABSENT'),
      'attended_at', attendance.attended_at
    ) ORDER BY session.session_date DESC, session.start_time DESC) FILTER (WHERE session.id IS NOT NULL), '[]'::JSONB)
  ) INTO result
  FROM public.profiles AS student
  LEFT JOIN public.student_teacher_subscriptions AS subscription
    ON subscription.student_id = student.id AND subscription.teacher_id = actor_id
    AND subscription.approved_at IS NOT NULL
    AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
  LEFT JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  LEFT JOIN public.class_sessions AS session
    ON session.group_id = group_row.id AND session.status = 'COMPLETED'
    AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = session.id AND attendance.student_id = student.id
    AND attendance.status IN ('PRESENT', 'LATE')
  WHERE student.id = p_student_id
  GROUP BY student.id, student.full_name;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_subscription_attendance(p_subscription_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_student_subscription_attendance(p_subscription_id)
$$;

-- The dashboard represents the current period only. The detailed history RPCs
-- above retain and expose each completed period independently.
CREATE OR REPLACE FUNCTION private.get_student_attendance_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); total_count INTEGER; present_count INTEGER; recent_records JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT pg_catalog.count(DISTINCT session.id)::INTEGER,
    pg_catalog.count(DISTINCT attendance.id)::INTEGER
  INTO total_count, present_count
  FROM public.class_sessions AS session
  JOIN public.student_teacher_subscriptions AS subscription
    ON subscription.group_id = session.group_id AND subscription.student_id = actor_id
    AND subscription.status = 'ACTIVE'
    AND subscription.started_at <= pg_catalog.now() AND subscription.expires_at > pg_catalog.now()
    AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = session.id AND attendance.student_id = actor_id
  WHERE session.status IN ('OPEN', 'COMPLETED');

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'session_id', session.id, 'group_name', group_row.name, 'teacher_name', teacher.full_name,
    'session_date', session.session_date, 'start_time', session.start_time, 'end_time', session.end_time,
    'status', attendance.status, 'attended_at', attendance.attended_at
  ) ORDER BY attendance.attended_at DESC), '[]'::JSONB)
  INTO recent_records
  FROM (
    SELECT attendance_row.* FROM public.class_attendance AS attendance_row
    JOIN public.class_sessions AS session ON session.id = attendance_row.session_id
    WHERE attendance_row.student_id = actor_id AND EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.student_id = actor_id AND subscription.group_id = session.group_id
        AND subscription.status = 'ACTIVE'
        AND subscription.started_at <= pg_catalog.now() AND subscription.expires_at > pg_catalog.now()
        AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
        AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    )
    ORDER BY attendance_row.attended_at DESC LIMIT 20
  ) AS attendance
  JOIN public.class_sessions AS session ON session.id = attendance.session_id
  JOIN public.teacher_groups AS group_row ON group_row.id = session.group_id
  JOIN public.profiles AS teacher ON teacher.id = session.teacher_id;

  RETURN pg_catalog.jsonb_build_object(
    'total_sessions', COALESCE(total_count, 0),
    'present_sessions', COALESCE(present_count, 0),
    'attendance_percentage', CASE WHEN COALESCE(total_count, 0) = 0 THEN 0
      ELSE pg_catalog.round((present_count::NUMERIC * 100 / total_count)::NUMERIC, 0) END,
    'recent', recent_records
  );
END;
$$;

REVOKE ALL ON FUNCTION private.get_student_subscription_attendance(UUID),
  public.get_student_subscription_attendance(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_student_subscription_attendance(UUID),
  public.get_student_subscription_attendance(UUID) TO authenticated;
