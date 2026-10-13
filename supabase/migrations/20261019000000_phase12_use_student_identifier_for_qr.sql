-- Phase 12 follow-up: use the same six-digit student identifier for manual
-- verification and the student's QR code. QR verification remains scoped to
-- the authenticated teacher's own subscriptions.

CREATE OR REPLACE FUNCTION public.verify_student_subscription_for_teacher(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  normalized_identifier TEXT := pg_catalog.btrim(COALESCE(p_identifier, ''));
  v_student_id UUID;
  student_data JSONB;
  subscription_data JSONB;
  attempt_window_started_at TIMESTAMPTZ;
  stored_attempt_count SMALLINT;
  attempt_blocked_until TIMESTAMPTZ;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS teacher
    WHERE teacher.id = actor_id AND teacher.role = 'TEACHER' AND teacher.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher account is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.teacher_subscription_verification_attempts (teacher_id)
  VALUES (actor_id)
  ON CONFLICT (teacher_id) DO NOTHING;

  SELECT attempts.window_started_at, attempts.attempt_count, attempts.blocked_until
  INTO attempt_window_started_at, stored_attempt_count, attempt_blocked_until
  FROM public.teacher_subscription_verification_attempts AS attempts
  WHERE attempts.teacher_id = actor_id
  FOR UPDATE;

  IF attempt_blocked_until IS NOT NULL AND attempt_blocked_until > pg_catalog.now() THEN
    RETURN pg_catalog.jsonb_build_object('result', 'RATE_LIMITED');
  ELSIF attempt_window_started_at <= pg_catalog.now() - INTERVAL '1 minute' THEN
    UPDATE public.teacher_subscription_verification_attempts
    SET window_started_at = pg_catalog.now(), attempt_count = 1, blocked_until = NULL, updated_at = pg_catalog.now()
    WHERE teacher_id = actor_id;
  ELSIF stored_attempt_count >= 10 THEN
    UPDATE public.teacher_subscription_verification_attempts
    SET blocked_until = pg_catalog.now() + INTERVAL '5 minutes', updated_at = pg_catalog.now()
    WHERE teacher_id = actor_id;
    RETURN pg_catalog.jsonb_build_object('result', 'RATE_LIMITED');
  ELSE
    UPDATE public.teacher_subscription_verification_attempts
    SET attempt_count = attempt_count + 1, updated_at = pg_catalog.now()
    WHERE teacher_id = actor_id;
  END IF;

  IF normalized_identifier !~ '^[0-9]{6}$' THEN
    RETURN pg_catalog.jsonb_build_object('result', 'INVALID');
  END IF;

  SELECT student.id INTO v_student_id
  FROM public.profiles AS student
  WHERE student.student_identifier = normalized_identifier AND student.role = 'STUDENT';

  IF v_student_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('result', 'INVALID');
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'full_name', student.full_name,
    'student_identifier', student.student_identifier,
    'avatar_path', student.avatar_url
  ) INTO student_data
  FROM public.profiles AS student
  WHERE student.id = v_student_id AND student.role = 'STUDENT';

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'group_name', group_record.name,
        'subject', group_record.subject,
        'status', CASE
          WHEN subscription.status = 'ACTIVE'
            AND (subscription.expires_at IS NULL OR subscription.expires_at <= pg_catalog.now())
          THEN 'EXPIRED'
          ELSE subscription.status
        END,
        'expires_at', subscription.expires_at,
        'is_valid', subscription.status = 'ACTIVE'
          AND subscription.expires_at IS NOT NULL
          AND subscription.expires_at > pg_catalog.now()
      ) ORDER BY subscription.created_at DESC
    ),
    '[]'::JSONB
  ) INTO subscription_data
  FROM public.student_teacher_subscriptions AS subscription
  JOIN public.teacher_groups AS group_record ON group_record.id = subscription.group_id
  WHERE subscription.student_id = v_student_id
    AND subscription.teacher_id = actor_id;

  IF subscription_data = '[]'::JSONB THEN
    RETURN pg_catalog.jsonb_build_object('result', 'NOT_SUBSCRIBED');
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'result', 'FOUND',
    'student', student_data,
    'subscriptions', subscription_data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_student_subscription_for_teacher(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_subscription_for_teacher(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
