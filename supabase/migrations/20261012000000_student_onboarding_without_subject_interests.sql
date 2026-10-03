-- Phase 02 follow-up: students choose only their educational stage and grade.
-- Keep the legacy third argument optional for compatibility with existing clients,
-- but do not validate or save student subject preferences during onboarding.
CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_stage TEXT,
  p_grade TEXT,
  p_subjects TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = actor_id AND profile.role = 'STUDENT'
      AND profile.profile_setup_completed AND NOT profile.onboarding_completed
  ) THEN
    RAISE EXCEPTION 'An incomplete student account is required.';
  END IF;

  IF NOT (
    (p_stage = 'ابتدائي' AND p_grade IN (
      'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
      'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي'
    )) OR
    (p_stage = 'إعدادي' AND p_grade IN (
      'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'
    )) OR
    (p_stage = 'ثانوي' AND p_grade IN (
      'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'
    ))
  ) THEN
    RAISE EXCEPTION 'Select a valid educational stage and grade.';
  END IF;

  UPDATE public.profiles AS profile
  SET stage = p_stage,
      grade = p_grade,
      subjects = NULL,
      onboarding_completed = TRUE,
      updated_at = pg_catalog.now()
  WHERE profile.id = actor_id AND profile.role = 'STUDENT' AND NOT profile.onboarding_completed;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student onboarding is already complete.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, TEXT[])
  TO authenticated;

COMMENT ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, TEXT[])
  IS 'Completes a student onboarding by storing stage and grade only; student subject interests are not collected.';
