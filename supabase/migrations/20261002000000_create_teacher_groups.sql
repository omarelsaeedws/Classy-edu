-- Classy Phase 04: teacher-owned recurring groups.
-- Student subscriptions and attendance are intentionally outside this migration.

CREATE TABLE public.teacher_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(name)) BETWEEN 2 AND 120),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_students INTEGER NOT NULL CHECK (max_students > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT teacher_group_valid_time CHECK (start_time < end_time)
);

CREATE INDEX teacher_groups_teacher_schedule_idx
  ON public.teacher_groups (teacher_id, day_of_week, start_time);
CREATE INDEX teacher_groups_teacher_status_idx
  ON public.teacher_groups (teacher_id, status);

CREATE TRIGGER teacher_groups_updated_at
  BEFORE UPDATE ON public.teacher_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();

ALTER TABLE public.teacher_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read their own groups"
  ON public.teacher_groups FOR SELECT TO authenticated
  USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can read teacher groups"
  ON public.teacher_groups FOR SELECT TO authenticated
  USING (public.is_classy_admin());

GRANT SELECT ON public.teacher_groups TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.teacher_groups FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_teacher_group(
  p_group_id UUID,
  p_name TEXT,
  p_day_of_week SMALLINT,
  p_start_time TIME,
  p_end_time TIME,
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
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF pg_catalog.char_length(normalized_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Group name must contain between 2 and 120 characters.';
  END IF;
  IF p_day_of_week IS NULL OR p_day_of_week NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'A valid weekday is required.';
  END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL OR p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Group end time must be later than its start time.';
  END IF;
  IF p_max_students IS NULL OR p_max_students <= 0 THEN
    RAISE EXCEPTION 'Group capacity must be greater than zero.';
  END IF;

  -- Serialize this teacher's schedule writes so concurrent requests cannot
  -- create overlapping groups after both pass the overlap check.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::TEXT, 0));

  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
  ) THEN
    RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teacher_groups AS g
    WHERE g.teacher_id = actor_id
      AND g.day_of_week = p_day_of_week
      AND g.id IS DISTINCT FROM p_group_id
      AND g.start_time < p_end_time
      AND g.end_time > p_start_time
  ) THEN
    RAISE EXCEPTION 'This group overlaps another group on the same weekday.';
  END IF;

  IF p_group_id IS NULL THEN
    INSERT INTO public.teacher_groups (teacher_id, name, day_of_week, start_time, end_time, max_students)
    VALUES (actor_id, normalized_name, p_day_of_week, p_start_time, p_end_time, p_max_students)
    RETURNING id INTO saved_group_id;
  ELSE
    UPDATE public.teacher_groups AS g
    SET name = normalized_name,
        day_of_week = p_day_of_week,
        start_time = p_start_time,
        end_time = p_end_time,
        max_students = p_max_students
    WHERE g.id = p_group_id AND g.teacher_id = actor_id
    RETURNING id INTO saved_group_id;
  END IF;

  RETURN saved_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_teacher_group_status(p_group_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'Invalid group status.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
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
DECLARE
  actor_id UUID := (SELECT auth.uid());
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

REVOKE ALL ON FUNCTION public.save_teacher_group(UUID, TEXT, SMALLINT, TIME, TIME, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_group(UUID, TEXT, SMALLINT, TIME, TIME, INTEGER)
  TO authenticated;
REVOKE ALL ON FUNCTION public.set_teacher_group_status(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_teacher_group_status(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_teacher_group(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_teacher_group(UUID) TO authenticated;

COMMENT ON TABLE public.teacher_groups IS
  'Teacher-owned recurring weekly groups. Student subscriptions and capacity enforcement are added in later phases.';
