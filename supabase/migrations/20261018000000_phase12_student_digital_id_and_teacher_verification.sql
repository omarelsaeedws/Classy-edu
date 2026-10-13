-- Phase 12: stable student identifiers, private student portraits, digital ID
-- cards, and teacher-scoped subscription verification.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_identifier TEXT;

CREATE SEQUENCE IF NOT EXISTS public.student_identifier_seq
  AS INTEGER
  MINVALUE 100000
  MAXVALUE 999999
  START WITH 100000
  NO CYCLE;

ALTER SEQUENCE public.student_identifier_seq
  AS INTEGER MINVALUE 100000 MAXVALUE 999999 NO CYCLE;
REVOKE ALL ON SEQUENCE public.student_identifier_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_student_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.student_identifier IS NOT NULL
    AND NEW.student_identifier IS DISTINCT FROM OLD.student_identifier
  THEN
    RAISE EXCEPTION 'Student identifiers cannot be changed.';
  END IF;

  IF NEW.role = 'STUDENT' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.student_identifier := pg_catalog.lpad(pg_catalog.nextval('public.student_identifier_seq')::TEXT, 6, '0');
    ELSIF OLD.student_identifier IS NULL THEN
      NEW.student_identifier := pg_catalog.lpad(pg_catalog.nextval('public.student_identifier_seq')::TEXT, 6, '0');
    ELSE
      NEW.student_identifier := OLD.student_identifier;
    END IF;
  ELSE
    NEW.student_identifier := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_student_identifier() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_student_identifier_before_write ON public.profiles;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_student_identifier_role_check;

UPDATE public.profiles
SET student_identifier = NULL
WHERE role = 'STUDENT' AND student_identifier IS NOT NULL
  AND student_identifier !~ '^[0-9]{6}$';

SELECT pg_catalog.setval(
  'public.student_identifier_seq',
  COALESCE(MAX(student_identifier::INTEGER), 100000),
  COUNT(student_identifier) > 0
)
FROM public.profiles
WHERE role = 'STUDENT' AND student_identifier ~ '^[0-9]{6}$';

UPDATE public.profiles
SET student_identifier = pg_catalog.lpad(pg_catalog.nextval('public.student_identifier_seq')::TEXT, 6, '0')
WHERE role = 'STUDENT' AND student_identifier IS NULL;

UPDATE public.profiles
SET student_identifier = NULL
WHERE role <> 'STUDENT' AND student_identifier IS NOT NULL;

CREATE TRIGGER assign_student_identifier_before_write
  BEFORE INSERT OR UPDATE OF role, student_identifier ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_student_identifier();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_identifier_uidx
  ON public.profiles (student_identifier)
  WHERE student_identifier IS NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_identifier_role_check
  CHECK (
    (role = 'STUDENT' AND student_identifier IS NOT NULL AND student_identifier ~ '^[0-9]{6}$')
    OR (role <> 'STUDENT' AND student_identifier IS NULL)
  );

ALTER TABLE public.student_teacher_subscriptions
  ADD COLUMN IF NOT EXISTS verification_qr_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS student_teacher_subscriptions_verification_qr_token_uidx
  ON public.student_teacher_subscriptions (verification_qr_token);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-avatars', 'student-avatars', FALSE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Students upload their own private avatar" ON storage.objects;
CREATE POLICY "Students upload their own private avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'STUDENT'
    )
  );

DROP POLICY IF EXISTS "Students and their teachers read authorized student avatars" ON storage.objects;
CREATE POLICY "Students and their teachers read authorized student avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR EXISTS (
        SELECT 1
        FROM public.student_teacher_subscriptions AS subscription
        WHERE subscription.student_id::TEXT = (storage.foldername(name))[1]
          AND subscription.teacher_id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Students remove their own private avatar" ON storage.objects;
CREATE POLICY "Students remove their own private avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'STUDENT'
    )
  );

CREATE OR REPLACE FUNCTION public.save_my_student_avatar(p_avatar_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN
    RAISE EXCEPTION 'A signed-in student account is required.';
  END IF;

  IF p_avatar_path IS NOT NULL AND (
    p_avatar_path !~ ('^' || actor_id::TEXT || '/[0-9a-f-]{36}[.](jpg|png|webp)$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects AS object
      WHERE object.bucket_id = 'student-avatars' AND object.name = p_avatar_path
    )
  ) THEN
    RAISE EXCEPTION 'The selected student portrait is not valid.';
  END IF;

  UPDATE public.profiles
  SET avatar_url = p_avatar_path, updated_at = pg_catalog.now()
  WHERE id = actor_id AND role = 'STUDENT';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_student_id_cards()
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
    WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN
    RAISE EXCEPTION 'A signed-in student account is required.';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'student_identifier', student.student_identifier,
    'full_name', student.full_name,
    'avatar_path', student.avatar_url,
    'subscriptions', COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'verification_qr_token', subscription.verification_qr_token,
          'teacher_name', teacher.full_name,
          'subject', group_record.subject,
          'group_name', group_record.name,
          'status', CASE
            WHEN subscription.status = 'ACTIVE'
              AND (subscription.expires_at IS NULL OR subscription.expires_at <= pg_catalog.now())
            THEN 'EXPIRED'
            ELSE subscription.status
          END,
          'started_at', subscription.started_at,
          'expires_at', subscription.expires_at
        ) ORDER BY subscription.created_at DESC, group_record.subject, group_record.name
      ) FILTER (WHERE subscription.id IS NOT NULL),
      '[]'::JSONB
    )
  ) INTO result
  FROM public.profiles AS student
  LEFT JOIN public.student_teacher_subscriptions AS subscription
    ON subscription.student_id = student.id
  LEFT JOIN public.profiles AS teacher ON teacher.id = subscription.teacher_id
  LEFT JOIN public.teacher_groups AS group_record ON group_record.id = subscription.group_id
  WHERE student.id = actor_id AND student.role = 'STUDENT'
  GROUP BY student.id, student.student_identifier, student.full_name, student.avatar_url;

  RETURN result;
END;
$$;

CREATE TABLE IF NOT EXISTS public.teacher_subscription_verification_attempts (
  teacher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.teacher_subscription_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_subscription_verification_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_student_subscription_for_teacher(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  normalized_identifier TEXT := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_identifier, '')));
  student_id UUID;
  requested_qr_token UUID;
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

  IF normalized_identifier ~ '^CLASSY-SUB:[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' THEN
    requested_qr_token := pg_catalog.substr(normalized_identifier, 12)::UUID;
    SELECT subscription.student_id INTO student_id
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.verification_qr_token = requested_qr_token
      AND subscription.teacher_id = actor_id;

    IF student_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('result', 'NOT_SUBSCRIBED');
    END IF;
  ELSIF normalized_identifier ~ '^[0-9]{6}$' THEN
    SELECT student.id INTO student_id
    FROM public.profiles AS student
    WHERE student.student_identifier = normalized_identifier AND student.role = 'STUDENT';

    IF student_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('result', 'INVALID');
    END IF;
  ELSE
    RETURN pg_catalog.jsonb_build_object('result', 'INVALID');
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'full_name', student.full_name,
    'student_identifier', student.student_identifier,
    'avatar_path', student.avatar_url
  ) INTO student_data
  FROM public.profiles AS student
  WHERE student.id = student_id AND student.role = 'STUDENT';

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
  WHERE subscription.student_id = student_id
    AND subscription.teacher_id = actor_id
    AND (requested_qr_token IS NULL OR subscription.verification_qr_token = requested_qr_token);

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

REVOKE ALL ON FUNCTION public.save_my_student_avatar(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_student_id_cards() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_student_subscription_for_teacher(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_student_avatar(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_id_cards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_subscription_for_teacher(TEXT) TO authenticated;
