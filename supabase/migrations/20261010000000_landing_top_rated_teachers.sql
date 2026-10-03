-- Public landing-page preview: expose only four active, complete teacher cards
-- and their aggregate review scores. Depends on Phase 07's public.reviews table.

CREATE OR REPLACE FUNCTION private.fetch_landing_teacher_preview()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'teacher_id', eligible.teacher_id,
        'full_name', eligible.full_name,
        'avatar_path', eligible.avatar_path,
        'subjects', eligible.subjects,
        'teaching_area', eligible.teaching_area,
        'lesson_title', eligible.lesson_title,
        'monthly_price', eligible.monthly_price,
        'average_rating', eligible.average_rating,
        'review_count', eligible.review_count
      ) ORDER BY eligible.average_rating DESC NULLS LAST,
        eligible.review_count DESC,
        eligible.full_name
    ),
    '[]'::JSONB
  )
  FROM (
    SELECT
      teacher.id AS teacher_id,
      teacher.full_name,
      teacher.avatar_url AS avatar_path,
      profile.subjects,
      profile.teaching_area,
      profile.lesson_title,
      profile.monthly_price,
      reviews.average_rating,
      reviews.review_count
    FROM public.profiles AS teacher
    JOIN public.teacher_profiles AS profile ON profile.teacher_id = teacher.id
    CROSS JOIN LATERAL (
      SELECT
        pg_catalog.round(pg_catalog.avg(review.rating)::NUMERIC, 1) AS average_rating,
        pg_catalog.count(*)::INTEGER AS review_count
      FROM public.reviews AS review
      WHERE review.teacher_id = teacher.id
    ) AS reviews
    WHERE teacher.role = 'TEACHER'
      AND public.is_active_teacher_profile(teacher.id)
      AND pg_catalog.char_length(pg_catalog.btrim(teacher.full_name)) >= 2
      AND pg_catalog.cardinality(profile.subjects) > 0
      AND pg_catalog.char_length(pg_catalog.btrim(profile.lesson_title)) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(profile.teaching_area)) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(profile.teaching_address)) >= 5
      AND profile.monthly_price > 0
      AND EXISTS (
        SELECT 1
        FROM public.teacher_groups AS group_row
        WHERE group_row.teacher_id = teacher.id
          AND group_row.status = 'ACTIVE'
      )
      AND EXISTS (
        SELECT 1
        FROM public.teacher_student_payment_methods AS method
        WHERE method.teacher_id = teacher.id
          AND method.is_active
      )
    ORDER BY reviews.average_rating DESC NULLS LAST,
      reviews.review_count DESC,
      teacher.full_name
    LIMIT 4
  ) AS eligible;
$$;

-- Keep the avatar bucket private while allowing anonymous viewers to request
-- signed URLs only for the current portrait of an active teacher.
CREATE OR REPLACE FUNCTION private.can_read_public_teacher_avatar(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS teacher
    WHERE teacher.role = 'TEACHER'
      AND teacher.avatar_url = p_object_name
      AND pg_catalog.split_part(p_object_name, '/', 1) = teacher.id::TEXT
      AND public.is_active_teacher_profile(teacher.id)
  );
$$;

REVOKE ALL ON FUNCTION private.can_read_public_teacher_avatar(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_public_teacher_avatar(TEXT) TO anon, authenticated;

CREATE POLICY "Anyone can sign portraits of active teachers"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'teacher-avatars'
    AND private.can_read_public_teacher_avatar(name)
  );

GRANT SELECT ON storage.objects TO anon;

CREATE OR REPLACE FUNCTION public.get_landing_teacher_preview()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.fetch_landing_teacher_preview()
$$;

REVOKE ALL ON FUNCTION private.fetch_landing_teacher_preview()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_landing_teacher_preview()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_landing_teacher_preview() TO anon, authenticated;

COMMENT ON FUNCTION public.get_landing_teacher_preview() IS
  'Returns at most four active, fully configured teachers ordered by actual student review average; includes only the current portrait path and excludes payment data.';
