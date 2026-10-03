-- Phase 06 follow-up: allow the owning active teacher to extend an open session.

CREATE OR REPLACE FUNCTION private.extend_teacher_class_attendance(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  new_expiry TIMESTAMPTZ;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  UPDATE public.class_sessions AS s
  SET attendance_code_expires_at = GREATEST(
        COALESCE(s.attendance_code_expires_at, pg_catalog.now()), pg_catalog.now()
      ) + INTERVAL '5 minutes'
  WHERE s.id = p_session_id
    AND s.teacher_id = actor_id
    AND s.status = 'OPEN'
    AND s.attendance_open = TRUE
    AND s.attendance_code IS NOT NULL
  RETURNING s.attendance_code_expires_at INTO new_expiry;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the owning teacher can extend an open attendance session.';
  END IF;

  RETURN pg_catalog.jsonb_build_object('expires_at', new_expiry);
END;
$$;

REVOKE ALL ON FUNCTION private.extend_teacher_class_attendance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.extend_teacher_class_attendance(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.extend_teacher_class_attendance(p_session_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.extend_teacher_class_attendance(p_session_id)
$$;

REVOKE ALL ON FUNCTION public.extend_teacher_class_attendance(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_teacher_class_attendance(UUID) TO authenticated;

COMMENT ON FUNCTION public.extend_teacher_class_attendance(UUID) IS
  'Extends the owning active teacher attendance window by five minutes; the code remains server-validated.';
