-- Phase 06: teacher-created class sessions and secure student attendance.
-- Attendance check-in is performed by the check-attendance Edge Function.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.class_sessions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  group_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'OPEN', 'COMPLETED', 'CANCELLED')),
  attendance_open BOOLEAN NOT NULL DEFAULT FALSE,
  attendance_code TEXT,
  attendance_code_expires_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT class_sessions_time_valid CHECK (end_time > start_time),
  CONSTRAINT class_sessions_code_valid CHECK (
    (status = 'OPEN' AND attendance_open AND attendance_code ~ '^[0-9]{6}$'
      AND attendance_code_expires_at IS NOT NULL AND opened_at IS NOT NULL)
    OR (status <> 'OPEN' AND NOT attendance_open AND attendance_code IS NULL
      AND attendance_code_expires_at IS NULL)
  ),
  CONSTRAINT class_sessions_group_owner_fk
    FOREIGN KEY (group_id, teacher_id)
    REFERENCES public.teacher_groups(id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT class_sessions_id_teacher_key UNIQUE (id, teacher_id)
);

CREATE TABLE public.class_attendance (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'ABSENT')),
  attended_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT class_attendance_one_per_student_session UNIQUE (session_id, student_id)
);

CREATE INDEX class_sessions_group_date_idx ON public.class_sessions (group_id, session_date, start_time);
CREATE INDEX class_sessions_teacher_date_idx ON public.class_sessions (teacher_id, session_date DESC);
CREATE INDEX class_sessions_date_idx ON public.class_sessions (session_date, status);
CREATE UNIQUE INDEX class_sessions_open_code_uidx
  ON public.class_sessions (attendance_code) WHERE status = 'OPEN' AND attendance_code IS NOT NULL;
CREATE INDEX class_attendance_session_idx ON public.class_attendance (session_id, attended_at);
CREATE INDEX class_attendance_student_idx ON public.class_attendance (student_id, attended_at DESC);

CREATE TRIGGER class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER class_attendance_updated_at
  BEFORE UPDATE ON public.class_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers and admins read authorized class sessions"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
    OR EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.student_id = (SELECT auth.uid())
        AND subscription.group_id = class_sessions.group_id
        AND subscription.status IN ('ACTIVE', 'EXPIRED')
        AND subscription.started_at IS NOT NULL
        AND subscription.started_at <= (class_sessions.session_date + class_sessions.start_time)
        AND subscription.expires_at > (class_sessions.session_date + class_sessions.start_time)
    )
  );

CREATE POLICY "Students teachers and admins read authorized attendance"
  ON public.class_attendance FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR public.is_classy_admin()
    OR EXISTS (
      SELECT 1 FROM public.class_sessions AS session
      WHERE session.id = class_attendance.session_id
        AND session.teacher_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.class_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, group_id, teacher_id, session_date, start_time, end_time, status,
  attendance_open, attendance_code_expires_at, opened_at, closed_at,
  created_at, updated_at
) ON public.class_sessions TO authenticated;
REVOKE ALL ON public.class_attendance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.class_attendance TO authenticated;

COMMENT ON TABLE public.class_sessions IS
  'One explicitly created meeting of a teacher group. Weekly group schedules are references and do not auto-create sessions.';
COMMENT ON COLUMN public.class_sessions.attendance_code IS
  'Short-lived six-digit code. Direct column access is revoked; only the owning teacher RPC returns it.';
COMMENT ON TABLE public.class_attendance IS
  'Immutable student check-ins created only through the authenticated check-attendance Edge Function and database validation.';

CREATE OR REPLACE FUNCTION private.generate_class_attendance_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  random_hex TEXT := pg_catalog.replace(pg_catalog.gen_random_uuid()::TEXT, '-', '');
  numeric_value BIGINT := 0;
  digit_position INTEGER;
  digit_value INTEGER;
BEGIN
  FOR digit_position IN 1..8 LOOP
    digit_value := pg_catalog.strpos('0123456789abcdef', pg_catalog.substr(random_hex, digit_position, 1)) - 1;
    numeric_value := numeric_value * 16 + digit_value;
  END LOOP;
  RETURN pg_catalog.lpad((numeric_value % 1000000)::TEXT, 6, '0');
END;
$$;
REVOKE ALL ON FUNCTION private.generate_class_attendance_code() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_teacher_class_session(
  p_group_id UUID,
  p_session_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  group_row public.teacher_groups%ROWTYPE;
  new_session_id UUID;
  cairo_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF p_group_id IS NULL OR p_session_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL
    OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Session group, date and a valid time range are required.';
  END IF;
  IF p_session_date < cairo_today THEN
    RAISE EXCEPTION 'A session cannot be scheduled in the past.';
  END IF;

  SELECT * INTO group_row
  FROM public.teacher_groups AS g
  WHERE g.id = p_group_id AND g.teacher_id = actor_id AND g.status = 'ACTIVE'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This active group does not belong to the teacher.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_sessions AS existing
    WHERE existing.group_id = p_group_id
      AND existing.session_date = p_session_date
      AND existing.status <> 'CANCELLED'
      AND existing.start_time < p_end_time
      AND existing.end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'This session overlaps another session for the group.';
  END IF;

  INSERT INTO public.class_sessions (group_id, teacher_id, session_date, start_time, end_time)
  VALUES (p_group_id, actor_id, p_session_date, p_start_time, p_end_time)
  RETURNING id INTO new_session_id;
  RETURN new_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.open_teacher_class_attendance(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  session_row public.class_sessions%ROWTYPE;
  generated_code TEXT;
  collision_attempt INTEGER;
  cairo_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  SELECT * INTO session_row FROM public.class_sessions AS s
  WHERE s.id = p_session_id AND s.teacher_id = actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found.'; END IF;
  IF session_row.session_date <> cairo_today THEN
    RAISE EXCEPTION 'Attendance can only be opened on the session date.';
  END IF;
  IF session_row.status NOT IN ('SCHEDULED', 'OPEN') THEN
    RAISE EXCEPTION 'This session cannot be opened for attendance.';
  END IF;
  IF session_row.status = 'OPEN' AND session_row.attendance_code_expires_at > pg_catalog.now() THEN
    RETURN pg_catalog.jsonb_build_object(
      'session_id', p_session_id,
      'attendance_code', session_row.attendance_code,
      'expires_at', session_row.attendance_code_expires_at
    );
  END IF;

  FOR collision_attempt IN 1..8 LOOP
    generated_code := private.generate_class_attendance_code();
    IF EXISTS (
      SELECT 1 FROM public.class_sessions AS other
      WHERE other.status = 'OPEN' AND other.attendance_code = generated_code AND other.id <> p_session_id
    ) THEN
      CONTINUE;
    END IF;
    BEGIN
      UPDATE public.class_sessions AS s
      SET status = 'OPEN', attendance_open = TRUE,
          attendance_code = generated_code,
          attendance_code_expires_at = pg_catalog.now() + INTERVAL '10 minutes',
          opened_at = pg_catalog.now(), closed_at = NULL
      WHERE s.id = p_session_id AND s.teacher_id = actor_id;
      RETURN pg_catalog.jsonb_build_object(
        'session_id', p_session_id,
        'attendance_code', generated_code,
        'expires_at', pg_catalog.now() + INTERVAL '10 minutes'
      );
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
  RAISE EXCEPTION 'Could not create a unique attendance code. Try again.';
END;
$$;

CREATE OR REPLACE FUNCTION private.close_teacher_class_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  UPDATE public.class_sessions AS s
  SET status = 'COMPLETED', attendance_open = FALSE,
      attendance_code = NULL, attendance_code_expires_at = NULL,
      closed_at = pg_catalog.now()
  WHERE s.id = p_session_id AND s.teacher_id = actor_id AND s.status = 'OPEN';
  IF NOT FOUND THEN RAISE EXCEPTION 'This teacher session is not open for attendance.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.cancel_teacher_class_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  UPDATE public.class_sessions AS s
  SET status = 'CANCELLED', attendance_open = FALSE,
      attendance_code = NULL, attendance_code_expires_at = NULL,
      closed_at = pg_catalog.now()
  WHERE s.id = p_session_id AND s.teacher_id = actor_id AND s.status = 'SCHEDULED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a scheduled session can be cancelled.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.list_teacher_class_sessions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
  result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', s.id, 'group_id', s.group_id, 'group_name', g.name,
      'session_date', s.session_date, 'start_time', s.start_time, 'end_time', s.end_time,
      'status', s.status, 'attendance_open', s.attendance_open,
      'attendance_code_expires_at', s.attendance_code_expires_at,
      'active_students', counts.active_count, 'present_count', counts.present_count
    ) ORDER BY s.session_date, s.start_time
  ), '[]'::JSONB) INTO result
  FROM public.class_sessions AS s
  JOIN public.teacher_groups AS g ON g.id = s.group_id AND g.teacher_id = actor_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(DISTINCT subscription.student_id)::INTEGER AS active_count,
      pg_catalog.count(DISTINCT attendance.student_id)::INTEGER AS present_count
    FROM public.student_teacher_subscriptions AS subscription
    LEFT JOIN public.class_attendance AS attendance
      ON attendance.session_id = s.id AND attendance.student_id = subscription.student_id
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
DECLARE actor_id UUID := (SELECT auth.uid());
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
    'active_students', counts.active_count, 'present_count', counts.present_count,
    'attendance', COALESCE(attendance_list.items, '[]'::JSONB)
  ) INTO result
  FROM public.class_sessions AS s
  JOIN public.teacher_groups AS g ON g.id = s.group_id AND g.teacher_id = actor_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(DISTINCT subscription.student_id)::INTEGER AS active_count,
      pg_catalog.count(DISTINCT attendance.student_id)::INTEGER AS present_count
    FROM public.student_teacher_subscriptions AS subscription
    LEFT JOIN public.class_attendance AS attendance
      ON attendance.session_id = s.id AND attendance.student_id = subscription.student_id
    WHERE subscription.group_id = s.group_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED')
      AND subscription.started_at IS NOT NULL
      AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
      AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
  ) AS counts
  CROSS JOIN LATERAL (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', p.id,
      'student_name', p.full_name,
      'status', COALESCE(a.status, 'NOT_RECORDED'),
      'attended_at', a.attended_at
    ) ORDER BY p.full_name) AS items
    FROM (
      SELECT DISTINCT subscription.student_id
      FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.group_id = s.group_id
        AND subscription.status IN ('ACTIVE', 'EXPIRED')
        AND subscription.started_at IS NOT NULL
        AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
        AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
    ) AS eligible
    JOIN public.profiles AS p ON p.id = eligible.student_id AND p.role = 'STUDENT'
    LEFT JOIN public.class_attendance AS a ON a.session_id = s.id AND a.student_id = p.id
  ) AS attendance_list
  WHERE s.id = p_session_id AND s.teacher_id = actor_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Session not found.'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.list_student_class_sessions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
  result JSONB;
  cairo_today DATE := (pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'group_name', g.name,
    'teacher_name', teacher.full_name, 'session_date', s.session_date,
    'start_time', s.start_time, 'end_time', s.end_time, 'status', s.status,
    'attendance_open', s.status = 'OPEN' AND s.attendance_code_expires_at > pg_catalog.now(),
    'attendance_code_expires_at', s.attendance_code_expires_at,
    'attended', a.id IS NOT NULL
  ) ORDER BY s.session_date, s.start_time), '[]'::JSONB) INTO result
  FROM public.class_sessions AS s
  JOIN public.teacher_groups AS g ON g.id = s.group_id
  JOIN public.profiles AS teacher ON teacher.id = s.teacher_id
  LEFT JOIN public.class_attendance AS a ON a.session_id = s.id AND a.student_id = actor_id
  WHERE s.status <> 'CANCELLED'
    AND s.session_date BETWEEN cairo_today - 30 AND cairo_today + 60
    AND EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.student_id = actor_id AND subscription.group_id = s.group_id
        AND subscription.status IN ('ACTIVE', 'EXPIRED')
        AND subscription.started_at IS NOT NULL
        AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
        AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
    )
  ;
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
DECLARE actor_id UUID := (SELECT auth.uid());
  total_count INTEGER;
  present_count INTEGER;
  recent_records JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT pg_catalog.count(DISTINCT s.id)::INTEGER,
    pg_catalog.count(DISTINCT attendance.id)::INTEGER
  INTO total_count, present_count
  FROM public.class_sessions AS s
  JOIN public.student_teacher_subscriptions AS subscription
    ON subscription.group_id = s.group_id AND subscription.student_id = actor_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED')
    AND subscription.started_at IS NOT NULL
    AND subscription.started_at <= ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((s.session_date + s.start_time) AT TIME ZONE 'Africa/Cairo')
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = s.id AND attendance.student_id = actor_id
  WHERE s.status IN ('OPEN', 'COMPLETED');

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'session_id', s.id,
    'group_name', g.name,
    'teacher_name', teacher.full_name,
    'session_date', s.session_date,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'status', attendance.status,
    'attended_at', attendance.attended_at
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

CREATE OR REPLACE FUNCTION private.record_student_attendance(
  p_student_id UUID,
  p_session_id UUID,
  p_attendance_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.class_sessions%ROWTYPE;
  inserted_id UUID;
  cairo_now TIMESTAMP := pg_catalog.now() AT TIME ZONE 'Africa/Cairo';
BEGIN
  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = p_student_id AND p.role = 'STUDENT'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'UNAUTHORIZED');
  END IF;
  IF p_attendance_code IS NULL OR p_attendance_code !~ '^[0-9]{6}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'INVALID_CODE');
  END IF;

  IF p_session_id IS NULL THEN
    SELECT * INTO session_row FROM public.class_sessions AS s
    WHERE s.attendance_code = p_attendance_code
    ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE;
  ELSE
    SELECT * INTO session_row FROM public.class_sessions AS s WHERE s.id = p_session_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'SESSION_NOT_FOUND'); END IF;
  IF session_row.status <> 'OPEN' OR NOT session_row.attendance_open THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'SESSION_CLOSED');
  END IF;
  IF session_row.attendance_code_expires_at IS NULL
    OR session_row.attendance_code_expires_at <= pg_catalog.now()
    OR session_row.session_date <> cairo_now::DATE THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'EXPIRED');
  END IF;
  IF session_row.attendance_code <> p_attendance_code THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'INVALID_CODE');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.class_attendance AS attendance
    WHERE attendance.session_id = session_row.id AND attendance.student_id = p_student_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'ALREADY_ATTENDED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.student_id = p_student_id
      AND subscription.group_id = session_row.group_id
      AND subscription.status = 'ACTIVE'
      AND subscription.started_at <= pg_catalog.now()
      AND subscription.expires_at > pg_catalog.now()
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'NO_ACTIVE_SUBSCRIPTION');
  END IF;

  INSERT INTO public.class_attendance (session_id, student_id, status)
  VALUES (session_row.id, p_student_id, 'PRESENT')
  ON CONFLICT (session_id, student_id) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', FALSE, 'code', 'ALREADY_ATTENDED');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', TRUE, 'code', 'RECORDED', 'attendance_id', inserted_id);
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_teacher_class_session(UUID, DATE, TIME, TIME),
  private.open_teacher_class_attendance(UUID),
  private.close_teacher_class_session(UUID),
  private.cancel_teacher_class_session(UUID),
  private.list_teacher_class_sessions(),
  private.get_teacher_class_session(UUID),
  private.list_student_class_sessions(),
  private.get_student_attendance_summary()
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.record_student_attendance(UUID, UUID, TEXT) TO service_role;

-- Only narrow, invoker-rights entry points are exposed through PostgREST.
CREATE OR REPLACE FUNCTION public.create_teacher_class_session(
  p_group_id UUID, p_session_date DATE, p_start_time TIME, p_end_time TIME
) RETURNS UUID LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.create_teacher_class_session(p_group_id, p_session_date, p_start_time, p_end_time)
$$;
CREATE OR REPLACE FUNCTION public.open_teacher_class_attendance(p_session_id UUID)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.open_teacher_class_attendance(p_session_id)
$$;
CREATE OR REPLACE FUNCTION public.close_teacher_class_session(p_session_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.close_teacher_class_session(p_session_id)
$$;
CREATE OR REPLACE FUNCTION public.cancel_teacher_class_session(p_session_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.cancel_teacher_class_session(p_session_id)
$$;
CREATE OR REPLACE FUNCTION public.list_teacher_class_sessions()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.list_teacher_class_sessions()
$$;
CREATE OR REPLACE FUNCTION public.get_teacher_class_session(p_session_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.get_teacher_class_session(p_session_id)
$$;
CREATE OR REPLACE FUNCTION public.get_teacher_session_attendance(p_session_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.get_teacher_class_session(p_session_id)
$$;
CREATE OR REPLACE FUNCTION public.list_student_class_sessions()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.list_student_class_sessions()
$$;
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.get_student_attendance_summary()
$$;
CREATE OR REPLACE FUNCTION public.record_student_attendance(
  p_student_id UUID, p_session_id UUID, p_attendance_code TEXT
) RETURNS JSONB LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.record_student_attendance(p_student_id, p_session_id, p_attendance_code)
$$;

REVOKE ALL ON FUNCTION public.create_teacher_class_session(UUID, DATE, TIME, TIME),
  public.open_teacher_class_attendance(UUID),
  public.close_teacher_class_session(UUID),
  public.cancel_teacher_class_session(UUID),
  public.list_teacher_class_sessions(),
  public.get_teacher_class_session(UUID),
  public.get_teacher_session_attendance(UUID),
  public.list_student_class_sessions(),
  public.get_student_attendance_summary(),
  public.record_student_attendance(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_teacher_class_session(UUID, DATE, TIME, TIME),
  public.open_teacher_class_attendance(UUID),
  public.close_teacher_class_session(UUID),
  public.cancel_teacher_class_session(UUID),
  public.list_teacher_class_sessions(),
  public.get_teacher_class_session(UUID),
  public.get_teacher_session_attendance(UUID),
  public.list_student_class_sessions(),
  public.get_student_attendance_summary()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_attendance(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.record_student_attendance(UUID, UUID, TEXT) IS
  'Service-role-only database endpoint called exclusively by the check-attendance Edge Function after Supabase Auth verification.';
