-- Phase 11: bound repeated attendance-code guesses per authenticated student.
-- The rate limit is consumed by the authenticated check-attendance Edge Function
-- before it invokes the service-role-only attendance recorder.

CREATE TABLE IF NOT EXISTS private.attendance_code_attempt_windows (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count SMALLINT NOT NULL CHECK (attempt_count BETWEEN 1 AND 11),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE private.attendance_code_attempt_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.attendance_code_attempt_windows FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.consume_attendance_code_attempt(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_time_value TIMESTAMPTZ := pg_catalog.clock_timestamp();
  current_attempt_count SMALLINT;
  current_blocked_until TIMESTAMPTZ;
BEGIN
  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_student_id AND profile.role = 'STUDENT'
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO private.attendance_code_attempt_windows AS current_window (
    student_id, window_started_at, attempt_count, blocked_until, updated_at
  ) VALUES (p_student_id, current_time_value, 1, NULL, current_time_value)
  ON CONFLICT (student_id) DO UPDATE SET
    window_started_at = CASE
      WHEN current_window.blocked_until > current_time_value THEN current_window.window_started_at
      WHEN current_window.window_started_at <= current_time_value - INTERVAL '1 minute' THEN current_time_value
      ELSE current_window.window_started_at
    END,
    attempt_count = CASE
      WHEN current_window.blocked_until > current_time_value THEN current_window.attempt_count
      WHEN current_window.window_started_at <= current_time_value - INTERVAL '1 minute' THEN 1
      ELSE current_window.attempt_count + 1
    END,
    blocked_until = CASE
      WHEN current_window.blocked_until > current_time_value THEN current_window.blocked_until
      WHEN current_window.window_started_at <= current_time_value - INTERVAL '1 minute' THEN NULL
      WHEN current_window.attempt_count >= 10 THEN current_time_value + INTERVAL '5 minutes'
      ELSE NULL
    END,
    updated_at = current_time_value
  RETURNING attempt_count, blocked_until
  INTO current_attempt_count, current_blocked_until;

  RETURN current_attempt_count <= 10
    AND (current_blocked_until IS NULL OR current_blocked_until <= current_time_value);
END;
$$;

REVOKE ALL ON FUNCTION private.consume_attendance_code_attempt(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_attendance_code_attempt(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.consume_attendance_code_attempt(p_student_id)
$$;

REVOKE ALL ON FUNCTION public.consume_attendance_code_attempt(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_attendance_code_attempt(UUID) TO service_role;
