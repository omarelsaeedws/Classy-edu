-- Phase 09: role-scoped analytics and basic account settings.
-- Aggregations run in the database to avoid exposing broad table access to the client.

CREATE OR REPLACE FUNCTION private.update_my_account_profile(p_full_name TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  safe_name TEXT := pg_catalog.btrim(COALESCE(p_full_name, ''));
  safe_phone TEXT := pg_catalog.btrim(COALESCE(p_phone, ''));
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = actor_id AND profile.role IN ('STUDENT', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'An authenticated student or teacher account is required.';
  END IF;
  IF pg_catalog.char_length(safe_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Full name must contain between 2 and 120 characters.';
  END IF;
  IF safe_phone !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'A valid Egyptian mobile number is required.';
  END IF;

  UPDATE public.profiles
  SET full_name = safe_name, phone = safe_phone, updated_at = pg_catalog.now()
  WHERE id = actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_phase09_analytics(
  p_start DATE DEFAULT NULL,
  p_end DATE DEFAULT NULL,
  p_group_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  range_start DATE := COALESCE(p_start, (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE - 29);
  range_end DATE := COALESCE(p_end, (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE);
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
  ) THEN RAISE EXCEPTION 'A teacher account is required.'; END IF;
  IF range_start > range_end THEN RAISE EXCEPTION 'Start date must be before end date.'; END IF;

  WITH eligible AS (
    SELECT subscription.id AS subscription_id, subscription.student_id, session.group_id,
      session.id AS session_id, (attendance.id IS NOT NULL AND attendance.status IN ('PRESENT', 'LATE')) AS attended
    FROM public.student_teacher_subscriptions AS subscription
    JOIN public.class_sessions AS session ON session.group_id = subscription.group_id
      AND session.teacher_id = actor_id AND session.status = 'COMPLETED'
      AND session.session_date BETWEEN range_start AND range_end
      AND (p_group_id IS NULL OR session.group_id = p_group_id)
      AND subscription.approved_at IS NOT NULL AND subscription.started_at IS NOT NULL
      AND subscription.expires_at IS NOT NULL
      AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    LEFT JOIN public.class_attendance AS attendance
      ON attendance.session_id = session.id AND attendance.student_id = subscription.student_id
    WHERE subscription.teacher_id = actor_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
  ),
  group_rows AS (
    SELECT group_row.id, group_row.name, group_row.subject, group_row.educational_stage,
      group_row.grade, group_row.status,
      (SELECT pg_catalog.count(DISTINCT s.student_id)::INTEGER
       FROM public.student_teacher_subscriptions AS s
       WHERE s.teacher_id = actor_id AND s.group_id = group_row.id AND s.status = 'ACTIVE'
         AND s.expires_at > pg_catalog.now()) AS active_students,
      (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions AS s
       WHERE s.teacher_id = actor_id AND s.group_id = group_row.id
         AND s.status IN ('PENDING_PAYMENT', 'UNDER_REVIEW')) AS pending_requests,
      (SELECT pg_catalog.count(DISTINCT cs.id)::INTEGER FROM public.class_sessions AS cs
       WHERE cs.teacher_id = actor_id AND cs.group_id = group_row.id
         AND cs.session_date BETWEEN range_start AND range_end
         AND (p_group_id IS NULL OR cs.group_id = p_group_id)) AS sessions,
      (SELECT pg_catalog.count(*)::INTEGER FROM eligible e WHERE e.group_id = group_row.id) AS eligible_records,
      (SELECT pg_catalog.count(*)::INTEGER FROM eligible e WHERE e.group_id = group_row.id AND e.attended) AS attended_records
    FROM public.teacher_groups AS group_row
    WHERE group_row.teacher_id = actor_id AND (p_group_id IS NULL OR group_row.id = p_group_id)
  ),
  student_rows AS (
    SELECT DISTINCT ON (subscription.student_id, group_row.id)
      subscription.student_id, student.full_name AS student_name, group_row.id AS group_id,
      group_row.name AS group_name, group_row.subject, subscription.status AS subscription_status,
      subscription.expires_at,
      (SELECT pg_catalog.count(*)::INTEGER FROM eligible e WHERE e.subscription_id = subscription.id) AS eligible_sessions,
      (SELECT pg_catalog.count(*)::INTEGER FROM eligible e WHERE e.subscription_id = subscription.id AND e.attended) AS attended_sessions
    FROM public.student_teacher_subscriptions AS subscription
    JOIN public.profiles AS student ON student.id = subscription.student_id
    JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
    WHERE subscription.teacher_id = actor_id AND (p_group_id IS NULL OR group_row.id = p_group_id)
    ORDER BY subscription.student_id, group_row.id, subscription.created_at DESC
  ),
  review_summary AS (
    SELECT pg_catalog.round(pg_catalog.avg(review.rating)::NUMERIC, 1) AS average_rating,
      pg_catalog.count(*)::INTEGER AS review_count,
      pg_catalog.jsonb_build_object(
        '1', pg_catalog.count(*) FILTER (WHERE review.rating = 1),
        '2', pg_catalog.count(*) FILTER (WHERE review.rating = 2),
        '3', pg_catalog.count(*) FILTER (WHERE review.rating = 3),
        '4', pg_catalog.count(*) FILTER (WHERE review.rating = 4),
        '5', pg_catalog.count(*) FILTER (WHERE review.rating = 5)
      ) AS distribution
    FROM public.reviews AS review WHERE review.teacher_id = actor_id
      AND (review.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end
  ),
  recent_reviews AS (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'display_name', display_name, 'rating', rating, 'comment', comment, 'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::JSONB) AS items
    FROM (
      SELECT COALESCE(NULLIF(pg_catalog.btrim(student.full_name), ''), 'طالب') AS display_name,
        review.rating, review.comment, review.created_at
      FROM public.reviews AS review
      JOIN public.profiles AS student ON student.id = review.student_id
      WHERE review.teacher_id = actor_id
        AND (review.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end
      ORDER BY review.created_at DESC LIMIT 5
    ) AS recent
  ),
  latest_classy_subscription AS (
    SELECT status, expires_at FROM public.teacher_platform_subscriptions
    WHERE teacher_id = actor_id ORDER BY created_at DESC LIMIT 1
  )
  SELECT pg_catalog.jsonb_build_object(
    'range_start', range_start, 'range_end', range_end,
    'metrics', pg_catalog.jsonb_build_object(
      'active_students', (SELECT pg_catalog.count(DISTINCT s.student_id)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.teacher_id = actor_id AND s.status = 'ACTIVE' AND s.expires_at > pg_catalog.now()
          AND (p_group_id IS NULL OR s.group_id = p_group_id)),
      'active_groups', (SELECT pg_catalog.count(*)::INTEGER FROM public.teacher_groups g
        WHERE g.teacher_id = actor_id AND g.status = 'ACTIVE' AND (p_group_id IS NULL OR g.id = p_group_id)),
      'sessions', (SELECT pg_catalog.count(*)::INTEGER FROM public.class_sessions s
        WHERE s.teacher_id = actor_id AND s.session_date BETWEEN range_start AND range_end
          AND (p_group_id IS NULL OR s.group_id = p_group_id)),
      'attendance_records', (SELECT pg_catalog.count(*)::INTEGER FROM public.class_attendance a
        JOIN public.class_sessions s ON s.id = a.session_id
        WHERE s.teacher_id = actor_id AND s.session_date BETWEEN range_start AND range_end
          AND (p_group_id IS NULL OR s.group_id = p_group_id) AND a.status IN ('PRESENT', 'LATE')),
      'attendance_rate', CASE WHEN (SELECT pg_catalog.count(*) FROM eligible) = 0 THEN 0
        ELSE pg_catalog.round((SELECT pg_catalog.count(*) FILTER (WHERE attended)::NUMERIC * 100 / pg_catalog.count(*) FROM eligible), 1) END,
      'pending_requests', (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.teacher_id = actor_id AND s.status IN ('PENDING_PAYMENT', 'UNDER_REVIEW') AND (p_group_id IS NULL OR s.group_id = p_group_id)),
      'rejected_subscriptions', (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.teacher_id = actor_id AND s.status = 'REJECTED' AND s.created_at::DATE BETWEEN range_start AND range_end
          AND (p_group_id IS NULL OR s.group_id = p_group_id)),
      'expired_subscriptions', (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.teacher_id = actor_id AND (s.status = 'EXPIRED' OR (s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now()))
          AND (p_group_id IS NULL OR s.group_id = p_group_id)),
      'average_rating', (SELECT average_rating FROM review_summary),
      'review_count', (SELECT review_count FROM review_summary),
      'rating_distribution', (SELECT distribution FROM review_summary),
      'recent_reviews', (SELECT items FROM recent_reviews),
      'classy_subscription_status', (SELECT CASE WHEN expires_at > pg_catalog.now() AND status = 'APPROVED' THEN 'ACTIVE'
        WHEN status = 'APPROVED' THEN 'EXPIRED' ELSE status END FROM latest_classy_subscription),
      'classy_subscription_expires_at', (SELECT expires_at FROM latest_classy_subscription)
    ),
    'groups', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id, 'name', name, 'subject', subject, 'educational_stage', educational_stage, 'grade', grade,
      'status', status, 'active_students', active_students, 'pending_requests', pending_requests,
      'sessions', sessions, 'attendance_rate', CASE WHEN eligible_records = 0 THEN 0
        ELSE pg_catalog.round(attended_records::NUMERIC * 100 / eligible_records, 1) END
    ) ORDER BY name) FROM group_rows), '[]'::JSONB),
    'students', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', student_id, 'student_name', student_name, 'group_id', group_id, 'group_name', group_name,
      'subject', subject, 'subscription_status', subscription_status, 'expires_at', expires_at,
      'attendance_rate', CASE WHEN eligible_sessions = 0 THEN NULL ELSE pg_catalog.round(attended_sessions::NUMERIC * 100 / eligible_sessions, 1) END
    ) ORDER BY student_name, group_name) FROM student_rows), '[]'::JSONB)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_admin_phase09_analytics(p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  range_start DATE := COALESCE(p_start, (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE - 29);
  range_end DATE := COALESCE(p_end, (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE);
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'An administrator account is required.'; END IF;
  IF range_start > range_end THEN RAISE EXCEPTION 'Start date must be before end date.'; END IF;

  WITH eligible AS (
    SELECT (attendance.id IS NOT NULL AND attendance.status IN ('PRESENT', 'LATE')) AS attended
    FROM public.student_teacher_subscriptions AS subscription
    JOIN public.class_sessions AS session ON session.group_id = subscription.group_id AND session.status = 'COMPLETED'
      AND session.session_date BETWEEN range_start AND range_end
      AND subscription.approved_at IS NOT NULL AND subscription.started_at IS NOT NULL AND subscription.expires_at IS NOT NULL
      AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    LEFT JOIN public.class_attendance AS attendance ON attendance.session_id = session.id AND attendance.student_id = subscription.student_id
    WHERE subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
  ),
  months AS (
    SELECT month_start::DATE AS month, month_start, month_start + INTERVAL '1 month' AS next_month
    FROM pg_catalog.generate_series(
      pg_catalog.date_trunc('month', range_start::TIMESTAMP), pg_catalog.date_trunc('month', range_end::TIMESTAMP), INTERVAL '1 month'
    ) AS month_series(month_start)
  ),
  users_by_month AS (
    SELECT pg_catalog.date_trunc('month', created_at AT TIME ZONE 'Africa/Cairo')::DATE AS month, pg_catalog.count(*)::INTEGER AS new_users
    FROM public.profiles WHERE created_at >= (range_start::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
      AND created_at < ((range_end + 1)::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
    GROUP BY 1
  ),
  subscriptions_by_month AS (
    SELECT pg_catalog.date_trunc('month', created_at AT TIME ZONE 'Africa/Cairo')::DATE AS month, pg_catalog.count(*)::INTEGER AS student_subscriptions
    FROM public.student_teacher_subscriptions WHERE created_at >= (range_start::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
      AND created_at < ((range_end + 1)::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
    GROUP BY 1
  ),
  sessions_by_month AS (
    SELECT pg_catalog.date_trunc('month', created_at AT TIME ZONE 'Africa/Cairo')::DATE AS month, pg_catalog.count(*)::INTEGER AS sessions
    FROM public.class_sessions WHERE created_at >= (range_start::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
      AND created_at < ((range_end + 1)::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
    GROUP BY 1
  ),
  reviews_by_month AS (
    SELECT pg_catalog.date_trunc('month', created_at AT TIME ZONE 'Africa/Cairo')::DATE AS month, pg_catalog.count(*)::INTEGER AS reviews
    FROM public.reviews WHERE created_at >= (range_start::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
      AND created_at < ((range_end + 1)::TIMESTAMP AT TIME ZONE 'Africa/Cairo')
    GROUP BY 1
  ),
  monthly AS (
    SELECT months.month, COALESCE(users_by_month.new_users, 0) AS new_users,
      COALESCE(subscriptions_by_month.student_subscriptions, 0) AS student_subscriptions,
      COALESCE(sessions_by_month.sessions, 0) AS sessions, COALESCE(reviews_by_month.reviews, 0) AS reviews
    FROM months
    LEFT JOIN users_by_month USING (month)
    LEFT JOIN subscriptions_by_month USING (month)
    LEFT JOIN sessions_by_month USING (month)
    LEFT JOIN reviews_by_month USING (month)
  ),
  review_summary AS (
    SELECT pg_catalog.round(pg_catalog.avg(r.rating)::NUMERIC, 1) AS average_rating, pg_catalog.count(*)::INTEGER AS review_count
    FROM public.reviews r WHERE (r.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end
  )
  SELECT pg_catalog.jsonb_build_object(
    'range_start', range_start, 'range_end', range_end,
    'metrics', pg_catalog.jsonb_build_object(
      'total_students', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles WHERE role = 'STUDENT'),
      'new_students', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles WHERE role = 'STUDENT' AND (created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end),
      'total_teachers', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles WHERE role = 'TEACHER'),
      'new_teachers', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles WHERE role = 'TEACHER' AND (created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end),
      'active_teachers', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles p WHERE p.role = 'TEACHER'
        AND p.teacher_status = 'ACTIVE' AND EXISTS (SELECT 1 FROM public.teacher_platform_subscriptions s
          WHERE s.teacher_id = p.id AND s.status = 'APPROVED' AND s.expires_at > pg_catalog.now())),
      'pending_teachers', (SELECT pg_catalog.count(*)::INTEGER FROM public.profiles WHERE role = 'TEACHER' AND teacher_status = 'PENDING'),
      'expired_classy_subscriptions', (SELECT pg_catalog.count(*)::INTEGER FROM public.teacher_platform_subscriptions s
        WHERE s.status = 'EXPIRED' OR (s.status = 'APPROVED' AND s.expires_at <= pg_catalog.now())),
      'active_student_subscriptions', (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.status = 'ACTIVE' AND s.expires_at > pg_catalog.now()),
      'expired_student_subscriptions', (SELECT pg_catalog.count(*)::INTEGER FROM public.student_teacher_subscriptions s
        WHERE s.status = 'EXPIRED' OR (s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now())),
      'active_groups', (SELECT pg_catalog.count(*)::INTEGER FROM public.teacher_groups WHERE status = 'ACTIVE'),
      'sessions', (SELECT pg_catalog.count(*)::INTEGER FROM public.class_sessions WHERE session_date BETWEEN range_start AND range_end),
      'attendance_records', (SELECT pg_catalog.count(*)::INTEGER FROM public.class_attendance a JOIN public.class_sessions s ON s.id = a.session_id
        WHERE s.session_date BETWEEN range_start AND range_end AND a.status IN ('PRESENT', 'LATE')),
      'attendance_rate', CASE WHEN (SELECT pg_catalog.count(*) FROM eligible) = 0 THEN 0
        ELSE pg_catalog.round((SELECT pg_catalog.count(*) FILTER (WHERE attended)::NUMERIC * 100 / pg_catalog.count(*) FROM eligible), 1) END,
      'average_rating', (SELECT average_rating FROM review_summary),
      'review_count', (SELECT review_count FROM review_summary)
    ),
    'monthly_activity', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'month', month, 'new_users', new_users, 'student_subscriptions', student_subscriptions,
      'sessions', sessions, 'reviews', reviews
    ) ORDER BY month) FROM monthly), '[]'::JSONB),
    'rating_distribution', (SELECT pg_catalog.jsonb_build_object(
      '1', pg_catalog.count(*) FILTER (WHERE rating = 1), '2', pg_catalog.count(*) FILTER (WHERE rating = 2),
      '3', pg_catalog.count(*) FILTER (WHERE rating = 3), '4', pg_catalog.count(*) FILTER (WHERE rating = 4),
      '5', pg_catalog.count(*) FILTER (WHERE rating = 5)
    ) FROM public.reviews WHERE (created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_account_profile(p_full_name TEXT, p_phone TEXT)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.update_my_account_profile(p_full_name, p_phone)
$$;
CREATE OR REPLACE FUNCTION public.get_teacher_phase09_analytics(p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL, p_group_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_teacher_phase09_analytics(p_start, p_end, p_group_id)
$$;
CREATE OR REPLACE FUNCTION public.get_admin_phase09_analytics(p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_admin_phase09_analytics(p_start, p_end)
$$;

REVOKE ALL ON FUNCTION private.update_my_account_profile(TEXT, TEXT),
  private.get_teacher_phase09_analytics(DATE, DATE, UUID), private.get_admin_phase09_analytics(DATE, DATE)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.update_my_account_profile(TEXT, TEXT),
  private.get_teacher_phase09_analytics(DATE, DATE, UUID), private.get_admin_phase09_analytics(DATE, DATE)
  TO authenticated;
REVOKE ALL ON FUNCTION public.update_my_account_profile(TEXT, TEXT),
  public.get_teacher_phase09_analytics(DATE, DATE, UUID), public.get_admin_phase09_analytics(DATE, DATE)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_account_profile(TEXT, TEXT),
  public.get_teacher_phase09_analytics(DATE, DATE, UUID), public.get_admin_phase09_analytics(DATE, DATE)
  TO authenticated;

COMMENT ON FUNCTION public.update_my_account_profile(TEXT, TEXT) IS
  'Updates only the authenticated STUDENT or TEACHER name and Egyptian mobile phone.';
COMMENT ON FUNCTION public.get_teacher_phase09_analytics(DATE, DATE, UUID) IS
  'Returns date and group filtered analytics for the authenticated teacher and only their students.';
COMMENT ON FUNCTION public.get_admin_phase09_analytics(DATE, DATE) IS
  'Returns aggregate platform analytics for an authenticated administrator without exposing student-level details.';
