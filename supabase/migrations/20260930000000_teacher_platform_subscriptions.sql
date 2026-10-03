-- Classy Phase 03: teacher subscriptions and manual platform payments.
-- All state transitions are performed by restricted SECURITY DEFINER RPCs.

CREATE TABLE public.platform_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_months SMALLINT NOT NULL UNIQUE CHECK (duration_months IN (1, 3, 6)),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.platform_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN (
    'INSTAPAY', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH', 'WE_PAY'
  )),
  account_holder TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(account_holder)) BETWEEN 2 AND 120),
  account_identifier TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(account_identifier)) BETWEEN 3 AND 160),
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE UNIQUE INDEX platform_payment_methods_provider_account_uidx
  ON public.platform_payment_methods (provider, account_identifier);

CREATE TABLE public.teacher_platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.platform_subscription_plans(id) ON DELETE RESTRICT,
  duration_months SMALLINT NOT NULL CHECK (duration_months IN (1, 3, 6)),
  amount_due NUMERIC(10, 2) NOT NULL CHECK (amount_due > 0),
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (status IN ('PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT approved_subscription_has_expiry CHECK (status <> 'APPROVED' OR expires_at IS NOT NULL),
  CONSTRAINT teacher_subscription_pair_unique UNIQUE (id, teacher_id)
);

CREATE UNIQUE INDEX one_open_teacher_platform_subscription_uidx
  ON public.teacher_platform_subscriptions (teacher_id)
  WHERE status IN ('PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_REVIEW');
CREATE INDEX teacher_platform_subscriptions_teacher_idx
  ON public.teacher_platform_subscriptions (teacher_id, created_at DESC);
CREATE INDEX teacher_platform_subscriptions_expiry_idx
  ON public.teacher_platform_subscriptions (expires_at)
  WHERE status = 'APPROVED';

CREATE TABLE public.teacher_platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.teacher_platform_subscriptions(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payment_method_id UUID NOT NULL REFERENCES public.platform_payment_methods(id) ON DELETE RESTRICT,
  transferred_amount NUMERIC(10, 2) NOT NULL CHECK (transferred_amount > 0),
  receipt_path TEXT NOT NULL UNIQUE,
  notes TEXT CHECK (notes IS NULL OR pg_catalog.char_length(notes) <= 1000),
  status TEXT NOT NULL DEFAULT 'PAYMENT_SUBMITTED'
    CHECK (status IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT CHECK (rejection_reason IS NULL OR pg_catalog.char_length(rejection_reason) BETWEEN 3 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT review_fields_consistent CHECK (
    (status IN ('APPROVED', 'REJECTED') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    OR status IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW')
  ),
  CONSTRAINT rejected_payment_has_reason CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL),
  CONSTRAINT payment_teacher_owns_subscription
    FOREIGN KEY (subscription_id, teacher_id)
    REFERENCES public.teacher_platform_subscriptions(id, teacher_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX one_unresolved_payment_per_subscription_uidx
  ON public.teacher_platform_payments (subscription_id)
  WHERE status IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW');
CREATE INDEX teacher_platform_payments_teacher_idx
  ON public.teacher_platform_payments (teacher_id, submitted_at DESC);
CREATE INDEX teacher_platform_payments_review_queue_idx
  ON public.teacher_platform_payments (submitted_at DESC)
  WHERE status IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW');

CREATE OR REPLACE FUNCTION public.set_teacher_platform_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_teacher_platform_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER platform_subscription_plans_updated_at
  BEFORE UPDATE ON public.platform_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER platform_payment_methods_updated_at
  BEFORE UPDATE ON public.platform_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER teacher_platform_subscriptions_updated_at
  BEFORE UPDATE ON public.teacher_platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();
CREATE TRIGGER teacher_platform_payments_updated_at
  BEFORE UPDATE ON public.teacher_platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_teacher_platform_updated_at();

ALTER TABLE public.platform_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_platform_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_classy_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
  );
$$;
REVOKE ALL ON FUNCTION public.is_classy_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_classy_admin() TO authenticated;

CREATE POLICY "Authenticated users can view active subscription plans"
  ON public.platform_subscription_plans FOR SELECT TO authenticated
  USING (is_active OR public.is_classy_admin());
CREATE POLICY "Authenticated users can view active payment methods"
  ON public.platform_payment_methods FOR SELECT TO authenticated
  USING (is_active OR public.is_classy_admin());
CREATE POLICY "Teachers and admins can view relevant subscriptions"
  ON public.teacher_platform_subscriptions FOR SELECT TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR public.is_classy_admin());
CREATE POLICY "Teachers and admins can view relevant payments"
  ON public.teacher_platform_payments FOR SELECT TO authenticated
  USING (teacher_id = (SELECT auth.uid()) OR public.is_classy_admin());

GRANT SELECT ON public.platform_subscription_plans TO authenticated;
GRANT SELECT ON public.platform_payment_methods TO authenticated;
GRANT SELECT ON public.teacher_platform_subscriptions TO authenticated;
GRANT SELECT ON public.teacher_platform_payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.platform_subscription_plans, public.platform_payment_methods,
     public.teacher_platform_subscriptions, public.teacher_platform_payments
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher_platform_subscription_active()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_platform_subscriptions AS s
    WHERE s.teacher_id = (SELECT auth.uid())
      AND s.status = 'APPROVED'
      AND s.expires_at > pg_catalog.now()
  );
$$;
REVOKE ALL ON FUNCTION public.is_teacher_platform_subscription_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_platform_subscription_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_teacher_platform_subscription(p_duration_months SMALLINT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  chosen_plan public.platform_subscription_plans%ROWTYPE;
  new_subscription_id UUID;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor_id AND p.role = 'TEACHER') THEN
    RAISE EXCEPTION 'A teacher account is required.';
  END IF;

  UPDATE public.teacher_platform_subscriptions s
  SET status = 'EXPIRED'
  WHERE s.teacher_id = actor_id AND s.status = 'APPROVED' AND s.expires_at <= pg_catalog.now();
  UPDATE public.profiles p
  SET teacher_status = 'EXPIRED'
  WHERE p.id = actor_id AND p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM public.teacher_platform_subscriptions s
      WHERE s.teacher_id = actor_id AND s.status = 'APPROVED' AND s.expires_at > pg_catalog.now()
    );

  IF EXISTS (
    SELECT 1 FROM public.teacher_platform_subscriptions s
    WHERE s.teacher_id = actor_id AND s.status = 'APPROVED' AND s.expires_at > pg_catalog.now()
  ) THEN
    RAISE EXCEPTION 'An active teacher subscription already exists.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.teacher_platform_subscriptions s
    WHERE s.teacher_id = actor_id AND s.status IN ('PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_REVIEW')
  ) THEN
    RAISE EXCEPTION 'A teacher subscription request is already in progress.';
  END IF;

  SELECT * INTO chosen_plan
  FROM public.platform_subscription_plans p
  WHERE p.duration_months = p_duration_months AND p.is_active AND p.price IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This subscription plan is unavailable.'; END IF;

  INSERT INTO public.teacher_platform_subscriptions (teacher_id, plan_id, duration_months, amount_due)
  VALUES (actor_id, chosen_plan.id, chosen_plan.duration_months, chosen_plan.price)
  RETURNING id INTO new_subscription_id;
  UPDATE public.profiles SET teacher_status = 'PENDING' WHERE id = actor_id AND role = 'TEACHER';

  RETURN new_subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_teacher_platform_payment(
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
  actor_id UUID := auth.uid();
  subscription_row public.teacher_platform_subscriptions%ROWTYPE;
  new_payment_id UUID;
  normalized_notes TEXT := NULLIF(pg_catalog.btrim(p_notes), '');
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF p_transferred_amount IS NULL OR p_transferred_amount <= 0 THEN
    RAISE EXCEPTION 'Transferred amount must be positive.';
  END IF;
  IF p_payment_id IS NULL OR p_receipt_path IS NULL OR NOT (
    p_receipt_path = (actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.jpg')
    OR p_receipt_path = (actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.jpeg')
    OR p_receipt_path = (actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.png')
    OR p_receipt_path = (actor_id::TEXT || '/' || p_subscription_id::TEXT || '/' || p_payment_id::TEXT || '.webp')
  ) THEN
    RAISE EXCEPTION 'Receipt path is invalid.';
  END IF;
  IF normalized_notes IS NOT NULL AND pg_catalog.char_length(normalized_notes) > 1000 THEN
    RAISE EXCEPTION 'Notes are too long.';
  END IF;

  SELECT * INTO subscription_row
  FROM public.teacher_platform_subscriptions s
  WHERE s.id = p_subscription_id AND s.teacher_id = actor_id
  FOR UPDATE;
  IF NOT FOUND OR subscription_row.status <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'The teacher subscription is not awaiting payment.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = actor_id AND p.role = 'TEACHER'
  ) THEN RAISE EXCEPTION 'A teacher account is required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_payment_methods m WHERE m.id = p_payment_method_id AND m.is_active
  ) THEN RAISE EXCEPTION 'This payment method is unavailable.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'teacher-payment-receipts' AND o.name = p_receipt_path
  ) THEN RAISE EXCEPTION 'The uploaded payment receipt could not be found.'; END IF;

  INSERT INTO public.teacher_platform_payments (
    id, subscription_id, teacher_id, payment_method_id, transferred_amount, receipt_path, notes
  ) VALUES (
    p_payment_id, p_subscription_id, actor_id, p_payment_method_id, p_transferred_amount, p_receipt_path, normalized_notes
  ) RETURNING id INTO new_payment_id;

  UPDATE public.teacher_platform_subscriptions
  SET status = 'PAYMENT_SUBMITTED', submitted_at = pg_catalog.now()
  WHERE id = p_subscription_id;
  UPDATE public.profiles SET teacher_status = 'PENDING' WHERE id = actor_id;

  RETURN new_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_teacher_platform_subscription(p_subscription_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  UPDATE public.teacher_platform_subscriptions s
  SET status = 'CANCELLED'
  WHERE s.id = p_subscription_id
    AND s.teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'TEACHER')
    AND s.status = 'PENDING_PAYMENT'
    AND NOT EXISTS (
      SELECT 1 FROM public.teacher_platform_payments p WHERE p.subscription_id = s.id
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'This pending subscription cannot be cancelled.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_subscription_plan(
  p_duration_months SMALLINT,
  p_price NUMERIC,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  IF p_duration_months NOT IN (1, 3, 6) THEN RAISE EXCEPTION 'Only 1, 3, or 6 month plans are supported.'; END IF;
  IF p_price IS NULL OR p_price <= 0 THEN RAISE EXCEPTION 'Plan price must be positive.'; END IF;

  INSERT INTO public.platform_subscription_plans (duration_months, price, is_active, updated_at)
  VALUES (p_duration_months, p_price, p_is_active, pg_catalog.now())
  ON CONFLICT (duration_months) DO UPDATE
    SET price = EXCLUDED.price, is_active = EXCLUDED.is_active, updated_at = pg_catalog.now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_payment_method(
  p_id UUID,
  p_provider TEXT,
  p_account_holder TEXT,
  p_account_identifier TEXT,
  p_instructions TEXT,
  p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_id UUID;
  normalized_holder TEXT := pg_catalog.btrim(p_account_holder);
  normalized_identifier TEXT := pg_catalog.btrim(p_account_identifier);
BEGIN
  IF NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  IF p_provider NOT IN ('INSTAPAY', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH', 'WE_PAY') THEN
    RAISE EXCEPTION 'Unsupported payment provider.';
  END IF;
  IF pg_catalog.char_length(normalized_holder) NOT BETWEEN 2 AND 120
    OR pg_catalog.char_length(normalized_identifier) NOT BETWEEN 3 AND 160 THEN
    RAISE EXCEPTION 'Valid payment account details are required.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.platform_payment_methods (provider, account_holder, account_identifier, instructions, is_active)
    VALUES (p_provider, normalized_holder, normalized_identifier, NULLIF(pg_catalog.btrim(p_instructions), ''), p_is_active)
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.platform_payment_methods
    SET provider = p_provider, account_holder = normalized_holder,
        account_identifier = normalized_identifier,
        instructions = NULLIF(pg_catalog.btrim(p_instructions), ''),
        is_active = p_is_active, updated_at = pg_catalog.now()
    WHERE id = p_id
    RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RAISE EXCEPTION 'Payment method was not found.'; END IF;
  END IF;
  RETURN saved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_teacher_payment_queue()
RETURNS TABLE (
  payment_id UUID,
  subscription_id UUID,
  teacher_id UUID,
  teacher_name TEXT,
  teacher_email TEXT,
  duration_months SMALLINT,
  amount_due NUMERIC,
  transferred_amount NUMERIC,
  payment_provider TEXT,
  payment_account_identifier TEXT,
  receipt_path TEXT,
  notes TEXT,
  payment_status TEXT,
  subscription_status TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  RETURN QUERY
  SELECT pay.id, sub.id, p.id, p.full_name, u.email::TEXT,
         sub.duration_months, sub.amount_due, pay.transferred_amount,
         method.provider, method.account_identifier, pay.receipt_path,
         pay.notes, pay.status, sub.status, pay.rejection_reason, pay.submitted_at
  FROM public.teacher_platform_payments pay
  JOIN public.teacher_platform_subscriptions sub ON sub.id = pay.subscription_id
  JOIN public.profiles p ON p.id = pay.teacher_id
  JOIN auth.users u ON u.id = pay.teacher_id
  JOIN public.platform_payment_methods method ON method.id = pay.payment_method_id
  ORDER BY pay.submitted_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_teacher_payment(p_payment_id UUID, p_approve BOOLEAN, p_rejection_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment_row public.teacher_platform_payments%ROWTYPE;
  subscription_row public.teacher_platform_subscriptions%ROWTYPE;
  normalized_reason TEXT := NULLIF(pg_catalog.btrim(p_rejection_reason), '');
BEGIN
  IF NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  IF NOT p_approve AND (normalized_reason IS NULL OR pg_catalog.char_length(normalized_reason) NOT BETWEEN 3 AND 1000) THEN
    RAISE EXCEPTION 'A rejection reason between 3 and 1000 characters is required.';
  END IF;

  SELECT * INTO payment_row
  FROM public.teacher_platform_payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND OR payment_row.status NOT IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'This payment is not awaiting review.';
  END IF;

  SELECT * INTO subscription_row
  FROM public.teacher_platform_subscriptions s
  WHERE s.id = payment_row.subscription_id
  FOR UPDATE;
  IF subscription_row.status NOT IN ('PAYMENT_SUBMITTED', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'This subscription is not awaiting review.';
  END IF;

  IF p_approve THEN
    UPDATE public.teacher_platform_payments
    SET status = 'APPROVED', reviewed_at = pg_catalog.now(), reviewed_by = auth.uid(), rejection_reason = NULL
    WHERE id = p_payment_id;
    UPDATE public.teacher_platform_subscriptions
    SET status = 'APPROVED', approved_at = pg_catalog.now(),
        expires_at = pg_catalog.now() + pg_catalog.make_interval(months => subscription_row.duration_months)
    WHERE id = subscription_row.id;
    UPDATE public.profiles SET teacher_status = 'ACTIVE' WHERE id = subscription_row.teacher_id AND role = 'TEACHER';
    IF NOT FOUND THEN RAISE EXCEPTION 'Teacher profile could not be activated.'; END IF;
  ELSE
    UPDATE public.teacher_platform_payments
    SET status = 'REJECTED', reviewed_at = pg_catalog.now(), reviewed_by = auth.uid(), rejection_reason = normalized_reason
    WHERE id = p_payment_id;
    UPDATE public.teacher_platform_subscriptions
    SET status = 'REJECTED', rejected_at = pg_catalog.now()
    WHERE id = subscription_row.id;
    UPDATE public.profiles SET teacher_status = 'PENDING' WHERE id = subscription_row.teacher_id AND role = 'TEACHER';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_teacher_platform_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.teacher_platform_subscriptions
  SET status = 'EXPIRED'
  WHERE status = 'APPROVED' AND expires_at <= pg_catalog.now();
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  UPDATE public.profiles p
  SET teacher_status = 'EXPIRED'
  WHERE p.role = 'TEACHER' AND p.teacher_status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM public.teacher_platform_subscriptions s
      WHERE s.teacher_id = p.id AND s.status = 'APPROVED' AND s.expires_at > pg_catalog.now()
    );
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_teacher_platform_subscription(SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_teacher_platform_subscription(SMALLINT) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_teacher_platform_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_teacher_platform_payment(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_teacher_platform_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_teacher_platform_subscription(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_save_subscription_plan(SMALLINT, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_subscription_plan(SMALLINT, NUMERIC, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_save_payment_method(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_payment_method(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_get_teacher_payment_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_teacher_payment_queue() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_teacher_payment(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_teacher_payment(UUID, BOOLEAN, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_teacher_platform_subscriptions() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.expire_teacher_platform_subscriptions() IS
  'Run from trusted Supabase Cron (or another trusted scheduler) periodically. Teacher access also checks expires_at synchronously.';

-- Receipts are private, immutable after upload, and scoped to their teacher/subscription.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-payment-receipts', 'teacher-payment-receipts', FALSE, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Teachers upload receipts to their own pending subscription"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-payment-receipts'
    AND CASE
      WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
      THEN (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND EXISTS (
          SELECT 1 FROM public.teacher_platform_subscriptions s
          WHERE s.id = ((storage.foldername(name))[2])::UUID
            AND s.teacher_id = (SELECT auth.uid())
            AND s.status = 'PENDING_PAYMENT'
        )
      ELSE FALSE
    END
  );

CREATE POLICY "Teachers and admins view authorized payment receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-payment-receipts'
    AND (
      public.is_classy_admin()
      OR CASE
        WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
        THEN (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
          AND EXISTS (
            SELECT 1 FROM public.teacher_platform_subscriptions s
            WHERE s.id = ((storage.foldername(name))[2])::UUID
              AND s.teacher_id = (SELECT auth.uid())
          )
        ELSE FALSE
      END
    )
  );

CREATE POLICY "Teachers can remove their unused receipt uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-payment-receipts'
    AND CASE
      WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
      THEN (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND EXISTS (
          SELECT 1 FROM public.teacher_platform_subscriptions s
          WHERE s.id = ((storage.foldername(name))[2])::UUID
            AND s.teacher_id = (SELECT auth.uid())
            AND s.status = 'PENDING_PAYMENT'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.teacher_platform_payments p WHERE p.receipt_path = name
        )
      ELSE FALSE
    END
  );

-- There is intentionally no UPDATE policy, so an uploaded receipt cannot be replaced.
