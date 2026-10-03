-- Public professional profile details and weekly schedule for active teachers.
-- Student reviews are deliberately excluded until student-to-teacher subscriptions exist.

CREATE TABLE public.teacher_profiles (
  teacher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(subject)) BETWEEN 2 AND 120),
  semester TEXT NOT NULL CHECK (semester IN ('FIRST', 'SECOND', 'BOTH')),
  teaching_address TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(teaching_address)) BETWEEN 5 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.teacher_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teacher_profiles(teacher_id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL CHECK (ends_at > starts_at),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT teacher_schedule_start_unique UNIQUE (teacher_id, weekday, starts_at)
);

CREATE INDEX teacher_schedule_slots_teacher_day_idx
  ON public.teacher_schedule_slots (teacher_id, weekday, starts_at);

CREATE OR REPLACE FUNCTION public.is_active_teacher_profile(p_teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.teacher_platform_subscriptions AS s ON s.teacher_id = p.id
    WHERE p.id = p_teacher_id
      AND p.role = 'TEACHER'
      AND p.teacher_status = 'ACTIVE'
      AND s.status = 'APPROVED'
      AND s.expires_at > pg_catalog.now()
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_teacher_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_teacher_profile(UUID) TO authenticated;

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active teacher profiles"
  ON public.teacher_profiles FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
    OR public.is_active_teacher_profile(teacher_profiles.teacher_id)
  );

CREATE POLICY "Authenticated users can view active teacher schedules"
  ON public.teacher_schedule_slots FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
    OR public.is_active_teacher_profile(teacher_schedule_slots.teacher_id)
  );

GRANT SELECT ON public.teacher_profiles, public.teacher_schedule_slots TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.teacher_profiles, public.teacher_schedule_slots
  FROM PUBLIC, anon, authenticated;

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
  actor_id UUID := auth.uid();
  schedule_item JSONB;
  item_weekday SMALLINT;
  item_starts_at TIME;
  item_ends_at TIME;
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

  IF p_subject IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_subject)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'A valid subject is required.';
  END IF;
  IF p_semester IS NULL OR p_semester NOT IN ('FIRST', 'SECOND', 'BOTH') THEN
    RAISE EXCEPTION 'A valid semester is required.';
  END IF;
  IF p_teaching_address IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_teaching_address)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'A valid teaching address is required.';
  END IF;
  IF pg_catalog.jsonb_typeof(p_schedule) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Schedule must be an array.';
  END IF;
  IF pg_catalog.jsonb_array_length(p_schedule) NOT BETWEEN 1 AND 14 THEN
    RAISE EXCEPTION 'Provide between 1 and 14 schedule slots.';
  END IF;

  INSERT INTO public.teacher_profiles (teacher_id, subject, semester, teaching_address)
  VALUES (actor_id, pg_catalog.btrim(p_subject), p_semester, pg_catalog.btrim(p_teaching_address))
  ON CONFLICT (teacher_id) DO UPDATE
  SET subject = EXCLUDED.subject,
      semester = EXCLUDED.semester,
      teaching_address = EXCLUDED.teaching_address,
      updated_at = pg_catalog.now();

  DELETE FROM public.teacher_schedule_slots WHERE teacher_id = actor_id;

  FOR schedule_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_schedule)
  LOOP
    IF pg_catalog.jsonb_typeof(schedule_item) <> 'object'
      OR COALESCE(schedule_item->>'weekday', '') !~ '^[0-6]$'
      OR COALESCE(schedule_item->>'starts_at', '') !~ '^[0-2][0-9]:[0-5][0-9]$'
      OR COALESCE(schedule_item->>'ends_at', '') !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
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
END;
$$;

REVOKE ALL ON FUNCTION public.save_teacher_profile(TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_profile(TEXT, TEXT, TEXT, JSONB)
  TO authenticated;

COMMENT ON TABLE public.teacher_profiles IS
  'Professional profile details visible to authenticated users when the teacher is active.';
COMMENT ON TABLE public.teacher_schedule_slots IS
  'Weekly lesson availability for active teachers; all writes go through save_teacher_profile.';
