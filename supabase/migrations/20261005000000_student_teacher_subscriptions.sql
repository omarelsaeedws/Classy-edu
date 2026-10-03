-- Phase 05: student discovery and student-to-teacher subscriptions.
-- This payment flow is separate from teacher subscriptions to the Classy platform.

ALTER TABLE public.teacher_profiles
  ADD COLUMN bio TEXT NOT NULL DEFAULT '',
  ADD COLUMN lesson_title TEXT,
  ADD COLUMN monthly_price NUMERIC(10, 2),
  ADD COLUMN teaching_area TEXT NOT NULL DEFAULT 'أبو كبير',
  ADD CONSTRAINT teacher_profiles_bio_length CHECK (pg_catalog.char_length(bio) <= 2000),
  ADD CONSTRAINT teacher_profiles_lesson_title_length CHECK (
    lesson_title IS NULL OR pg_catalog.char_length(pg_catalog.btrim(lesson_title)) BETWEEN 2 AND 160
  ),
  ADD CONSTRAINT teacher_profiles_monthly_price_positive CHECK (monthly_price IS NULL OR monthly_price > 0),
  ADD CONSTRAINT teacher_profiles_teaching_area_length CHECK (
    pg_catalog.char_length(pg_catalog.btrim(teaching_area)) BETWEEN 2 AND 120
  );

CREATE INDEX teacher_profiles_monthly_price_idx
  ON public.teacher_profiles (monthly_price)
  WHERE monthly_price IS NOT NULL;
CREATE INDEX teacher_profiles_teaching_area_idx
  ON public.teacher_profiles (teaching_area);
CREATE INDEX teacher_groups_discovery_idx
  ON public.teacher_groups (educational_stage, grade, subject, teacher_id)
  WHERE status = 'ACTIVE';

ALTER TABLE public.teacher_groups
  ADD CONSTRAINT teacher_groups_id_teacher_id_key UNIQUE (id, teacher_id);

CREATE TABLE public.teacher_student_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'INSTAPAY', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH', 'WE_PAY'
  )),
  account_holder TEXT NOT NULL CHECK (
    pg_catalog.char_length(pg_catalog.btrim(account_holder)) BETWEEN 2 AND 120
  ),
  account_identifier TEXT NOT NULL CHECK (
    pg_catalog.char_length(pg_catalog.btrim(account_identifier)) BETWEEN 3 AND 160
  ),
  instructions TEXT CHECK (instructions IS NULL OR pg_catalog.char_length(instructions) <= 1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT teacher_student_payment_methods_id_teacher_key UNIQUE (id, teacher_id)
);

CREATE UNIQUE INDEX teacher_student_payment_methods_identity_uidx
  ON public.teacher_student_payment_methods (teacher_id, provider, account_identifier);
CREATE INDEX teacher_student_payment_methods_active_teacher_idx
  ON public.teacher_student_payment_methods (teacher_id)
  WHERE is_active;

CREATE TABLE public.student_teacher_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  group_id UUID NOT NULL,
  monthly_price_snapshot NUMERIC(10, 2) NOT NULL CHECK (monthly_price_snapshot > 0),
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN (
    'PENDING_PAYMENT', 'UNDER_REVIEW', 'ACTIVE', 'REJECTED', 'CANCELLED', 'EXPIRED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(rejection_reason)) BETWEEN 3 AND 1000
  ),
  CONSTRAINT student_teacher_subscription_group_owner_fk
    FOREIGN KEY (group_id, teacher_id)
    REFERENCES public.teacher_groups(id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_subscription_id_student_teacher_key UNIQUE (id, student_id, teacher_id),
  CONSTRAINT student_teacher_active_dates_valid CHECK (
    status <> 'ACTIVE' OR (started_at IS NOT NULL AND expires_at > started_at AND approved_at IS NOT NULL)
  ),
  CONSTRAINT student_teacher_rejection_fields_valid CHECK (
    status <> 'REJECTED' OR (rejected_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX student_teacher_one_active_group_uidx
  ON public.student_teacher_subscriptions (student_id, group_id)
  WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX student_teacher_one_open_request_uidx
  ON public.student_teacher_subscriptions (student_id, group_id)
  WHERE status IN ('PENDING_PAYMENT', 'UNDER_REVIEW');
CREATE INDEX student_teacher_subscriptions_student_idx
  ON public.student_teacher_subscriptions (student_id, created_at DESC);
CREATE INDEX student_teacher_subscriptions_teacher_idx
  ON public.student_teacher_subscriptions (teacher_id, status, created_at DESC);
CREATE INDEX student_teacher_subscriptions_group_active_idx
  ON public.student_teacher_subscriptions (group_id, expires_at)
  WHERE status = 'ACTIVE';

CREATE TABLE public.student_teacher_payments (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  payment_method_id UUID NOT NULL,
  transferred_amount NUMERIC(10, 2) NOT NULL CHECK (transferred_amount > 0),
  receipt_path TEXT NOT NULL UNIQUE,
  provider_snapshot TEXT NOT NULL CHECK (provider_snapshot IN (
    'INSTAPAY', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH', 'WE_PAY'
  )),
  account_holder_snapshot TEXT NOT NULL,
  account_identifier_snapshot TEXT NOT NULL,
  instructions_snapshot TEXT,
  notes TEXT CHECK (notes IS NULL OR pg_catalog.char_length(notes) <= 1000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(rejection_reason)) BETWEEN 3 AND 1000
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_payment_one_per_request UNIQUE (subscription_id),
  CONSTRAINT student_teacher_payment_subscription_owner_fk
    FOREIGN KEY (subscription_id, student_id, teacher_id)
    REFERENCES public.student_teacher_subscriptions(id, student_id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_payment_method_owner_fk
    FOREIGN KEY (payment_method_id, teacher_id)
    REFERENCES public.teacher_student_payment_methods(id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_payment_review_fields_valid CHECK (
    (status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL)
    OR (status = 'APPROVED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NULL)
    OR (status = 'REJECTED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE INDEX student_teacher_payments_student_idx
  ON public.student_teacher_payments (student_id, submitted_at DESC);
CREATE INDEX student_teacher_payments_teacher_review_idx
  ON public.student_teacher_payments (teacher_id, submitted_at DESC)
  WHERE status = 'PENDING';

CREATE TRIGGER teacher_student_payment_methods_updated_at
  BEFORE UPDATE ON public.teacher_student_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER student_teacher_subscriptions_updated_at
  BEFORE UPDATE ON public.student_teacher_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER student_teacher_payments_updated_at
  BEFORE UPDATE ON public.student_teacher_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();

ALTER TABLE public.teacher_student_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own student payment methods"
  ON public.teacher_student_payment_methods FOR ALL TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    )
    AND public.is_teacher_platform_subscription_active()
  )
  WITH CHECK (
    teacher_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    )
    AND public.is_teacher_platform_subscription_active()
  );

CREATE POLICY "Students and relevant teachers read student subscriptions"
  ON public.student_teacher_subscriptions FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
  );
CREATE POLICY "Students and relevant teachers read student payments"
  ON public.student_teacher_payments FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR teacher_id = (SELECT auth.uid())
    OR public.is_classy_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_student_payment_methods TO authenticated;
GRANT SELECT ON public.student_teacher_subscriptions, public.student_teacher_payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.student_teacher_subscriptions, public.student_teacher_payments
  FROM PUBLIC, anon, authenticated;

-- Do not let a student alter onboarding state or academic eligibility directly
-- through the profiles table after onboarding has been completed.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF OLD.role IS DISTINCT FROM NEW.role
      OR OLD.teacher_status IS DISTINCT FROM NEW.teacher_status
      OR OLD.profile_setup_completed IS DISTINCT FROM NEW.profile_setup_completed
      OR OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed THEN
      RAISE EXCEPTION 'Protected profile state cannot be changed directly.';
    END IF;
    IF OLD.role = 'STUDENT' AND OLD.onboarding_completed
      AND (OLD.stage IS DISTINCT FROM NEW.stage OR OLD.grade IS DISTINCT FROM NEW.grade) THEN
      RAISE EXCEPTION 'Student educational eligibility cannot be changed after onboarding.';
    END IF;
  END IF;

  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_student_onboarding(
  p_stage TEXT,
  p_grade TEXT,
  p_subjects TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'STUDENT'
      AND p.profile_setup_completed AND NOT p.onboarding_completed
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
  IF p_subjects IS NULL OR pg_catalog.cardinality(p_subjects) NOT BETWEEN 1 AND 12
    OR EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_subjects) AS subject_name
      WHERE pg_catalog.char_length(pg_catalog.btrim(subject_name)) NOT BETWEEN 2 AND 120
    )
    OR pg_catalog.cardinality(p_subjects) <> (
      SELECT pg_catalog.count(DISTINCT pg_catalog.btrim(subject_name))::INTEGER
      FROM pg_catalog.unnest(p_subjects) AS subject_name
    ) THEN
    RAISE EXCEPTION 'Select between 1 and 12 unique valid subjects.';
  END IF;

  UPDATE public.profiles AS p
  SET stage = p_stage,
      grade = p_grade,
      subjects = ARRAY(SELECT pg_catalog.btrim(s) FROM pg_catalog.unnest(p_subjects) AS s),
      onboarding_completed = TRUE,
      updated_at = pg_catalog.now()
  WHERE p.id = actor_id AND p.role = 'STUDENT' AND NOT p.onboarding_completed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student onboarding is already complete.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_onboarding(TEXT, TEXT, TEXT[])
  TO authenticated;

-- New teacher public fields are saved alongside the existing protected workspace RPC.
CREATE OR REPLACE FUNCTION public.save_teacher_workspace_phase05(
  p_full_name TEXT,
  p_phone TEXT,
  p_avatar_path TEXT,
  p_subjects TEXT[],
  p_semester TEXT,
  p_teaching_address TEXT,
  p_bio TEXT,
  p_lesson_title TEXT,
  p_teaching_area TEXT,
  p_monthly_price NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  normalized_bio TEXT := pg_catalog.btrim(COALESCE(p_bio, ''));
  normalized_lesson_title TEXT := pg_catalog.btrim(COALESCE(p_lesson_title, ''));
  normalized_area TEXT := pg_catalog.btrim(COALESCE(p_teaching_area, ''));
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF pg_catalog.char_length(normalized_lesson_title) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'A lesson title between 2 and 160 characters is required.';
  END IF;
  IF pg_catalog.char_length(normalized_bio) > 2000 THEN
    RAISE EXCEPTION 'Teacher bio cannot exceed 2000 characters.';
  END IF;
  IF pg_catalog.char_length(normalized_area) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'A valid teaching area in Abu Kebir is required.';
  END IF;
  IF p_monthly_price IS NULL OR p_monthly_price <= 0 OR p_monthly_price > 100000 THEN
    RAISE EXCEPTION 'Monthly price must be between 0 and 100000 EGP.';
  END IF;

  PERFORM public.save_teacher_workspace(
    p_full_name, p_phone, p_avatar_path, p_subjects, p_semester,
    p_teaching_address, '[]'::JSONB
  );

  UPDATE public.teacher_profiles AS tp
  SET bio = normalized_bio,
      lesson_title = normalized_lesson_title,
      teaching_area = normalized_area,
      monthly_price = p_monthly_price,
      updated_at = pg_catalog.now()
  WHERE tp.teacher_id = actor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_teacher_workspace_phase05(
  TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_teacher_workspace_phase05(
  TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO authenticated;

-- Student-safe public discovery. The function only returns complete, active
-- teachers and groups matching the caller's stored stage and grade.
CREATE OR REPLACE FUNCTION public.list_student_teachers(
  p_stage TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  teacher_id UUID,
  full_name TEXT,
  avatar_path TEXT,
  subjects TEXT[],
  teaching_area TEXT,
  teaching_address TEXT,
  lesson_title TEXT,
  bio TEXT,
  monthly_price NUMERIC,
  groups JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS student
    WHERE student.id = actor_id AND student.role = 'STUDENT'
      AND student.profile_setup_completed AND student.onboarding_completed
      AND student.stage IS NOT NULL AND student.grade IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A completed student profile is required.';
  END IF;

  RETURN QUERY
  WITH student_context AS (
    SELECT p.stage, p.grade FROM public.profiles AS p WHERE p.id = actor_id
  ), eligible_groups AS (
    SELECT
      teacher.id AS teacher_id,
      teacher.full_name,
      teacher.avatar_url AS avatar_path,
      tp.subjects,
      tp.teaching_area,
      tp.teaching_address,
      tp.lesson_title,
      tp.bio,
      tp.monthly_price,
      g.name AS group_name,
      g.created_at AS group_created_at,
      pg_catalog.jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'subject', g.subject,
        'educational_stage', g.educational_stage,
        'grade', g.grade,
        'max_students', g.max_students,
        'active_students', counts.active_count,
        'available_seats', GREATEST(g.max_students - counts.active_count, 0),
        'schedule', COALESCE(schedule.slots, '[]'::JSONB)
      ) AS group_data
    FROM public.profiles AS teacher
    JOIN public.teacher_profiles AS tp ON tp.teacher_id = teacher.id
    JOIN public.teacher_groups AS g ON g.teacher_id = teacher.id AND g.status = 'ACTIVE'
    CROSS JOIN student_context AS sc
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*)::INTEGER AS active_count
      FROM public.student_teacher_subscriptions AS st
      WHERE st.group_id = g.id AND st.status = 'ACTIVE' AND st.expires_at > pg_catalog.now()
    ) AS counts
    CROSS JOIN LATERAL (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'weekday', slot.weekday,
          'start_time', slot.start_time,
          'end_time', slot.end_time
        ) ORDER BY slot.weekday, slot.start_time
      ) AS slots
      FROM public.teacher_group_schedule_slots AS slot
      WHERE slot.group_id = g.id
    ) AS schedule
    WHERE teacher.role = 'TEACHER'
      AND teacher.teacher_status = 'ACTIVE'
      AND public.is_active_teacher_profile(teacher.id)
      AND pg_catalog.char_length(pg_catalog.btrim(teacher.full_name)) >= 2
      AND pg_catalog.cardinality(tp.subjects) > 0
      AND tp.monthly_price > 0
      AND pg_catalog.char_length(COALESCE(tp.lesson_title, '')) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(tp.teaching_area)) >= 2
      AND pg_catalog.char_length(pg_catalog.btrim(tp.teaching_address)) >= 5
      AND g.educational_stage = sc.stage
      AND g.grade = sc.grade
      AND (p_stage IS NULL OR p_stage = sc.stage)
      AND (p_grade IS NULL OR p_grade = sc.grade)
      AND (p_subject IS NULL OR g.subject = p_subject)
      AND (p_area IS NULL OR tp.teaching_area ILIKE ('%' || pg_catalog.btrim(p_area) || '%'))
      AND (
        p_search IS NULL
        OR teacher.full_name ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
        OR tp.lesson_title ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
        OR g.subject ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
      )
      AND EXISTS (
        SELECT 1 FROM public.teacher_student_payment_methods AS method
        WHERE method.teacher_id = teacher.id AND method.is_active
      )
  )
  SELECT
    eg.teacher_id,
    eg.full_name,
    eg.avatar_path,
    eg.subjects,
    eg.teaching_area,
    eg.teaching_address,
    eg.lesson_title,
    eg.bio,
    eg.monthly_price,
    pg_catalog.jsonb_agg(eg.group_data ORDER BY eg.group_created_at DESC, eg.group_name)
  FROM eligible_groups AS eg
  GROUP BY eg.teacher_id, eg.full_name, eg.avatar_path, eg.subjects,
    eg.teaching_area, eg.teaching_address, eg.lesson_title, eg.bio, eg.monthly_price
  ORDER BY eg.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_teacher_details(p_teacher_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  teacher_data JSONB;
  method_data JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'STUDENT' AND p.onboarding_completed
  ) THEN
    RAISE EXCEPTION 'A completed student profile is required.';
  END IF;

  SELECT pg_catalog.to_jsonb(t) INTO teacher_data
  FROM public.list_student_teachers(NULL, NULL, NULL, NULL, NULL) AS t
  WHERE t.teacher_id = p_teacher_id;
  IF teacher_data IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', m.id,
    'provider', m.provider,
    'account_holder', m.account_holder,
    'account_identifier', m.account_identifier,
    'instructions', m.instructions
  ) ORDER BY m.provider), '[]'::JSONB)
  INTO method_data
  FROM public.teacher_student_payment_methods AS m
  WHERE m.teacher_id = p_teacher_id AND m.is_active;

  RETURN teacher_data || pg_catalog.jsonb_build_object('payment_methods', method_data);
END;
$$;

REVOKE ALL ON FUNCTION public.list_student_teachers(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_student_teachers(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
REVOKE ALL ON FUNCTION public.get_student_teacher_details(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_teacher_details(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_student_subscription_request(p_group_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  student_row RECORD;
  group_row RECORD;
  active_count INTEGER;
  new_subscription_id UUID;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  SELECT p.stage, p.grade INTO student_row
  FROM public.profiles AS p
  WHERE p.id = actor_id AND p.role = 'STUDENT'
    AND p.profile_setup_completed AND p.onboarding_completed
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A completed student profile is required.'; END IF;

  SELECT g.id, g.teacher_id, g.educational_stage, g.grade, g.max_students,
    g.status, tp.monthly_price
  INTO group_row
  FROM public.teacher_groups AS g
  JOIN public.teacher_profiles AS tp ON tp.teacher_id = g.teacher_id
  JOIN public.profiles AS teacher ON teacher.id = g.teacher_id
  WHERE g.id = p_group_id
    AND g.status = 'ACTIVE'
    AND teacher.role = 'TEACHER'
    AND teacher.teacher_status = 'ACTIVE'
    AND public.is_active_teacher_profile(teacher.id)
    AND tp.monthly_price > 0
  FOR UPDATE OF g;
  IF NOT FOUND THEN RAISE EXCEPTION 'This group is unavailable.'; END IF;
  IF group_row.educational_stage IS DISTINCT FROM student_row.stage
    OR group_row.grade IS DISTINCT FROM student_row.grade THEN
    RAISE EXCEPTION 'This group is not available for the student educational grade.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_student_payment_methods AS m
    WHERE m.teacher_id = group_row.teacher_id AND m.is_active
  ) THEN RAISE EXCEPTION 'The teacher has no active payment method.'; END IF;

  UPDATE public.student_teacher_subscriptions AS s
  SET status = 'EXPIRED'
  WHERE s.student_id = actor_id AND s.group_id = p_group_id
    AND s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now();

  SELECT pg_catalog.count(*)::INTEGER INTO active_count
  FROM public.student_teacher_subscriptions AS s
  WHERE s.group_id = p_group_id AND s.status = 'ACTIVE'
    AND s.expires_at > pg_catalog.now();
  IF active_count >= group_row.max_students THEN
    RAISE EXCEPTION 'This group is full.';
  END IF;

  BEGIN
    INSERT INTO public.student_teacher_subscriptions (
      student_id, teacher_id, group_id, monthly_price_snapshot
    ) VALUES (actor_id, group_row.teacher_id, p_group_id, group_row.monthly_price)
    RETURNING id INTO new_subscription_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'An active or pending request for this group already exists.';
  END;

  RETURN new_subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_teacher_payment(
  p_payment_id UUID,
  p_subscription_id UUID,
  p_payment_method_id UUID,
  p_transferred_amount NUMERIC,
  p_receipt_path TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  subscription_row public.student_teacher_subscriptions%ROWTYPE;
  method_row public.teacher_student_payment_methods%ROWTYPE;
  normalized_notes TEXT := NULLIF(pg_catalog.btrim(p_notes), '');
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Transferred amount must be positive.';
  END IF;
  IF p_payment_id IS NULL OR p_receipt_path IS NULL THEN
    RAISE EXCEPTION 'A receipt upload is required.';
  END IF;
  IF normalized_notes IS NOT NULL AND pg_catalog.char_length(normalized_notes) > 1000 THEN
    RAISE EXCEPTION 'Payment notes cannot exceed 1000 characters.';
  END IF;

  SELECT * INTO subscription_row
  FROM public.student_teacher_subscriptions AS s
  WHERE s.id = p_subscription_id AND s.student_id = actor_id
  FOR UPDATE;
  IF NOT FOUND OR subscription_row.status <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'This request is not awaiting payment.';
  END IF;
  IF NOT (
    p_receipt_path = actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.jpg'
    OR p_receipt_path = actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.jpeg'
    OR p_receipt_path = actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.png'
    OR p_receipt_path = actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.webp'
  ) THEN RAISE EXCEPTION 'Receipt path is invalid.'; END IF;

  SELECT * INTO method_row
  FROM public.teacher_student_payment_methods AS m
  WHERE m.id = p_payment_method_id AND m.teacher_id = subscription_row.teacher_id AND m.is_active
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This teacher payment method is unavailable.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects AS o
    WHERE o.bucket_id = 'student-payment-receipts' AND o.name = p_receipt_path
  ) THEN RAISE EXCEPTION 'The uploaded receipt could not be found.'; END IF;

  INSERT INTO public.student_teacher_payments (
    id, subscription_id, student_id, teacher_id, payment_method_id,
    transferred_amount, receipt_path, provider_snapshot,
    account_holder_snapshot, account_identifier_snapshot, instructions_snapshot, notes
  ) VALUES (
    p_payment_id, p_subscription_id, actor_id, subscription_row.teacher_id, method_row.id,
    p_transferred_amount, p_receipt_path, method_row.provider,
    method_row.account_holder, method_row.account_identifier, method_row.instructions, normalized_notes
  );

  UPDATE public.student_teacher_subscriptions AS s
  SET status = 'UNDER_REVIEW', submitted_at = pg_catalog.now()
  WHERE s.id = p_subscription_id AND s.student_id = actor_id;
  RETURN p_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_student_teacher_subscriptions()
RETURNS TABLE (
  subscription_id UUID,
  teacher_id UUID,
  teacher_name TEXT,
  teacher_avatar_path TEXT,
  group_id UUID,
  group_name TEXT,
  subject TEXT,
  educational_stage TEXT,
  grade TEXT,
  monthly_price NUMERIC,
  status TEXT,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  rejection_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  RETURN QUERY
  SELECT s.id, s.teacher_id, teacher.full_name, teacher.avatar_url,
    g.id, g.name, g.subject, g.educational_stage, g.grade,
    s.monthly_price_snapshot,
    CASE WHEN s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now() THEN 'EXPIRED' ELSE s.status END,
    COALESCE(s.submitted_at, s.created_at), s.started_at, s.expires_at, s.rejection_reason
  FROM public.student_teacher_subscriptions AS s
  JOIN public.profiles AS teacher ON teacher.id = s.teacher_id
  JOIN public.teacher_groups AS g ON g.id = s.group_id
  WHERE s.student_id = actor_id
  ORDER BY s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_teacher_subscription(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  subscription_data JSONB;
  payment_data JSONB;
  schedule_data JSONB;
  available_methods JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = actor_id AND p.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT pg_catalog.jsonb_build_object(
    'id', s.id,
    'teacher_id', s.teacher_id,
    'teacher_name', teacher.full_name,
    'teacher_avatar_path', teacher.avatar_url,
    'teaching_area', tp.teaching_area,
    'teaching_address', tp.teaching_address,
    'lesson_title', tp.lesson_title,
    'group_id', g.id,
    'group_name', g.name,
    'subject', g.subject,
    'educational_stage', g.educational_stage,
    'grade', g.grade,
    'monthly_price', s.monthly_price_snapshot,
    'status', CASE WHEN s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now() THEN 'EXPIRED' ELSE s.status END,
    'created_at', s.created_at,
    'submitted_at', s.submitted_at,
    'approved_at', s.approved_at,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'rejection_reason', s.rejection_reason
  ) INTO subscription_data
  FROM public.student_teacher_subscriptions AS s
  JOIN public.profiles AS teacher ON teacher.id = s.teacher_id
  JOIN public.teacher_profiles AS tp ON tp.teacher_id = s.teacher_id
  JOIN public.teacher_groups AS g ON g.id = s.group_id
  WHERE s.id = p_subscription_id AND s.student_id = actor_id;
  IF subscription_data IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'weekday', slot.weekday, 'start_time', slot.start_time, 'end_time', slot.end_time
  ) ORDER BY slot.weekday, slot.start_time), '[]'::JSONB)
  INTO schedule_data
  FROM public.teacher_group_schedule_slots AS slot
  WHERE slot.group_id = (subscription_data->>'group_id')::UUID;

  SELECT pg_catalog.jsonb_build_object(
    'id', payment.id,
    'transferred_amount', payment.transferred_amount,
    'receipt_path', payment.receipt_path,
    'provider', payment.provider_snapshot,
    'account_holder', payment.account_holder_snapshot,
    'account_identifier', payment.account_identifier_snapshot,
    'instructions', payment.instructions_snapshot,
    'notes', payment.notes,
    'status', payment.status,
    'rejection_reason', payment.rejection_reason,
    'submitted_at', payment.submitted_at,
    'reviewed_at', payment.reviewed_at
  ) INTO payment_data
  FROM public.student_teacher_payments AS payment
  WHERE payment.subscription_id = p_subscription_id;

  IF subscription_data->>'status' = 'PENDING_PAYMENT' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', method.id,
      'provider', method.provider,
      'account_holder', method.account_holder,
      'account_identifier', method.account_identifier,
      'instructions', method.instructions
    ) ORDER BY method.provider), '[]'::JSONB)
    INTO available_methods
    FROM public.teacher_student_payment_methods AS method
    WHERE method.teacher_id = (subscription_data->>'teacher_id')::UUID AND method.is_active;
  ELSE
    available_methods := '[]'::JSONB;
  END IF;

  RETURN subscription_data || pg_catalog.jsonb_build_object(
    'schedule', schedule_data,
    'payment', payment_data,
    'available_payment_methods', COALESCE(available_methods, '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_teacher_student_subscriptions()
RETURNS TABLE (
  subscription_id UUID,
  student_name TEXT,
  group_name TEXT,
  subject TEXT,
  educational_stage TEXT,
  grade TEXT,
  monthly_price NUMERIC,
  subscription_status TEXT,
  payment_id UUID,
  transferred_amount NUMERIC,
  payment_provider TEXT,
  account_holder TEXT,
  account_identifier TEXT,
  payment_status TEXT,
  submitted_at TIMESTAMPTZ,
  receipt_path TEXT,
  rejection_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  RETURN QUERY
  SELECT s.id, student.full_name, g.name, g.subject, g.educational_stage, g.grade,
    s.monthly_price_snapshot,
    CASE WHEN s.status = 'ACTIVE' AND s.expires_at <= pg_catalog.now() THEN 'EXPIRED' ELSE s.status END,
    payment.id, payment.transferred_amount, payment.provider_snapshot,
    payment.account_holder_snapshot, payment.account_identifier_snapshot,
    payment.status, payment.submitted_at, payment.receipt_path,
    COALESCE(payment.rejection_reason, s.rejection_reason)
  FROM public.student_teacher_subscriptions AS s
  JOIN public.profiles AS student ON student.id = s.student_id
  JOIN public.teacher_groups AS g ON g.id = s.group_id AND g.teacher_id = actor_id
  LEFT JOIN public.student_teacher_payments AS payment ON payment.subscription_id = s.id
  WHERE s.teacher_id = actor_id AND s.status IN ('UNDER_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED')
  ORDER BY CASE WHEN s.status = 'UNDER_REVIEW' THEN 0 ELSE 1 END, s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_student_teacher_subscription(
  p_subscription_id UUID,
  p_approve BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := (SELECT auth.uid());
  subscription_row public.student_teacher_subscriptions%ROWTYPE;
  group_capacity INTEGER;
  active_count INTEGER;
  normalized_reason TEXT := NULLIF(pg_catalog.btrim(p_rejection_reason), '');
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Choose whether to approve or reject the request.'; END IF;
  IF NOT p_approve AND (normalized_reason IS NULL OR pg_catalog.char_length(normalized_reason) NOT BETWEEN 3 AND 1000) THEN
    RAISE EXCEPTION 'A rejection reason between 3 and 1000 characters is required.';
  END IF;

  SELECT * INTO subscription_row
  FROM public.student_teacher_subscriptions AS s
  WHERE s.id = p_subscription_id AND s.teacher_id = actor_id
  FOR UPDATE;
  IF NOT FOUND OR subscription_row.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'This student request is no longer awaiting review.';
  END IF;

  SELECT g.max_students INTO group_capacity
  FROM public.teacher_groups AS g
  WHERE g.id = subscription_row.group_id AND g.teacher_id = actor_id AND g.status = 'ACTIVE'
  FOR UPDATE;
  IF NOT FOUND AND p_approve THEN RAISE EXCEPTION 'This group is inactive or unavailable.'; END IF;

  IF p_approve THEN
    UPDATE public.student_teacher_subscriptions AS expired
    SET status = 'EXPIRED'
    WHERE expired.group_id = subscription_row.group_id
      AND expired.status = 'ACTIVE' AND expired.expires_at <= pg_catalog.now();

    SELECT pg_catalog.count(*)::INTEGER INTO active_count
    FROM public.student_teacher_subscriptions AS active
    WHERE active.group_id = subscription_row.group_id
      AND active.status = 'ACTIVE' AND active.expires_at > pg_catalog.now();
    IF active_count >= group_capacity THEN RAISE EXCEPTION 'This group is full.'; END IF;
  END IF;

  UPDATE public.student_teacher_payments AS payment
  SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE normalized_reason END,
      reviewed_at = pg_catalog.now(),
      reviewed_by = actor_id
  WHERE payment.subscription_id = p_subscription_id AND payment.status = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'A pending student payment was not found.'; END IF;

  IF p_approve THEN
    UPDATE public.student_teacher_subscriptions AS s
    SET status = 'ACTIVE',
        approved_at = pg_catalog.now(),
        started_at = pg_catalog.now(),
        expires_at = pg_catalog.now() + INTERVAL '1 month',
        rejected_at = NULL,
        reviewed_by = actor_id,
        rejection_reason = NULL
    WHERE s.id = p_subscription_id AND s.teacher_id = actor_id;
  ELSE
    UPDATE public.student_teacher_subscriptions AS s
    SET status = 'REJECTED',
        rejected_at = pg_catalog.now(),
        reviewed_by = actor_id,
        rejection_reason = normalized_reason
    WHERE s.id = p_subscription_id AND s.teacher_id = actor_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_student_subscription_request(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_subscription_request(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_student_teacher_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_teacher_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT)
  TO authenticated;
REVOKE ALL ON FUNCTION public.list_student_teacher_subscriptions()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_student_teacher_subscriptions() TO authenticated;
REVOKE ALL ON FUNCTION public.get_student_teacher_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_teacher_subscription(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.list_teacher_student_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_teacher_student_subscriptions() TO authenticated;
REVOKE ALL ON FUNCTION public.review_student_teacher_subscription(UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_student_teacher_subscription(UUID, BOOLEAN, TEXT)
  TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-payment-receipts', 'student-payment-receipts', FALSE, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Students upload receipts for their own pending requests"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-payment-receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS s
      JOIN public.profiles AS p ON p.id = s.student_id
      WHERE s.id::TEXT = (storage.foldername(name))[2]
        AND s.student_id = (SELECT auth.uid())
        AND s.status = 'PENDING_PAYMENT'
        AND p.role = 'STUDENT'
    )
  );

CREATE POLICY "Students and relevant teachers read student payment receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-payment-receipts'
    AND EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS s
      WHERE s.id::TEXT = (storage.foldername(name))[2]
        AND (
          s.student_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.student_teacher_payments AS payment
            WHERE payment.subscription_id = s.id
              AND payment.receipt_path = storage.objects.name
              AND s.teacher_id = (SELECT auth.uid())
          )
          OR public.is_classy_admin()
        )
    )
  );

CREATE POLICY "Students remove receipts not yet submitted for review"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-payment-receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1 FROM public.student_teacher_subscriptions AS s
      WHERE s.id::TEXT = (storage.foldername(name))[2]
        AND s.student_id = (SELECT auth.uid())
        AND s.status = 'PENDING_PAYMENT'
        AND NOT EXISTS (
          SELECT 1 FROM public.student_teacher_payments AS payment
          WHERE payment.subscription_id = s.id
        )
    )
  );

COMMENT ON TABLE public.teacher_student_payment_methods IS
  'Teacher-to-student payment instructions. Separate from Classy platform receiving methods.';
COMMENT ON TABLE public.student_teacher_subscriptions IS
  'Student monthly subscriptions to teacher groups; never mixed with teacher platform subscriptions.';
COMMENT ON TABLE public.student_teacher_payments IS
  'Manual student-to-teacher payment attempts and private receipt metadata.';
