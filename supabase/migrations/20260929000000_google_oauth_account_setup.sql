-- Google OAuth users finish public account setup once after authentication.
-- Existing profiles keep the completed default; only profiles created by the
-- auth.users trigger below are marked incomplete.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_setup_completed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Cannot modify profile role directly.';
    END IF;
    IF OLD.teacher_status IS DISTINCT FROM NEW.teacher_status THEN
      RAISE EXCEPTION 'Cannot modify teacher status directly.';
    END IF;
    IF OLD.profile_setup_completed IS DISTINCT FROM NEW.profile_setup_completed THEN
      RAISE EXCEPTION 'Cannot modify profile setup status directly.';
    END IF;
  END IF;

  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    role,
    teacher_status,
    onboarding_completed,
    profile_setup_completed
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      'مستخدم'
    ),
    NULL,
    'STUDENT',
    NULL,
    false,
    false
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_google_profile_setup(
  selected_role TEXT,
  full_name TEXT,
  phone TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_name TEXT := pg_catalog.btrim(full_name);
  normalized_phone TEXT := pg_catalog.btrim(phone);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  IF selected_role IS NULL OR selected_role NOT IN ('STUDENT', 'TEACHER') THEN
    RAISE EXCEPTION 'Only STUDENT or TEACHER may be selected.';
  END IF;

  IF normalized_name IS NULL OR pg_catalog.char_length(normalized_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'A valid full name is required.';
  END IF;

  IF normalized_phone IS NULL OR normalized_phone !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'A valid Egyptian mobile number is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = current_user_id
      AND (
        auth_user.raw_app_meta_data->>'provider' = 'google'
        OR COALESCE(auth_user.raw_app_meta_data->'providers', '[]'::JSONB) ? 'google'
      )
  ) THEN
    RAISE EXCEPTION 'A Google-authenticated account is required.';
  END IF;

  UPDATE public.profiles
  SET full_name = normalized_name,
      phone = normalized_phone,
      role = selected_role,
      teacher_status = CASE WHEN selected_role = 'TEACHER' THEN 'PENDING' ELSE NULL END,
      profile_setup_completed = true,
      updated_at = pg_catalog.now()
  WHERE id = current_user_id
    AND role = 'STUDENT'
    AND profile_setup_completed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account setup is already complete or unavailable.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_google_profile_setup(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_google_profile_setup(TEXT, TEXT, TEXT)
  TO authenticated;
