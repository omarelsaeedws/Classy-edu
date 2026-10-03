-- Extend teacher settings and Phase 04 groups without recreating existing data.
-- Existing group IDs/details are retained; their former single weekly slot is
-- copied into teacher_group_schedule_slots before the old columns are removed.

ALTER TABLE public.teacher_profiles
  ADD COLUMN subjects TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.teacher_profiles
SET subjects = ARRAY[subject]
WHERE pg_catalog.cardinality(subjects) = 0;

ALTER TABLE public.teacher_profiles
  ADD CONSTRAINT teacher_profiles_subjects_valid CHECK (
    pg_catalog.cardinality(subjects) BETWEEN 1 AND 12
    AND pg_catalog.array_position(subjects, '') IS NULL
  );

ALTER TABLE public.teacher_groups
  ADD COLUMN subject TEXT,
  ADD COLUMN educational_stage TEXT,
  ADD COLUMN grade TEXT;

UPDATE public.teacher_groups AS g
SET subject = tp.subject
FROM public.teacher_profiles AS tp
WHERE tp.teacher_id = g.teacher_id;

ALTER TABLE public.teacher_groups
  ADD CONSTRAINT teacher_groups_subject_valid CHECK (
    subject IS NOT NULL AND pg_catalog.char_length(pg_catalog.btrim(subject)) BETWEEN 2 AND 120
  ),
  ADD CONSTRAINT teacher_groups_grade_valid CHECK (
    (educational_stage = 'ابتدائي' AND grade IN (
      'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
      'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي'
    )) OR
    (educational_stage = 'إعدادي' AND grade IN (
      'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'
    )) OR
    (educational_stage = 'ثانوي' AND grade IN (
      'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'
    )) OR
    (educational_stage IS NULL AND grade IS NULL)
  ),
  ADD CONSTRAINT teacher_groups_stage_grade_pair CHECK (
    (educational_stage IS NULL) = (grade IS NULL)
  );

CREATE TABLE public.teacher_group_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.teacher_groups(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT teacher_group_slot_time_valid CHECK (start_time < end_time),
  CONSTRAINT teacher_group_slot_start_unique UNIQUE (group_id, weekday, start_time)
);

INSERT INTO public.teacher_group_schedule_slots (group_id, weekday, start_time, end_time)
SELECT id, day_of_week, start_time, end_time FROM public.teacher_groups;

-- Existing groups have no reliable stage/grade. Retain them but deactivate them
-- until their owner assigns the correct educational stage and grade.
UPDATE public.teacher_groups SET status = 'INACTIVE'
WHERE educational_stage IS NULL OR grade IS NULL;

DROP INDEX public.teacher_groups_teacher_schedule_idx;
ALTER TABLE public.teacher_groups
  DROP COLUMN day_of_week,
  DROP COLUMN start_time,
  DROP COLUMN end_time;

CREATE INDEX teacher_group_slots_schedule_idx
  ON public.teacher_group_schedule_slots (weekday, start_time, end_time);
CREATE INDEX teacher_group_slots_group_idx
  ON public.teacher_group_schedule_slots (group_id, weekday, start_time);

ALTER TABLE public.teacher_group_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read schedules for their own groups"
  ON public.teacher_group_schedule_slots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.id = teacher_group_schedule_slots.group_id
      AND g.teacher_id = (SELECT auth.uid())
  ));

CREATE POLICY "Admins can read teacher group schedules"
  ON public.teacher_group_schedule_slots FOR SELECT TO authenticated
  USING (public.is_classy_admin());

GRANT SELECT ON public.teacher_group_schedule_slots TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.teacher_group_schedule_slots FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_teacher_workspace(
  p_full_name TEXT,
  p_phone TEXT,
  p_avatar_url TEXT,
  p_subjects TEXT[],
  p_semester TEXT,
  p_teaching_address TEXT,
  p_availability JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  normalized_name TEXT := pg_catalog.btrim(COALESCE(p_full_name, ''));
  normalized_phone TEXT := pg_catalog.btrim(COALESCE(p_phone, ''));
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF pg_catalog.char_length(normalized_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'A valid full name is required.';
  END IF;
  IF normalized_phone !~ '^01[0125][0-9]{8}$' THEN
    RAISE EXCEPTION 'A valid Egyptian mobile number is required.';
  END IF;
  IF p_subjects IS NULL OR pg_catalog.cardinality(p_subjects) NOT BETWEEN 1 AND 12
    OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_subjects) AS item
      WHERE pg_catalog.char_length(pg_catalog.btrim(item)) NOT BETWEEN 2 AND 120
    )
    OR pg_catalog.cardinality(p_subjects) <> (
      SELECT pg_catalog.count(DISTINCT pg_catalog.btrim(item))::INTEGER
      FROM pg_catalog.unnest(p_subjects) AS item
    ) THEN
    RAISE EXCEPTION 'Provide between 1 and 12 unique valid subjects.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.teacher_id = actor_id AND NOT (g.subject = ANY (
      ARRAY(SELECT pg_catalog.btrim(item) FROM pg_catalog.unnest(p_subjects) AS item)
    ))
  ) THEN
    RAISE EXCEPTION 'A subject assigned to an existing group cannot be removed.';
  END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url !~
    ('^' || actor_id::TEXT || '/[0-9a-f-]+[.](jpg|png|webp)$') THEN
    RAISE EXCEPTION 'Profile image must be uploaded to the authenticated teacher avatar folder.';
  END IF;

  PERFORM public.save_teacher_profile(
    pg_catalog.btrim(p_subjects[1]), p_semester, p_teaching_address, p_availability
  );

  UPDATE public.teacher_profiles AS tp
  SET subjects = ARRAY(SELECT pg_catalog.btrim(item) FROM pg_catalog.unnest(p_subjects) AS item)
  WHERE tp.teacher_id = actor_id;

  UPDATE public.profiles AS p
  SET full_name = normalized_name,
      phone = normalized_phone,
      avatar_url = p_avatar_url,
      updated_at = pg_catalog.now()
  WHERE p.id = actor_id AND p.role = 'TEACHER';
END;
$$;

DROP FUNCTION public.save_teacher_group(UUID, TEXT, SMALLINT, TIME, TIME, INTEGER);

CREATE OR REPLACE FUNCTION public.save_teacher_group(
  p_group_id UUID,
  p_name TEXT,
  p_subject TEXT,
  p_educational_stage TEXT,
  p_grade TEXT,
  p_schedule JSONB,
  p_max_students INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  saved_group_id UUID;
  normalized_name TEXT := pg_catalog.btrim(COALESCE(p_name, ''));
  normalized_subject TEXT := pg_catalog.btrim(COALESCE(p_subject, ''));
  slot_record RECORD;
  previous_slot RECORD;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF pg_catalog.char_length(normalized_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Group name must contain between 2 and 120 characters.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_profiles AS tp
    WHERE tp.teacher_id = actor_id AND normalized_subject = ANY(tp.subjects)
  ) THEN
    RAISE EXCEPTION 'Select a subject from your teacher profile.';
  END IF;
  IF NOT (
    (p_educational_stage = 'ابتدائي' AND p_grade IN (
      'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
      'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي'
    )) OR
    (p_educational_stage = 'إعدادي' AND p_grade IN (
      'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'
    )) OR
    (p_educational_stage = 'ثانوي' AND p_grade IN (
      'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'
    ))
  ) THEN
    RAISE EXCEPTION 'Select a valid educational stage and grade.';
  END IF;
  IF p_max_students IS NULL OR p_max_students <= 0 THEN
    RAISE EXCEPTION 'Group capacity must be greater than zero.';
  END IF;
  IF pg_catalog.jsonb_typeof(p_schedule) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Weekly class times must be an array.';
  END IF;
  IF pg_catalog.jsonb_array_length(p_schedule) NOT BETWEEN 1 AND 14 THEN
    RAISE EXCEPTION 'Provide between 1 and 14 weekly class times.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::TEXT, 0));
  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
  ) THEN
    RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.';
  END IF;

  FOR slot_record IN
    SELECT value AS slot, ordinality FROM pg_catalog.jsonb_array_elements(p_schedule) WITH ORDINALITY
  LOOP
    IF pg_catalog.jsonb_typeof(slot_record.slot) <> 'object'
      OR COALESCE(slot_record.slot->>'weekday', '') !~ '^[0-6]$'
      OR COALESCE(slot_record.slot->>'starts_at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR COALESCE(slot_record.slot->>'ends_at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (slot_record.slot->>'starts_at')::TIME >= (slot_record.slot->>'ends_at')::TIME THEN
      RAISE EXCEPTION 'A weekly class time has an invalid day or time range.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.teacher_group_schedule_slots AS s
      JOIN public.teacher_groups AS g ON g.id = s.group_id
    WHERE g.teacher_id = actor_id
      AND g.id IS DISTINCT FROM p_group_id
      AND g.status = 'ACTIVE'
      AND s.weekday = (slot_record.slot->>'weekday')::SMALLINT
        AND s.start_time < (slot_record.slot->>'ends_at')::TIME
        AND s.end_time > (slot_record.slot->>'starts_at')::TIME
    ) THEN
      RAISE EXCEPTION 'A weekly class time overlaps another group on the same day.';
    END IF;

    FOR previous_slot IN
      SELECT value AS slot FROM pg_catalog.jsonb_array_elements(p_schedule) WITH ORDINALITY
      WHERE ordinality < slot_record.ordinality
    LOOP
      IF (previous_slot.slot->>'weekday')::SMALLINT = (slot_record.slot->>'weekday')::SMALLINT
        AND (previous_slot.slot->>'starts_at')::TIME < (slot_record.slot->>'ends_at')::TIME
        AND (previous_slot.slot->>'ends_at')::TIME > (slot_record.slot->>'starts_at')::TIME THEN
        RAISE EXCEPTION 'Weekly class times in this group overlap each other.';
      END IF;
    END LOOP;
  END LOOP;

  IF p_group_id IS NULL THEN
    INSERT INTO public.teacher_groups (teacher_id, name, subject, educational_stage, grade, max_students)
    VALUES (actor_id, normalized_name, normalized_subject, p_educational_stage, p_grade, p_max_students)
    RETURNING id INTO saved_group_id;
  ELSE
    UPDATE public.teacher_groups AS g
    SET name = normalized_name, subject = normalized_subject,
        educational_stage = p_educational_stage, grade = p_grade,
        max_students = p_max_students
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
    RETURNING id INTO saved_group_id;
  END IF;

  DELETE FROM public.teacher_group_schedule_slots WHERE group_id = saved_group_id;
  INSERT INTO public.teacher_group_schedule_slots (group_id, weekday, start_time, end_time)
  SELECT saved_group_id,
         (value->>'weekday')::SMALLINT,
         (value->>'starts_at')::TIME,
         (value->>'ends_at')::TIME
  FROM pg_catalog.jsonb_array_elements(p_schedule);

  RETURN saved_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_teacher_group_status(p_group_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'Invalid group status.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
  ) THEN
    RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::TEXT, 0));
  IF p_status = 'ACTIVE' AND NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
      AND g.subject IS NOT NULL AND g.educational_stage IS NOT NULL AND g.grade IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.teacher_group_schedule_slots AS s WHERE s.group_id = g.id)
  ) THEN
    RAISE EXCEPTION 'Complete the subject, grade, and class times before activating this group.';
  END IF;
  IF p_status = 'ACTIVE' AND EXISTS (
    SELECT 1
    FROM public.teacher_group_schedule_slots AS own_slot
    JOIN public.teacher_group_schedule_slots AS other_slot
      ON other_slot.weekday = own_slot.weekday
     AND other_slot.start_time < own_slot.end_time
     AND other_slot.end_time > own_slot.start_time
    JOIN public.teacher_groups AS other_group
      ON other_group.id = other_slot.group_id
     AND other_group.teacher_id = actor_id
     AND other_group.status = 'ACTIVE'
    WHERE own_slot.group_id = p_group_id
      AND other_group.id <> p_group_id
  ) THEN
    RAISE EXCEPTION 'This group overlaps another active group on the same weekday.';
  END IF;

  UPDATE public.teacher_groups AS g SET status = p_status
  WHERE g.id = p_group_id AND g.teacher_id = actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_teacher_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  DELETE FROM public.teacher_groups AS g
  WHERE g.id = p_group_id AND g.teacher_id = actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.'; END IF;
END;
$$;

-- Portrait objects are private. Owners can upload/delete in their own folder;
-- authenticated viewers can read only active teacher portraits through signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('teacher-avatars', 'teacher-avatars', FALSE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Active teachers upload their own portrait"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    )
    AND public.is_teacher_platform_subscription_active()
  );

CREATE POLICY "Users can read portraits for active teacher profiles"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-avatars'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_classy_admin()
      OR EXISTS (
        SELECT 1 FROM public.teacher_profiles AS tp
        WHERE tp.teacher_id::TEXT = (storage.foldername(name))[1]
          AND public.is_active_teacher_profile(tp.teacher_id)
      )
    )
  );

CREATE POLICY "Active teachers remove their own portrait"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    )
    AND public.is_teacher_platform_subscription_active()
  );

REVOKE ALL ON FUNCTION public.save_teacher_workspace(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_workspace(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, JSONB)
  TO authenticated;
REVOKE ALL ON FUNCTION public.save_teacher_group(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_group(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER)
  TO authenticated;
REVOKE ALL ON FUNCTION public.set_teacher_group_status(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_teacher_group_status(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_teacher_group(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_teacher_group(UUID) TO authenticated;

COMMENT ON COLUMN public.teacher_groups.subject IS 'One of the subjects configured on the owning teacher profile.';
COMMENT ON COLUMN public.teacher_groups.educational_stage IS 'Stage taught by this group: ابتدائي, إعدادي, or ثانوي.';
COMMENT ON COLUMN public.teacher_groups.grade IS 'One grade within the selected educational stage.';
COMMENT ON TABLE public.teacher_group_schedule_slots IS
  'One group may meet on multiple recurring weekly days and times. Student capacity counting is deferred.';
