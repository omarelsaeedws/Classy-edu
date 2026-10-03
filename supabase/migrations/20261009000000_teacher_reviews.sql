-- Phase 07: reviews tied to the existing student-to-teacher subscription flow.

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT reviews_comment_valid CHECK (
    comment IS NULL OR pg_catalog.char_length(pg_catalog.btrim(comment)) BETWEEN 1 AND 1000
  ),
  CONSTRAINT reviews_one_per_student_teacher UNIQUE (student_id, teacher_id),
  CONSTRAINT reviews_subscription_owner_fk
    FOREIGN KEY (subscription_id, student_id, teacher_id)
    REFERENCES public.student_teacher_subscriptions(id, student_id, teacher_id)
    ON DELETE RESTRICT,
  CONSTRAINT reviews_teacher_is_teacher CHECK (teacher_id <> student_id)
);

CREATE INDEX reviews_teacher_newest_idx ON public.reviews (teacher_id, created_at DESC);
CREATE INDEX reviews_student_newest_idx ON public.reviews (student_id, created_at DESC);
CREATE INDEX reviews_subscription_idx ON public.reviews (subscription_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Browser writes are performed only through narrow authenticated RPCs. The
-- table exposes no student/subscription identifiers via direct SELECT grants.
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT (teacher_id, rating, comment, created_at) ON public.reviews TO authenticated;

CREATE POLICY "Students teachers and admins read authorized reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
    OR public.is_active_teacher_profile(teacher_id)
  );

CREATE OR REPLACE FUNCTION private.get_public_teacher_review_page(
  p_teacher_id UUID,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
  safe_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF p_teacher_id IS NULL OR NOT public.is_active_teacher_profile(p_teacher_id) THEN
    RAISE EXCEPTION 'Teacher not found.';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'summary', pg_catalog.jsonb_build_object(
      'average_rating', stats.average_rating,
      'review_count', stats.review_count
    ),
    'distribution', distribution.items,
    'reviews', page.items,
    'has_more', stats.review_count > safe_offset + safe_limit
  ) INTO result
  FROM (
    SELECT pg_catalog.round(pg_catalog.avg(r.rating)::NUMERIC, 1) AS average_rating,
      pg_catalog.count(*)::INTEGER AS review_count
    FROM public.reviews AS r WHERE r.teacher_id = p_teacher_id
  ) AS stats
  CROSS JOIN LATERAL (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'rating', ratings.value,
      'count', ratings.total
    ) ORDER BY ratings.value DESC), '[]'::JSONB) AS items
    FROM (
      SELECT series_values.rating AS value, COALESCE(counts.total, 0)::INTEGER AS total
      FROM pg_catalog.generate_series(1, 5) AS series_values(rating)
      LEFT JOIN (
        SELECT r.rating, pg_catalog.count(*) AS total
        FROM public.reviews AS r WHERE r.teacher_id = p_teacher_id
        GROUP BY r.rating
      ) AS counts ON counts.rating = series_values.rating
    ) AS ratings
  ) AS distribution
  CROSS JOIN LATERAL (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'display_name', COALESCE(NULLIF(pg_catalog.btrim(student.full_name), ''), 'طالب'),
      'rating', review.rating,
      'comment', review.comment,
      'created_at', review.created_at
    ) ORDER BY review.created_at DESC), '[]'::JSONB) AS items
    FROM (
      SELECT r.student_id, r.rating, r.comment, r.created_at
      FROM public.reviews AS r
      WHERE r.teacher_id = p_teacher_id
      ORDER BY r.created_at DESC
      OFFSET safe_offset LIMIT safe_limit
    ) AS review
    JOIN public.profiles AS student ON student.id = review.student_id
  ) AS page;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_public_teacher_review_summaries(p_teacher_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result JSONB;
BEGIN
  IF p_teacher_ids IS NULL OR pg_catalog.cardinality(p_teacher_ids) > 100 THEN
    RAISE EXCEPTION 'A valid teacher list is required.';
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'teacher_id', requested.teacher_id,
    'average_rating', stats.average_rating,
    'review_count', stats.review_count
  ) ORDER BY requested.teacher_id), '[]'::JSONB)
  INTO result
  FROM (SELECT DISTINCT pg_catalog.unnest(p_teacher_ids) AS teacher_id) AS requested
  JOIN LATERAL (
    SELECT pg_catalog.round(pg_catalog.avg(r.rating)::NUMERIC, 1) AS average_rating,
      pg_catalog.count(*)::INTEGER AS review_count
    FROM public.reviews AS r WHERE r.teacher_id = requested.teacher_id
  ) AS stats ON TRUE
  WHERE public.is_active_teacher_profile(requested.teacher_id);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.fetch_public_teacher_profile(p_teacher_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result JSONB;
BEGIN
  IF p_teacher_id IS NULL OR NOT public.is_active_teacher_profile(p_teacher_id) THEN
    RETURN NULL;
  END IF;
  SELECT pg_catalog.jsonb_build_object(
    'teacher_id', teacher.id,
    'full_name', teacher.full_name,
    'avatar_path', teacher.avatar_url,
    'subjects', profile.subjects,
    'teaching_area', profile.teaching_area,
    'teaching_address', profile.teaching_address,
    'lesson_title', profile.lesson_title,
    'bio', profile.bio,
    'monthly_price', profile.monthly_price,
    'groups', COALESCE(groups.items, '[]'::JSONB)
  ) INTO result
  FROM public.profiles AS teacher
  JOIN public.teacher_profiles AS profile ON profile.teacher_id = teacher.id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', group_row.id,
      'name', group_row.name,
      'subject', group_row.subject,
      'educational_stage', group_row.educational_stage,
      'grade', group_row.grade,
      'max_students', group_row.max_students,
      'active_students', counts.total,
      'available_seats', GREATEST(group_row.max_students - counts.total, 0),
      'my_subscription_status', NULL,
      'schedule', COALESCE(schedule.items, '[]'::JSONB)
    ) ORDER BY group_row.created_at DESC, group_row.name) AS items
    FROM public.teacher_groups AS group_row
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*)::INTEGER AS total
      FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.group_id = group_row.id AND subscription.status = 'ACTIVE'
        AND subscription.expires_at > pg_catalog.now()
    ) AS counts
    CROSS JOIN LATERAL (
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'weekday', slot.weekday, 'start_time', slot.start_time, 'end_time', slot.end_time
      ) ORDER BY slot.weekday, slot.start_time), '[]'::JSONB) AS items
      FROM public.teacher_group_schedule_slots AS slot WHERE slot.group_id = group_row.id
    ) AS schedule
    WHERE group_row.teacher_id = teacher.id AND group_row.status = 'ACTIVE'
  ) AS groups
  WHERE teacher.id = p_teacher_id AND teacher.role = 'TEACHER'
    AND teacher.teacher_status = 'ACTIVE'
    AND profile.monthly_price > 0
    AND pg_catalog.cardinality(profile.subjects) > 0
    AND EXISTS (SELECT 1 FROM public.teacher_student_payment_methods AS method
      WHERE method.teacher_id = teacher.id AND method.is_active);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_student_teacher_review(p_teacher_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  eligible_subscription UUID;
  own_review JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  SELECT subscription.id INTO eligible_subscription
  FROM public.student_teacher_subscriptions AS subscription
  WHERE subscription.student_id = actor_id AND subscription.teacher_id = p_teacher_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED')
    AND subscription.approved_at IS NOT NULL
  ORDER BY subscription.approved_at DESC, subscription.created_at DESC
  LIMIT 1;
  SELECT pg_catalog.jsonb_build_object(
    'id', review.id, 'rating', review.rating, 'comment', review.comment,
    'created_at', review.created_at, 'updated_at', review.updated_at
  ) INTO own_review
  FROM public.reviews AS review
  WHERE review.student_id = actor_id AND review.teacher_id = p_teacher_id;
  RETURN pg_catalog.jsonb_build_object(
    'eligible', eligible_subscription IS NOT NULL,
    'review', own_review
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.create_student_teacher_review(
  p_teacher_id UUID, p_rating NUMERIC, p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  eligible_subscription UUID;
  new_review_id UUID;
  normalized_comment TEXT := NULLIF(pg_catalog.btrim(p_comment), '');
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_rating <> pg_catalog.trunc(p_rating) THEN
    RAISE EXCEPTION 'Rating must be a whole number between 1 and 5.';
  END IF;
  IF normalized_comment IS NOT NULL AND pg_catalog.char_length(normalized_comment) > 1000 THEN
    RAISE EXCEPTION 'Review comment cannot exceed 1000 characters.';
  END IF;
  IF p_teacher_id IS NULL OR p_teacher_id = actor_id OR NOT public.is_active_teacher_profile(p_teacher_id) THEN
    RAISE EXCEPTION 'Teacher not found.';
  END IF;
  SELECT subscription.id INTO eligible_subscription
  FROM public.student_teacher_subscriptions AS subscription
  WHERE subscription.student_id = actor_id AND subscription.teacher_id = p_teacher_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED') AND subscription.approved_at IS NOT NULL
  ORDER BY subscription.approved_at DESC, subscription.created_at DESC LIMIT 1;
  IF eligible_subscription IS NULL THEN RAISE EXCEPTION 'An eligible teacher subscription is required.'; END IF;
  INSERT INTO public.reviews (student_id, teacher_id, subscription_id, rating, comment)
  VALUES (actor_id, p_teacher_id, eligible_subscription, p_rating::SMALLINT, normalized_comment)
  RETURNING id INTO new_review_id;
  RETURN new_review_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A review already exists for this teacher.';
END;
$$;

CREATE OR REPLACE FUNCTION private.update_student_teacher_review(
  p_review_id UUID, p_rating NUMERIC, p_comment TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  normalized_comment TEXT := NULLIF(pg_catalog.btrim(p_comment), '');
  target_teacher UUID;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_rating <> pg_catalog.trunc(p_rating) THEN
    RAISE EXCEPTION 'Rating must be a whole number between 1 and 5.';
  END IF;
  IF normalized_comment IS NOT NULL AND pg_catalog.char_length(normalized_comment) > 1000 THEN
    RAISE EXCEPTION 'Review comment cannot exceed 1000 characters.';
  END IF;
  SELECT review.teacher_id INTO target_teacher
  FROM public.reviews AS review
  WHERE review.id = p_review_id AND review.student_id = actor_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.student_id = actor_id AND subscription.teacher_id = target_teacher
      AND subscription.status IN ('ACTIVE', 'EXPIRED') AND subscription.approved_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'An eligible teacher subscription is required.'; END IF;
  UPDATE public.reviews SET rating = p_rating::SMALLINT, comment = normalized_comment,
    updated_at = pg_catalog.now()
  WHERE id = p_review_id AND student_id = actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.list_student_reviews()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', review.id, 'teacher_id', teacher.id, 'teacher_name', teacher.full_name,
    'lesson_title', profile.lesson_title, 'rating', review.rating,
    'comment', review.comment, 'created_at', review.created_at,
    'updated_at', review.updated_at
  ) ORDER BY review.updated_at DESC), '[]'::JSONB) INTO result
  FROM public.reviews AS review
  JOIN public.profiles AS teacher ON teacher.id = review.teacher_id
  LEFT JOIN public.teacher_profiles AS profile ON profile.teacher_id = teacher.id
  WHERE review.student_id = actor_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_review_dashboard()
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
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'TEACHER'
  ) THEN RAISE EXCEPTION 'A teacher account is required.'; END IF;
  SELECT pg_catalog.jsonb_build_object(
    'average_rating', stats.average_rating,
    'review_count', stats.review_count,
    'recent_reviews', COALESCE(recent.items, '[]'::JSONB)
  ) INTO result
  FROM (
    SELECT pg_catalog.round(pg_catalog.avg(review.rating)::NUMERIC, 1) AS average_rating,
      pg_catalog.count(*)::INTEGER AS review_count
    FROM public.reviews AS review WHERE review.teacher_id = actor_id
  ) AS stats
  CROSS JOIN LATERAL (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'display_name', COALESCE(NULLIF(pg_catalog.btrim(student.full_name), ''), 'طالب'),
      'rating', review.rating, 'comment', review.comment, 'created_at', review.created_at
    ) ORDER BY review.created_at DESC) AS items
    FROM (
      SELECT * FROM public.reviews AS r WHERE r.teacher_id = actor_id
      ORDER BY r.created_at DESC LIMIT 5
    ) AS review
    JOIN public.profiles AS student ON student.id = review.student_id
  ) AS recent;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_reviews(
  p_teacher_id UUID, p_offset INTEGER DEFAULT 0, p_limit INTEGER DEFAULT 10
)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_public_teacher_review_page(p_teacher_id, p_offset, p_limit)
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_review_summaries(p_teacher_ids UUID[])
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_public_teacher_review_summaries(p_teacher_ids)
$$;

CREATE OR REPLACE FUNCTION public.get_student_teacher_review(p_teacher_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.get_student_teacher_review(p_teacher_id)
$$;

CREATE OR REPLACE FUNCTION public.create_student_teacher_review(
  p_teacher_id UUID, p_rating NUMERIC, p_comment TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.create_student_teacher_review(p_teacher_id, p_rating, p_comment)
$$;

CREATE OR REPLACE FUNCTION public.update_student_teacher_review(
  p_review_id UUID, p_rating NUMERIC, p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE SQL SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.update_student_teacher_review(p_review_id, p_rating, p_comment)
$$;

CREATE OR REPLACE FUNCTION public.list_student_reviews()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.list_student_reviews()
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_review_dashboard()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.get_teacher_review_dashboard()
$$;

CREATE OR REPLACE FUNCTION public.get_public_teacher_profile(p_teacher_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.fetch_public_teacher_profile(p_teacher_id)
$$;

REVOKE ALL ON FUNCTION private.get_public_teacher_review_page(UUID, INTEGER, INTEGER),
  private.get_public_teacher_review_summaries(UUID[]), private.fetch_public_teacher_profile(UUID),
  private.get_student_teacher_review(UUID),
  private.create_student_teacher_review(UUID, NUMERIC, TEXT),
  private.update_student_teacher_review(UUID, NUMERIC, TEXT), private.list_student_reviews(),
  private.get_teacher_review_dashboard()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_student_teacher_review(UUID),
  private.create_student_teacher_review(UUID, NUMERIC, TEXT),
  private.update_student_teacher_review(UUID, NUMERIC, TEXT),
  private.list_student_reviews(), private.get_teacher_review_dashboard()
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_teacher_reviews(UUID, INTEGER, INTEGER),
  public.get_public_teacher_review_summaries(UUID[]), public.get_public_teacher_profile(UUID),
  public.get_student_teacher_review(UUID), public.create_student_teacher_review(UUID, NUMERIC, TEXT),
  public.update_student_teacher_review(UUID, NUMERIC, TEXT), public.list_student_reviews(),
  public.get_teacher_review_dashboard()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_teacher_reviews(UUID, INTEGER, INTEGER),
  public.get_public_teacher_review_summaries(UUID[]), public.get_public_teacher_profile(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_teacher_review(UUID),
  public.create_student_teacher_review(UUID, NUMERIC, TEXT),
  public.update_student_teacher_review(UUID, NUMERIC, TEXT), public.list_student_reviews(),
  public.get_teacher_review_dashboard()
  TO authenticated;

COMMENT ON TABLE public.reviews IS
  'One review per student/teacher, tied by composite foreign key to the existing student teacher subscription. Browser writes use authenticated review RPCs only.';
