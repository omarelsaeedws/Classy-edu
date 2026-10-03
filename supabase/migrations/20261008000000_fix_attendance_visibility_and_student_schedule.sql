-- Phase 06 follow-up: make persisted check-ins visible in teacher/student
-- summaries, expose subscribed weekly schedules, and report existing group
-- subscription state in student discovery.

CREATE OR REPLACE FUNCTION private.list_teacher_class_sessions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'group_name', g.name,
    'session_date', s.session_date, 'start_time', s.start_time, 'end_time', s.end_time,
    'status', s.status, 'attendance_open', s.attendance_open,
    'attendance_code_expires_at', s.attendance_code_expires_at,
    'active_students', counts.active_count,
    'present_count', (SELECT pg_catalog.count(*)::INTEGER
      FROM public.class_attendance AS a WHERE a.session_id = s.id)
  ) ORDER BY s.session_date, s.start_time), '[]'::JSONB) INTO result
  FROM public.class_sessions AS s
  JOIN public.teacher_groups AS g ON g.id = s.group_id AND g.teacher_id = actor_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(DISTINCT subscription.student_id)::INTEGER AS active_count
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.group_id = s.group_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED')
      AND subscription.started_at IS NOT NULL
      AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
  ) AS counts
  WHERE s.teacher_id = actor_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_class_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'group_name', g.name,
    'session_date', s.session_date, 'start_time', s.start_time, 'end_time', s.end_time,
    'status', s.status, 'attendance_open', s.attendance_open,
    'attendance_code', CASE WHEN s.status = 'OPEN' AND s.attendance_code_expires_at > pg_catalog.now() THEN s.attendance_code ELSE NULL END,
    'attendance_code_expires_at', s.attendance_code_expires_at,
    'opened_at', s.opened_at, 'closed_at', s.closed_at,
    'active_students', counts.active_count,
    'present_count', (SELECT pg_catalog.count(*)::INTEGER FROM public.class_attendance AS a WHERE a.session_id = s.id),
    'attendance', COALESCE(attendance_list.items, '[]'::JSONB)
  ) INTO result
  FROM public.class_sessions AS s
  JOIN public.teacher_groups AS g ON g.id = s.group_id AND g.teacher_id = actor_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(DISTINCT subscription.student_id)::INTEGER AS active_count
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.group_id = s.group_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED')
      AND subscription.started_at IS NOT NULL
      AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
  ) AS counts
  CROSS JOIN LATERAL (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', students.id,
      'student_name', students.full_name,
      'status', COALESCE(a.status, 'NOT_RECORDED'),
      'attended_at', a.attended_at
    ) ORDER BY students.full_name) AS items
    FROM (
      SELECT DISTINCT eligible.student_id AS id
      FROM public.student_teacher_subscriptions AS eligible
      WHERE eligible.group_id = s.group_id
        AND eligible.status IN ('ACTIVE', 'EXPIRED')
        AND eligible.started_at IS NOT NULL
        AND eligible.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
        AND eligible.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
      UNION
      SELECT checked_in.student_id AS id
      FROM public.class_attendance AS checked_in WHERE checked_in.session_id = s.id
    ) AS roster
    JOIN public.profiles AS students ON students.id = roster.id AND students.role = 'STUDENT'
    LEFT JOIN public.class_attendance AS a ON a.session_id = s.id AND a.student_id = students.id
  ) AS attendance_list
  WHERE s.id = p_session_id AND s.teacher_id = actor_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Session not found.'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_student_attendance_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  total_count INTEGER;
  present_count INTEGER;
  recent_records JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT pg_catalog.count(*)::INTEGER,
    pg_catalog.count(*) FILTER (WHERE attendance.id IS NOT NULL)::INTEGER
  INTO total_count, present_count
  FROM public.class_sessions AS s
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = s.id AND attendance.student_id = actor_id
  WHERE s.status IN ('OPEN', 'COMPLETED')
    AND (
      attendance.id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.student_teacher_subscriptions AS subscription
        WHERE subscription.group_id = s.group_id AND subscription.student_id = actor_id
          AND subscription.status IN ('ACTIVE', 'EXPIRED')
          AND subscription.started_at IS NOT NULL
          AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
          AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
      )
    );

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'session_id', s.id, 'group_name', g.name, 'teacher_name', teacher.full_name,
    'session_date', s.session_date, 'start_time', s.start_time, 'end_time', s.end_time,
    'status', attendance.status, 'attended_at', attendance.attended_at
  ) ORDER BY attendance.attended_at DESC), '[]'::JSONB)
  INTO recent_records
  FROM (
    SELECT * FROM public.class_attendance AS a
    WHERE a.student_id = actor_id
    ORDER BY a.attended_at DESC LIMIT 20
  ) AS attendance
  JOIN public.class_sessions AS s ON s.id = attendance.session_id
  JOIN public.teacher_groups AS g ON g.id = s.group_id
  JOIN public.profiles AS teacher ON teacher.id = s.teacher_id;

  RETURN pg_catalog.jsonb_build_object(
    'total_sessions', COALESCE(total_count, 0),
    'present_sessions', COALESCE(present_count, 0),
    'attendance_percentage', CASE WHEN COALESCE(total_count, 0) = 0 THEN 0
      ELSE pg_catalog.round((present_count::NUMERIC * 100 / total_count)::NUMERIC, 0) END,
    'recent', recent_records
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.list_student_weekly_group_schedules()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'group_id', g.id, 'group_name', g.name, 'teacher_name', teacher.full_name,
    'weekday', slot.weekday, 'start_time', slot.start_time, 'end_time', slot.end_time
  ) ORDER BY slot.weekday, slot.start_time, g.name), '[]'::JSONB)
  INTO result
  FROM public.student_teacher_subscriptions AS subscription
  JOIN public.teacher_groups AS g ON g.id = subscription.group_id AND g.status = 'ACTIVE'
  JOIN public.profiles AS teacher ON teacher.id = g.teacher_id AND teacher.role = 'TEACHER'
  JOIN public.teacher_group_schedule_slots AS slot ON slot.group_id = g.id
  WHERE subscription.student_id = actor_id
    AND subscription.status = 'ACTIVE'
    AND subscription.started_at <= pg_catalog.now()
    AND subscription.expires_at > pg_catalog.now();
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION private.list_student_weekly_group_schedules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.list_student_weekly_group_schedules() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_student_weekly_group_schedules()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.list_student_weekly_group_schedules()
$$;
REVOKE ALL ON FUNCTION public.list_student_weekly_group_schedules() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_student_weekly_group_schedules() TO authenticated;

-- Include the caller's own latest group request status in the existing safe
-- student directory payload. No other student's subscription data is returned.
CREATE OR REPLACE FUNCTION public.list_student_teachers(
  p_stage TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  teacher_id UUID, full_name TEXT, avatar_path TEXT, subjects TEXT[],
  teaching_area TEXT, teaching_address TEXT, lesson_title TEXT, bio TEXT,
  monthly_price NUMERIC, groups JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS student
    WHERE student.id = actor_id AND student.role = 'STUDENT'
      AND student.profile_setup_completed AND student.onboarding_completed
      AND student.stage IS NOT NULL AND student.grade IS NOT NULL
  ) THEN RAISE EXCEPTION 'A completed student profile is required.'; END IF;

  RETURN QUERY
  WITH student_context AS (
    SELECT p.stage, p.grade FROM public.profiles AS p WHERE p.id = actor_id
  ), eligible_groups AS (
    SELECT teacher.id AS teacher_id, teacher.full_name,
      teacher.avatar_url AS avatar_path, tp.subjects, tp.teaching_area,
      tp.teaching_address, tp.lesson_title, tp.bio, tp.monthly_price,
      g.name AS group_name, g.created_at AS group_created_at,
      pg_catalog.jsonb_build_object(
        'id', g.id, 'name', g.name, 'subject', g.subject,
        'educational_stage', g.educational_stage, 'grade', g.grade,
        'max_students', g.max_students, 'active_students', counts.active_count,
        'available_seats', GREATEST(g.max_students - counts.active_count, 0),
        'my_subscription_status', mine.status,
        'schedule', COALESCE(schedule.slots, '[]'::JSONB)
      ) AS group_data
    FROM public.profiles AS teacher
    JOIN public.teacher_profiles AS tp ON tp.teacher_id = teacher.id
    JOIN public.teacher_groups AS g ON g.teacher_id = teacher.id AND g.status = 'ACTIVE'
    CROSS JOIN student_context AS sc
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*)::INTEGER AS active_count
      FROM public.student_teacher_subscriptions AS st
      WHERE st.group_id = g.id AND st.status = 'ACTIVE' AND st.expires_at > pg_catalog.now()
    ) AS counts
    LEFT JOIN LATERAL (
      SELECT st.status
      FROM public.student_teacher_subscriptions AS st
      WHERE st.group_id = g.id AND st.student_id = actor_id
      ORDER BY st.created_at DESC LIMIT 1
    ) AS mine ON TRUE
    CROSS JOIN LATERAL (
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'weekday', slot.weekday, 'start_time', slot.start_time, 'end_time', slot.end_time
      ) ORDER BY slot.weekday, slot.start_time) AS slots
      FROM public.teacher_group_schedule_slots AS slot WHERE slot.group_id = g.id
    ) AS schedule
    WHERE teacher.role = 'TEACHER' AND teacher.teacher_status = 'ACTIVE'
      AND public.is_active_teacher_profile(teacher.id)
      AND pg_catalog.char_length(pg_catalog.btrim(teacher.full_name)) >= 2
      AND pg_catalog.cardinality(tp.subjects) > 0 AND tp.monthly_price > 0
      AND pg_catalog.char_length(COALESCE(tp.lesson_title, '')) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(tp.teaching_area)) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(tp.teaching_address)) >= 5
      AND g.educational_stage = sc.stage AND g.grade = sc.grade
      AND (p_stage IS NULL OR p_stage = sc.stage)
      AND (p_grade IS NULL OR p_grade = sc.grade)
      AND (p_subject IS NULL OR g.subject = p_subject)
      AND (p_area IS NULL OR tp.teaching_area ILIKE ('%' || pg_catalog.btrim(p_area) || '%'))
      AND (p_search IS NULL OR teacher.full_name ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
        OR tp.lesson_title ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
        OR g.subject ILIKE ('%' || pg_catalog.btrim(p_search) || '%'))
      AND EXISTS (SELECT 1 FROM public.teacher_student_payment_methods AS method
        WHERE method.teacher_id = teacher.id AND method.is_active)
  )
  SELECT eg.teacher_id, eg.full_name, eg.avatar_path, eg.subjects,
    eg.teaching_area, eg.teaching_address, eg.lesson_title, eg.bio, eg.monthly_price,
    pg_catalog.jsonb_agg(eg.group_data ORDER BY eg.group_created_at DESC, eg.group_name)
  FROM eligible_groups AS eg
  GROUP BY eg.teacher_id, eg.full_name, eg.avatar_path, eg.subjects,
    eg.teaching_area, eg.teaching_address, eg.lesson_title, eg.bio, eg.monthly_price
  ORDER BY eg.full_name;
END;
$$;
