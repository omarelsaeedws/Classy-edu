-- Keep profile creation inside the trusted auth.users trigger. Public signups may
-- request only STUDENT or TEACHER; all other metadata values become STUDENT.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
REVOKE INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  assigned_role := CASE NEW.raw_user_meta_data->>'role'
    WHEN 'TEACHER' THEN 'TEACHER'
    ELSE 'STUDENT'
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    role,
    teacher_status,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'مستخدم'),
    NEW.raw_user_meta_data->>'phone',
    assigned_role,
    CASE WHEN assigned_role = 'TEACHER' THEN 'PENDING' ELSE NULL END,
    false
  );

  RETURN NEW;
END;
$$;

-- Trigger functions are invoked by their trigger, never through the Data API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Only trusted database/service-role provisioning may change access roles or
-- teacher activation state. Ordinary authenticated profile edits remain limited
-- to the user's own row by RLS and cannot modify these fields.
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
  END IF;

  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;
