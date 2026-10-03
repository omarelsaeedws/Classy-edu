-- Phase 06/05 follow-up: role-scoped attendance history, subscription renewal
-- and teacher cancellation, plus safe group archival when history exists.
-- Account deletion is added in a later follow-up after data-retention policy.

CREATE TABLE public.student_teacher_subscription_renewals (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  subscription_id UUID NOT NULL,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  amount_snapshot NUMERIC(10, 2) NOT NULL CHECK (amount_snapshot > 0),
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN (
    'PENDING_PAYMENT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  rejection_reason TEXT CHECK (
    rejection_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(rejection_reason)) BETWEEN 3 AND 1000
  ),
  CONSTRAINT student_teacher_renewal_subscription_owner_fk
    FOREIGN KEY (subscription_id, student_id, teacher_id)
    REFERENCES public.student_teacher_subscriptions(id, student_id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_renewal_id_student_teacher_key UNIQUE (id, student_id, teacher_id),
  CONSTRAINT student_teacher_renewal_review_fields_valid CHECK (
    (status <> 'APPROVED' OR (approved_at IS NOT NULL AND reviewed_by IS NOT NULL))
    AND (status <> 'REJECTED' OR (rejected_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NOT NULL))
  )
);

CREATE UNIQUE INDEX student_teacher_one_open_renewal_uidx
  ON public.student_teacher_subscription_renewals (subscription_id)
  WHERE status IN ('PENDING_PAYMENT', 'UNDER_REVIEW');
CREATE INDEX student_teacher_renewals_teacher_idx
  ON public.student_teacher_subscription_renewals (teacher_id, status, created_at DESC);
CREATE INDEX student_teacher_renewals_student_idx
  ON public.student_teacher_subscription_renewals (student_id, created_at DESC);

CREATE TABLE public.student_teacher_renewal_payments (
  id UUID PRIMARY KEY,
  renewal_id UUID NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
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
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_renewal_payment_method_owner_fk
    FOREIGN KEY (payment_method_id, teacher_id)
    REFERENCES public.teacher_student_payment_methods(id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_renewal_payment_owner_fk
    FOREIGN KEY (renewal_id, student_id, teacher_id)
    REFERENCES public.student_teacher_subscription_renewals(id, student_id, teacher_id) ON DELETE RESTRICT,
  CONSTRAINT student_teacher_renewal_payment_review_fields_valid CHECK (
    (status = 'PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL)
    OR (status = 'APPROVED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NULL)
    OR (status = 'REJECTED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE INDEX student_teacher_renewal_payments_teacher_idx
  ON public.student_teacher_renewal_payments (teacher_id, submitted_at DESC)
  WHERE status = 'PENDING';

ALTER TABLE public.student_teacher_subscription_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_renewal_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_teacher_subscription_renewals,
  public.student_teacher_renewal_payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_upload_student_renewal_receipt(p_object_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_teacher_subscription_renewals AS renewal
    WHERE renewal.id::TEXT = (storage.foldername(p_object_name))[2]
      AND renewal.student_id = (SELECT auth.uid())
      AND renewal.status = 'PENDING_PAYMENT'
      AND (storage.foldername(p_object_name))[1] = (SELECT auth.uid())::TEXT
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_student_renewal_receipt(p_object_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_teacher_renewal_payments AS payment
    JOIN public.student_teacher_subscription_renewals AS renewal ON renewal.id = payment.renewal_id
    WHERE payment.receipt_path = p_object_name
      AND (renewal.student_id = (SELECT auth.uid())
        OR renewal.teacher_id = (SELECT auth.uid())
        OR public.is_classy_admin())
  );
$$;

CREATE OR REPLACE FUNCTION private.can_delete_student_renewal_receipt(p_object_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_teacher_subscription_renewals AS renewal
    WHERE renewal.id::TEXT = (storage.foldername(p_object_name))[2]
      AND renewal.student_id = (SELECT auth.uid())
      AND renewal.status = 'PENDING_PAYMENT'
      AND (storage.foldername(p_object_name))[1] = (SELECT auth.uid())::TEXT
      AND NOT EXISTS (
        SELECT 1 FROM public.student_teacher_renewal_payments AS payment
        WHERE payment.renewal_id = renewal.id
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_upload_student_renewal_receipt(TEXT),
  private.can_read_student_renewal_receipt(TEXT),
  private.can_delete_student_renewal_receipt(TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_upload_student_renewal_receipt(TEXT),
  private.can_read_student_renewal_receipt(TEXT),
  private.can_delete_student_renewal_receipt(TEXT) TO authenticated;

CREATE POLICY "Students upload receipts for pending subscription renewals"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-payment-receipts'
    AND private.can_upload_student_renewal_receipt(name)
  );

CREATE POLICY "Students and relevant teachers read renewal receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-payment-receipts'
    AND private.can_read_student_renewal_receipt(name)
  );

CREATE POLICY "Students remove unsubmitted renewal receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-payment-receipts'
    AND private.can_delete_student_renewal_receipt(name)
  );

CREATE OR REPLACE FUNCTION private.list_student_attendance_subjects()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(subject_row.data ORDER BY subject_row.subject), '[]'::JSONB)
  INTO result
  FROM (
    SELECT group_row.subject,
      pg_catalog.jsonb_build_object(
        'subject', group_row.subject,
        'groups', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'group_id', group_row.id,
          'group_name', group_row.name,
          'teacher_name', teacher.full_name,
          'total_sessions', stats.total_sessions,
          'present_count', stats.present_count,
          'absent_count', stats.absent_count
        ) ORDER BY group_row.name, teacher.full_name)
      ) AS data
    FROM public.student_teacher_subscriptions AS subscription
    JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
    JOIN public.profiles AS teacher ON teacher.id = subscription.teacher_id
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*)::INTEGER AS total_sessions,
        pg_catalog.count(attendance.id)::INTEGER AS present_count,
        (pg_catalog.count(*) - pg_catalog.count(attendance.id))::INTEGER AS absent_count
      FROM public.class_sessions AS session
      LEFT JOIN public.class_attendance AS attendance
        ON attendance.session_id = session.id AND attendance.student_id = actor_id
        AND attendance.status IN ('PRESENT', 'LATE')
      WHERE session.group_id = group_row.id
        AND session.status = 'COMPLETED'
        AND subscription.approved_at IS NOT NULL
        AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
        AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    ) AS stats
    WHERE subscription.student_id = actor_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
      AND subscription.approved_at IS NOT NULL
    GROUP BY group_row.subject
  ) AS subject_row;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_student_subject_attendance(p_subject TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  IF p_subject IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_subject)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Choose a valid subject.';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'session_id', session.id,
    'group_id', group_row.id,
    'group_name', group_row.name,
    'teacher_name', teacher.full_name,
    'session_date', session.session_date,
    'start_time', session.start_time,
    'end_time', session.end_time,
    'status', COALESCE(attendance.status, 'ABSENT'),
    'attended_at', attendance.attended_at
  ) ORDER BY session.session_date DESC, session.start_time DESC), '[]'::JSONB)
  INTO result
  FROM public.student_teacher_subscriptions AS subscription
  JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  JOIN public.profiles AS teacher ON teacher.id = subscription.teacher_id
  JOIN public.class_sessions AS session ON session.group_id = group_row.id AND session.status = 'COMPLETED'
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = session.id AND attendance.student_id = actor_id
    AND attendance.status IN ('PRESENT', 'LATE')
  WHERE subscription.student_id = actor_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
    AND subscription.approved_at IS NOT NULL
    AND group_row.subject = pg_catalog.btrim(p_subject)
    AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.list_teacher_attendance_students(p_search TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(student_row.data ORDER BY student_row.full_name), '[]'::JSONB)
  INTO result
  FROM (
    SELECT student.id AS student_id, student.full_name,
      pg_catalog.jsonb_build_object(
        'student_id', student.id,
        'student_name', student.full_name,
        'total_sessions', stats.total_sessions,
        'present_count', stats.present_count,
        'absent_count', stats.absent_count,
        'groups', groups.items
      ) AS data
    FROM (
      SELECT DISTINCT subscription.student_id
      FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.teacher_id = actor_id
        AND subscription.approved_at IS NOT NULL
        AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
    ) AS subscribed
    JOIN public.profiles AS student ON student.id = subscribed.student_id
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*)::INTEGER AS total_sessions,
        pg_catalog.count(attendance.id)::INTEGER AS present_count,
        (pg_catalog.count(*) - pg_catalog.count(attendance.id))::INTEGER AS absent_count
      FROM public.student_teacher_subscriptions AS subscription
      JOIN public.class_sessions AS session ON session.group_id = subscription.group_id AND session.status = 'COMPLETED'
      LEFT JOIN public.class_attendance AS attendance
        ON attendance.session_id = session.id AND attendance.student_id = student.id
        AND attendance.status IN ('PRESENT', 'LATE')
      WHERE subscription.student_id = student.id AND subscription.teacher_id = actor_id
        AND subscription.approved_at IS NOT NULL
        AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
        AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
        AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    ) AS stats
    CROSS JOIN LATERAL (
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'group_id', group_row.id,
        'group_name', group_row.name,
        'subject', group_row.subject
      ) ORDER BY group_row.name), '[]'::JSONB) AS items
      FROM public.student_teacher_subscriptions AS subscription
      JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
      WHERE subscription.student_id = student.id AND subscription.teacher_id = actor_id
        AND subscription.approved_at IS NOT NULL
        AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
    ) AS groups
    WHERE p_search IS NULL OR student.full_name ILIKE ('%' || pg_catalog.btrim(p_search) || '%')
  ) AS student_row;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_student_attendance(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.student_id = p_student_id AND subscription.teacher_id = actor_id
      AND subscription.approved_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Student not found for this teacher.'; END IF;

  SELECT pg_catalog.jsonb_build_object(
    'student_id', student.id,
    'student_name', student.full_name,
    'sessions', COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'session_id', session.id,
      'group_id', group_row.id,
      'group_name', group_row.name,
      'subject', group_row.subject,
      'session_date', session.session_date,
      'start_time', session.start_time,
      'end_time', session.end_time,
      'status', COALESCE(attendance.status, 'ABSENT'),
      'attended_at', attendance.attended_at
    ) ORDER BY session.session_date DESC, session.start_time DESC) FILTER (WHERE session.id IS NOT NULL), '[]'::JSONB)
  ) INTO result
  FROM public.profiles AS student
  LEFT JOIN public.student_teacher_subscriptions AS subscription
    ON subscription.student_id = student.id AND subscription.teacher_id = actor_id
    AND subscription.approved_at IS NOT NULL
    AND subscription.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')
  LEFT JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  LEFT JOIN public.class_sessions AS session
    ON session.group_id = group_row.id AND session.status = 'COMPLETED'
    AND subscription.started_at <= ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
    AND subscription.expires_at > ((session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo')
  LEFT JOIN public.class_attendance AS attendance
    ON attendance.session_id = session.id AND attendance.student_id = student.id
    AND attendance.status IN ('PRESENT', 'LATE')
  WHERE student.id = p_student_id
  GROUP BY student.id, student.full_name;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_student_attendance_subjects()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.list_student_attendance_subjects()
$$;
CREATE OR REPLACE FUNCTION public.get_student_subject_attendance(p_subject TEXT)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_student_subject_attendance(p_subject)
$$;
CREATE OR REPLACE FUNCTION public.list_teacher_attendance_students(p_search TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.list_teacher_attendance_students(p_search)
$$;
CREATE OR REPLACE FUNCTION public.get_teacher_student_attendance(p_student_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.get_teacher_student_attendance(p_student_id)
$$;

REVOKE ALL ON FUNCTION private.list_student_attendance_subjects(),
  private.get_student_subject_attendance(TEXT), private.list_teacher_attendance_students(TEXT),
  private.get_teacher_student_attendance(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_student_attendance_subjects(),
  public.get_student_subject_attendance(TEXT), public.list_teacher_attendance_students(TEXT),
  public.get_teacher_student_attendance(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.list_student_attendance_subjects(),
  private.get_student_subject_attendance(TEXT), private.list_teacher_attendance_students(TEXT),
  private.get_teacher_student_attendance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_attendance_subjects(),
  public.get_student_subject_attendance(TEXT), public.list_teacher_attendance_students(TEXT),
  public.get_teacher_student_attendance(UUID) TO authenticated;

-- A group with subscriptions or class history is archived rather than deleted;
-- groups without dependent records can still be removed permanently.
DROP FUNCTION public.delete_teacher_group(UUID);
CREATE FUNCTION public.delete_teacher_group(p_group_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id
      AND profile.role = 'TEACHER' AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  PERFORM 1 FROM public.teacher_groups AS group_row
  WHERE group_row.id = p_group_id AND group_row.teacher_id = actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found or not owned by the authenticated teacher.'; END IF;

  IF EXISTS (SELECT 1 FROM public.class_sessions AS session WHERE session.group_id = p_group_id)
    OR EXISTS (SELECT 1 FROM public.student_teacher_subscriptions AS subscription WHERE subscription.group_id = p_group_id) THEN
    UPDATE public.teacher_groups AS group_row SET status = 'INACTIVE'
    WHERE group_row.id = p_group_id AND group_row.teacher_id = actor_id;
    RETURN 'ARCHIVED';
  END IF;
  DELETE FROM public.teacher_groups AS group_row
  WHERE group_row.id = p_group_id AND group_row.teacher_id = actor_id;
  RETURN 'DELETED';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_teacher_group(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_teacher_group(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_student_teacher_subscription_renewal(p_subscription_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); subscription_row public.student_teacher_subscriptions%ROWTYPE; renewal_id UUID;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  SELECT * INTO subscription_row FROM public.student_teacher_subscriptions AS subscription
  WHERE subscription.id = p_subscription_id AND subscription.student_id = actor_id
    AND subscription.status = 'ACTIVE' AND subscription.expires_at > pg_catalog.now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active subscription can be renewed before expiry.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS group_row
    JOIN public.profiles AS teacher ON teacher.id = group_row.teacher_id
    WHERE group_row.id = subscription_row.group_id AND group_row.status = 'ACTIVE'
      AND teacher.role = 'TEACHER' AND teacher.teacher_status = 'ACTIVE'
      AND public.is_active_teacher_profile(teacher.id)
  ) THEN RAISE EXCEPTION 'This teacher group is no longer accepting renewals.'; END IF;
  INSERT INTO public.student_teacher_subscription_renewals (
    subscription_id, student_id, teacher_id, amount_snapshot
  ) VALUES (
    subscription_row.id, actor_id, subscription_row.teacher_id, subscription_row.monthly_price_snapshot
  ) RETURNING id INTO renewal_id;
  RETURN renewal_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A renewal request is already in progress.';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_teacher_renewal_payment(
  p_renewal_id UUID, p_payment_id UUID, p_payment_method_id UUID,
  p_transferred_amount NUMERIC, p_receipt_path TEXT, p_notes TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); renewal_row public.student_teacher_subscription_renewals%ROWTYPE;
  method_row public.teacher_student_payment_methods%ROWTYPE; normalized_notes TEXT := NULLIF(pg_catalog.btrim(p_notes), '');
BEGIN
  IF actor_id IS NULL OR p_transferred_amount IS NULL OR p_transferred_amount <= 0
    OR p_payment_id IS NULL OR p_receipt_path IS NULL THEN
    RAISE EXCEPTION 'Valid authentication, amount, and receipt are required.';
  END IF;
  IF normalized_notes IS NOT NULL AND pg_catalog.char_length(normalized_notes) > 1000 THEN
    RAISE EXCEPTION 'Payment notes cannot exceed 1000 characters.';
  END IF;
  SELECT * INTO renewal_row FROM public.student_teacher_subscription_renewals AS renewal
  WHERE renewal.id = p_renewal_id AND renewal.student_id = actor_id AND renewal.status = 'PENDING_PAYMENT'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This renewal is not awaiting payment.'; END IF;
  IF NOT (
    p_receipt_path = actor_id::TEXT || '/' || p_renewal_id::TEXT || '/' || p_payment_id::TEXT || '.jpg'
    OR p_receipt_path = actor_id::TEXT || '/' || p_renewal_id::TEXT || '/' || p_payment_id::TEXT || '.jpeg'
    OR p_receipt_path = actor_id::TEXT || '/' || p_renewal_id::TEXT || '/' || p_payment_id::TEXT || '.png'
    OR p_receipt_path = actor_id::TEXT || '/' || p_renewal_id::TEXT || '/' || p_payment_id::TEXT || '.webp'
  ) THEN RAISE EXCEPTION 'Receipt path is invalid.'; END IF;
  SELECT * INTO method_row FROM public.teacher_student_payment_methods AS method
  WHERE method.id = p_payment_method_id AND method.teacher_id = renewal_row.teacher_id AND method.is_active
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This teacher payment method is unavailable.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects AS object
    WHERE object.bucket_id = 'student-payment-receipts' AND object.name = p_receipt_path) THEN
    RAISE EXCEPTION 'The uploaded receipt could not be found.';
  END IF;
  INSERT INTO public.student_teacher_renewal_payments (
    id, renewal_id, student_id, teacher_id, payment_method_id, transferred_amount,
    receipt_path, provider_snapshot, account_holder_snapshot, account_identifier_snapshot,
    instructions_snapshot, notes
  ) VALUES (
    p_payment_id, renewal_row.id, actor_id, renewal_row.teacher_id, method_row.id,
    p_transferred_amount, p_receipt_path, method_row.provider, method_row.account_holder,
    method_row.account_identifier, method_row.instructions, normalized_notes
  );
  UPDATE public.student_teacher_subscription_renewals AS renewal
  SET status = 'UNDER_REVIEW', submitted_at = pg_catalog.now()
  WHERE renewal.id = renewal_row.id;
  RETURN p_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_teacher_subscription_renewal(p_renewal_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  SELECT pg_catalog.jsonb_build_object(
    'id', renewal.id, 'subscription_id', renewal.subscription_id,
    'teacher_id', renewal.teacher_id, 'teacher_name', teacher.full_name,
    'group_name', group_row.name, 'subject', group_row.subject,
    'amount', renewal.amount_snapshot, 'status', renewal.status,
    'expires_at', subscription.expires_at, 'rejection_reason', renewal.rejection_reason,
    'payment_methods', COALESCE(methods.items, '[]'::JSONB), 'payment', payment.data
  ) INTO result
  FROM public.student_teacher_subscription_renewals AS renewal
  JOIN public.student_teacher_subscriptions AS subscription ON subscription.id = renewal.subscription_id
  JOIN public.profiles AS teacher ON teacher.id = renewal.teacher_id
  JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  CROSS JOIN LATERAL (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', method.id, 'provider', method.provider, 'account_holder', method.account_holder,
      'account_identifier', method.account_identifier, 'instructions', method.instructions
    ) ORDER BY method.created_at) AS items
    FROM public.teacher_student_payment_methods AS method
    WHERE method.teacher_id = renewal.teacher_id AND method.is_active
  ) AS methods
  LEFT JOIN LATERAL (
    SELECT pg_catalog.jsonb_build_object(
      'id', payment.id, 'transferred_amount', payment.transferred_amount,
      'receipt_path', payment.receipt_path, 'provider', payment.provider_snapshot,
      'status', payment.status, 'rejection_reason', payment.rejection_reason,
      'submitted_at', payment.submitted_at
    ) AS data
    FROM public.student_teacher_renewal_payments AS payment
    WHERE payment.renewal_id = renewal.id
  ) AS payment ON TRUE
  WHERE renewal.id = p_renewal_id
    AND (renewal.student_id = actor_id OR renewal.teacher_id = actor_id OR public.is_classy_admin());
  IF result IS NULL THEN RAISE EXCEPTION 'Renewal not found.'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_student_teacher_subscription_renewals()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'STUDENT'
  ) THEN RAISE EXCEPTION 'A student account is required.'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'renewal_id', renewal.id, 'subscription_id', renewal.subscription_id,
    'status', renewal.status, 'amount', renewal.amount_snapshot,
    'created_at', renewal.created_at, 'expires_at', subscription.expires_at
  ) ORDER BY renewal.created_at DESC), '[]'::JSONB)
  INTO result
  FROM public.student_teacher_subscription_renewals AS renewal
  JOIN public.student_teacher_subscriptions AS subscription ON subscription.id = renewal.subscription_id
  WHERE renewal.student_id = actor_id AND renewal.status IN ('PENDING_PAYMENT', 'UNDER_REVIEW');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_teacher_student_renewals()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'renewal_id', renewal.id, 'subscription_id', renewal.subscription_id,
    'student_name', student.full_name, 'group_name', group_row.name,
    'subject', group_row.subject, 'amount', renewal.amount_snapshot,
    'status', renewal.status, 'payment_id', payment.id,
    'transferred_amount', payment.transferred_amount, 'payment_provider', payment.provider_snapshot,
    'account_holder', payment.account_holder_snapshot,
    'account_identifier', payment.account_identifier_snapshot,
    'receipt_path', payment.receipt_path, 'notes', payment.notes,
    'submitted_at', payment.submitted_at, 'rejection_reason', renewal.rejection_reason
  ) ORDER BY payment.submitted_at), '[]'::JSONB) INTO result
  FROM public.student_teacher_subscription_renewals AS renewal
  JOIN public.profiles AS student ON student.id = renewal.student_id
  JOIN public.student_teacher_subscriptions AS subscription ON subscription.id = renewal.subscription_id
  JOIN public.teacher_groups AS group_row ON group_row.id = subscription.group_id
  JOIN public.student_teacher_renewal_payments AS payment ON payment.renewal_id = renewal.id
  WHERE renewal.teacher_id = actor_id AND renewal.status = 'UNDER_REVIEW' AND payment.status = 'PENDING';
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_student_teacher_subscription_renewal(
  p_renewal_id UUID, p_approve BOOLEAN, p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid()); renewal_row public.student_teacher_subscription_renewals%ROWTYPE;
  subscription_row public.student_teacher_subscriptions%ROWTYPE;
  normalized_reason TEXT := NULLIF(pg_catalog.btrim(p_rejection_reason), '');
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  IF p_approve IS NULL OR (NOT p_approve AND pg_catalog.char_length(normalized_reason) NOT BETWEEN 3 AND 1000) THEN
    RAISE EXCEPTION 'Choose a decision and provide a rejection reason between 3 and 1000 characters.';
  END IF;
  SELECT * INTO renewal_row FROM public.student_teacher_subscription_renewals AS renewal
  WHERE renewal.id = p_renewal_id AND renewal.teacher_id = actor_id AND renewal.status = 'UNDER_REVIEW'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This renewal is not awaiting review.'; END IF;
  SELECT * INTO subscription_row FROM public.student_teacher_subscriptions AS subscription
  WHERE subscription.id = renewal_row.subscription_id AND subscription.teacher_id = actor_id
    AND subscription.status IN ('ACTIVE', 'EXPIRED')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The original subscription was cancelled.'; END IF;
  IF p_approve AND NOT EXISTS (
    SELECT 1 FROM public.teacher_groups AS group_row
    WHERE group_row.id = subscription_row.group_id AND group_row.teacher_id = actor_id AND group_row.status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'This group is no longer active.'; END IF;

  UPDATE public.student_teacher_renewal_payments AS payment
  SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE normalized_reason END,
      reviewed_at = pg_catalog.now(), reviewed_by = actor_id
  WHERE payment.renewal_id = renewal_row.id AND payment.status = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'A pending renewal payment was not found.'; END IF;

  IF p_approve THEN
    UPDATE public.student_teacher_subscriptions AS subscription
    SET status = 'ACTIVE', expires_at = GREATEST(subscription.expires_at, pg_catalog.now()) + INTERVAL '1 month'
    WHERE subscription.id = subscription_row.id;
    UPDATE public.student_teacher_subscription_renewals AS renewal
    SET status = 'APPROVED', approved_at = pg_catalog.now(), reviewed_by = actor_id,
        rejection_reason = NULL WHERE renewal.id = renewal_row.id;
  ELSE
    UPDATE public.student_teacher_subscription_renewals AS renewal
    SET status = 'REJECTED', rejected_at = pg_catalog.now(), reviewed_by = actor_id,
        rejection_reason = normalized_reason WHERE renewal.id = renewal_row.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_student_teacher_subscription(p_subscription_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_id UUID := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = actor_id AND profile.role = 'TEACHER'
      AND profile.teacher_status = 'ACTIVE'
  ) OR NOT public.is_teacher_platform_subscription_active() THEN
    RAISE EXCEPTION 'An active teacher subscription is required.';
  END IF;
  UPDATE public.student_teacher_subscriptions AS subscription
  SET status = 'CANCELLED'
  WHERE subscription.id = p_subscription_id AND subscription.teacher_id = actor_id
    AND subscription.status = 'ACTIVE' AND subscription.expires_at > pg_catalog.now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Active student subscription not found.'; END IF;

  UPDATE public.student_teacher_renewal_payments AS payment
  SET status = 'REJECTED', rejection_reason = 'تم إلغاء الاشتراك من المدرس.',
      reviewed_at = pg_catalog.now(), reviewed_by = actor_id
  FROM public.student_teacher_subscription_renewals AS renewal
  WHERE renewal.subscription_id = p_subscription_id AND renewal.teacher_id = actor_id
    AND renewal.status IN ('PENDING_PAYMENT', 'UNDER_REVIEW')
    AND payment.renewal_id = renewal.id AND payment.status = 'PENDING';
  UPDATE public.student_teacher_subscription_renewals AS renewal
  SET status = 'CANCELLED', reviewed_by = actor_id,
      rejection_reason = 'تم إلغاء الاشتراك من المدرس.'
  WHERE renewal.subscription_id = p_subscription_id AND renewal.teacher_id = actor_id
    AND renewal.status IN ('PENDING_PAYMENT', 'UNDER_REVIEW');
END;
$$;

-- Permanent account deletion is orchestrated by the authenticated Edge Function.
-- This RPC is only granted to service_role and removes all user-owned or
-- teacher/student relationship data before Auth removes the profile row.
CREATE OR REPLACE FUNCTION public.purge_account_related_data(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_role TEXT;
BEGIN
  SELECT profile.role INTO account_role
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF account_role IS NULL OR account_role NOT IN ('STUDENT', 'TEACHER') THEN
    RAISE EXCEPTION 'Only student and teacher accounts can be permanently deleted here.';
  END IF;

  DELETE FROM public.reviews AS review
  WHERE review.student_id = p_user_id OR review.teacher_id = p_user_id;

  DELETE FROM public.class_attendance AS attendance
  WHERE attendance.student_id = p_user_id
     OR attendance.session_id IN (
       SELECT session.id FROM public.class_sessions AS session WHERE session.teacher_id = p_user_id
     );
  DELETE FROM public.class_sessions AS session WHERE session.teacher_id = p_user_id;

  DELETE FROM public.student_teacher_renewal_payments AS payment
  WHERE payment.student_id = p_user_id OR payment.teacher_id = p_user_id;
  DELETE FROM public.student_teacher_subscription_renewals AS renewal
  WHERE renewal.student_id = p_user_id OR renewal.teacher_id = p_user_id;

  DELETE FROM public.student_teacher_payments AS payment
  WHERE payment.student_id = p_user_id OR payment.teacher_id = p_user_id;
  DELETE FROM public.student_teacher_subscriptions AS subscription
  WHERE subscription.student_id = p_user_id OR subscription.teacher_id = p_user_id;

  DELETE FROM public.teacher_platform_payments AS payment WHERE payment.teacher_id = p_user_id;
  DELETE FROM public.teacher_platform_subscriptions AS subscription WHERE subscription.teacher_id = p_user_id;

  DELETE FROM public.teacher_groups AS group_row WHERE group_row.teacher_id = p_user_id;
  DELETE FROM public.teacher_student_payment_methods AS method WHERE method.teacher_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_student_teacher_subscription_renewal(UUID),
  public.submit_student_teacher_renewal_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT),
  public.get_student_teacher_subscription_renewal(UUID), public.list_student_teacher_subscription_renewals(),
  public.list_teacher_student_renewals(),
  public.review_student_teacher_subscription_renewal(UUID, BOOLEAN, TEXT),
  public.cancel_student_teacher_subscription(UUID),
  public.purge_account_related_data(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_student_teacher_subscription_renewal(UUID),
  public.submit_student_teacher_renewal_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT),
  public.get_student_teacher_subscription_renewal(UUID), public.list_student_teacher_subscription_renewals(),
  public.list_teacher_student_renewals(),
  public.review_student_teacher_subscription_renewal(UUID, BOOLEAN, TEXT),
  public.cancel_student_teacher_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_related_data(UUID) TO service_role;
