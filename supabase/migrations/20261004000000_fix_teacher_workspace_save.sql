-- Fix profile creation with the non-empty subjects constraint and make
-- teacher-level general availability optional; actual lesson times live on groups.

CREATE OR REPLACE FUNCTION public.save_teacher_profile(
  p_subject TEXT,
  p_semester TEXT,
  p_teaching_address TEXT,
  p_schedule JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  schedule_item JSONB;
  item_weekday SMALLINT;
  item_starts_at TIME;
  item_ends_at TIME;
  normalized_subject TEXT := pg_catalog.btrim(COALESCE(p_subject, ''));
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = actor_id
      AND p.role = 'TEACHER'
      AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  IF pg_catalog.char_length(normalized_subject) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'A valid subject is required.';
  END IF;
  IF p_semester IS NULL OR p_semester NOT IN ('FIRST', 'SECOND', 'BOTH') THEN
    RAISE EXCEPTION 'A valid semester is required.';
  END IF;
  IF p_teaching_address IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(p_teaching_address)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'A valid teaching address is required.';
  END IF;
  IF pg_catalog.jsonb_typeof(p_schedule) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Schedule must be an array.';
  END IF;
  IF pg_catalog.jsonb_array_length(p_schedule) > 14 THEN
    RAISE EXCEPTION 'Provide no more than 14 schedule slots.';
  END IF;

  -- A first-time row must satisfy teacher_profiles_subjects_valid on insert.
  -- On conflict, preserve the complete subject list written by the workspace RPC.
  INSERT INTO public.teacher_profiles (
    teacher_id, subject, subjects, semester, teaching_address
  )
  VALUES (
    actor_id, normalized_subject, ARRAY[normalized_subject], p_semester,
    pg_catalog.btrim(p_teaching_address)
  )
  ON CONFLICT (teacher_id) DO UPDATE
  SET subject = EXCLUDED.subject,
      semester = EXCLUDED.semester,
      teaching_address = EXCLUDED.teaching_address,
      updated_at = pg_catalog.now();

  -- Empty input means the current UI does not manage general availability;
  -- retain any legacy rows instead of deleting data as a side effect.
  IF pg_catalog.jsonb_array_length(p_schedule) > 0 THEN
    DELETE FROM public.teacher_schedule_slots WHERE teacher_id = actor_id;

    FOR schedule_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_schedule)
    LOOP
      IF pg_catalog.jsonb_typeof(schedule_item) <> 'object'
        OR COALESCE(schedule_item->>'weekday', '') !~ '^[0-6]$'
        OR COALESCE(schedule_item->>'starts_at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR COALESCE(schedule_item->>'ends_at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION 'A schedule slot has invalid day or time values.';
      END IF;

      item_weekday := (schedule_item->>'weekday')::SMALLINT;
      item_starts_at := (schedule_item->>'starts_at')::TIME;
      item_ends_at := (schedule_item->>'ends_at')::TIME;
      IF item_ends_at <= item_starts_at THEN
        RAISE EXCEPTION 'Schedule end time must be later than start time.';
      END IF;

      INSERT INTO public.teacher_schedule_slots (teacher_id, weekday, starts_at, ends_at)
      VALUES (actor_id, item_weekday, item_starts_at, item_ends_at);
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_teacher_profile(TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_profile(TEXT, TEXT, TEXT, JSONB)
  TO authenticated;
