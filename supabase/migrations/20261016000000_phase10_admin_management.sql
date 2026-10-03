-- Phase 10: narrow, role-checked administration reads, review moderation, and audit history.
-- Existing business mutations (especially teacher payment review) remain on their Phase 03 RPCs.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (pg_catalog.char_length(action) BETWEEN 3 AND 100),
  target_type TEXT NOT NULL CHECK (pg_catalog.char_length(target_type) BETWEEN 2 AND 60),
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (pg_catalog.octet_length(metadata::TEXT) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON public.admin_audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON public.admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON public.admin_audit_logs (target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_teacher_name_prefix_idx ON public.profiles (lower(full_name) text_pattern_ops) WHERE role='TEACHER';
CREATE INDEX IF NOT EXISTS profiles_student_name_prefix_idx ON public.profiles (lower(full_name) text_pattern_ops) WHERE role='STUDENT';
CREATE INDEX IF NOT EXISTS profiles_teacher_phone_prefix_idx ON public.profiles (phone text_pattern_ops) WHERE role='TEACHER' AND phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_student_phone_prefix_idx ON public.profiles (phone text_pattern_ops) WHERE role='STUDENT' AND phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_teacher_admin_created_idx ON public.profiles (created_at DESC,id) WHERE role='TEACHER';
CREATE INDEX IF NOT EXISTS profiles_student_admin_created_idx ON public.profiles (created_at DESC,id) WHERE role='STUDENT';
CREATE INDEX IF NOT EXISTS teacher_profiles_subjects_admin_gin_idx ON public.teacher_profiles USING GIN (subjects);
CREATE INDEX IF NOT EXISTS teacher_groups_admin_stage_teacher_idx ON public.teacher_groups (educational_stage,teacher_id);
CREATE INDEX IF NOT EXISTS teacher_groups_admin_subject_teacher_idx ON public.teacher_groups (subject,teacher_id);
CREATE INDEX IF NOT EXISTS teacher_platform_subscriptions_admin_created_idx ON public.teacher_platform_subscriptions (created_at DESC,id);
CREATE INDEX IF NOT EXISTS student_teacher_subscriptions_admin_created_idx ON public.student_teacher_subscriptions (created_at DESC,id);
CREATE INDEX IF NOT EXISTS student_teacher_subscriptions_admin_status_idx ON public.student_teacher_subscriptions (status,created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_admin_created_idx ON public.reviews (created_at DESC,id);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.write_admin_audit_log(
  p_action TEXT, p_target_type TEXT, p_target_id UUID, p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid());
BEGIN
  IF actor IS NULL OR NOT public.is_classy_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;
  INSERT INTO public.admin_audit_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (actor, p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::JSONB));
END;
$$;
REVOKE ALL ON FUNCTION private.write_admin_audit_log(TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.audit_admin_setting_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid());
target UUID;
BEGIN
  IF actor IS NOT NULL AND public.is_classy_admin() THEN
    target := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    IF TG_TABLE_NAME = 'platform_subscription_plans' THEN
      INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,metadata)
      VALUES(actor,'ADMIN_UPDATED_PLAN','platform_plan',target,jsonb_build_object(
        'duration_months',CASE WHEN TG_OP='DELETE' THEN OLD.duration_months ELSE NEW.duration_months END,
        'is_active',CASE WHEN TG_OP='DELETE' THEN OLD.is_active ELSE NEW.is_active END));
    ELSE
      INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,metadata)
      VALUES(actor,'ADMIN_UPDATED_PAYMENT_METHOD','platform_payment_method',target,jsonb_build_object(
        'provider',CASE WHEN TG_OP='DELETE' THEN OLD.provider ELSE NEW.provider END,
        'is_active',CASE WHEN TG_OP='DELETE' THEN OLD.is_active ELSE NEW.is_active END));
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_admin_setting_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_platform_plan_changes ON public.platform_subscription_plans;
CREATE TRIGGER audit_platform_plan_changes AFTER INSERT OR UPDATE OR DELETE ON public.platform_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION private.audit_admin_setting_change();
DROP TRIGGER IF EXISTS audit_platform_payment_method_changes ON public.platform_payment_methods;
CREATE TRIGGER audit_platform_payment_method_changes AFTER INSERT OR UPDATE OR DELETE ON public.platform_payment_methods
  FOR EACH ROW EXECUTE FUNCTION private.audit_admin_setting_change();

CREATE OR REPLACE FUNCTION private.audit_admin_teacher_payment_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by=(SELECT auth.uid()) AND public.is_classy_admin()
      AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,metadata)
    VALUES(NEW.reviewed_by,
      CASE WHEN NEW.status='APPROVED' THEN 'ADMIN_APPROVED_TEACHER_PAYMENT' ELSE 'ADMIN_REJECTED_TEACHER_PAYMENT' END,
      'teacher_platform_payment',NEW.id,
      jsonb_build_object('subscription_id',NEW.subscription_id,'status',NEW.status,
                         'transferred_amount',NEW.transferred_amount,'teacher_id',NEW.teacher_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_admin_teacher_payment_review() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS audit_teacher_platform_payment_review ON public.teacher_platform_payments;
CREATE TRIGGER audit_teacher_platform_payment_review AFTER UPDATE ON public.teacher_platform_payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_admin_teacher_payment_review();

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS reviews_visible_teacher_idx ON public.reviews (teacher_id, created_at DESC) WHERE is_visible;

DROP POLICY IF EXISTS "Students teachers and admins read authorized reviews" ON public.reviews;
CREATE POLICY "Students teachers and admins read authorized reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    student_id=(SELECT auth.uid()) OR (teacher_id=(SELECT auth.uid()) AND is_visible) OR public.is_classy_admin()
    OR (is_visible AND public.is_active_teacher_profile(teacher_id))
  );

CREATE OR REPLACE FUNCTION public.admin_list_records(
  p_entity TEXT,
  p_query TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_secondary_status TEXT DEFAULT NULL,
  p_stage TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor UUID := (SELECT auth.uid());
  q TEXT := NULLIF(pg_catalog.btrim(p_query), '');
  lim INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  off INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  total_count BIGINT;
  rows_json JSONB;
BEGIN
  IF actor IS NULL OR NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;

  IF p_entity = 'teachers' THEN
    WITH filtered AS (
      SELECT p.id, p.full_name, p.phone, u.email::TEXT AS email, p.teacher_status, p.created_at,
             tp.subjects, tp.semester,
             sub.status AS platform_status, sub.expires_at,
             COALESCE(grp.group_count,0) AS group_count, COALESCE(stu.student_count,0) AS student_count,
             rev.average_rating, COALESCE(rev.review_count,0) AS review_count
      FROM public.profiles p JOIN auth.users u ON u.id=p.id
      LEFT JOIN public.teacher_profiles tp ON tp.teacher_id=p.id
      LEFT JOIN LATERAL (SELECT CASE WHEN s.status='APPROVED' AND s.expires_at<=pg_catalog.now() THEN 'EXPIRED' ELSE s.status END status,s.expires_at FROM public.teacher_platform_subscriptions s WHERE s.teacher_id=p.id ORDER BY s.created_at DESC LIMIT 1) sub ON TRUE
      LEFT JOIN LATERAL (SELECT count(*)::INTEGER group_count FROM public.teacher_groups g WHERE g.teacher_id=p.id AND g.status='ACTIVE') grp ON TRUE
      LEFT JOIN LATERAL (SELECT count(DISTINCT s.student_id)::INTEGER student_count FROM public.student_teacher_subscriptions s WHERE s.teacher_id=p.id AND s.status='ACTIVE' AND s.expires_at>pg_catalog.now()) stu ON TRUE
      LEFT JOIN LATERAL (SELECT round(avg(r.rating)::NUMERIC,1) average_rating,count(*)::INTEGER review_count FROM public.reviews r WHERE r.teacher_id=p.id AND r.is_visible) rev ON TRUE
      WHERE p.role='TEACHER'
        AND (q IS NULL OR lower(p.full_name) LIKE lower(q)||'%' OR COALESCE(p.phone,'') LIKE q||'%')
        AND (p_status IS NULL OR p.teacher_status=p_status)
        AND (p_secondary_status IS NULL OR sub.status=p_secondary_status)
        AND (p_stage IS NULL OR EXISTS (SELECT 1 FROM public.teacher_groups stage_group WHERE stage_group.teacher_id=p.id AND stage_group.educational_stage=p_stage))
        AND (p_subject IS NULL OR COALESCE(tp.subjects,ARRAY[]::TEXT[]) @> ARRAY[p_subject]::TEXT[])
        AND (p_from IS NULL OR p.created_at::DATE>=p_from) AND (p_to IS NULL OR p.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered), COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'students' THEN
    WITH filtered AS (
      SELECT p.id,p.full_name,p.phone,u.email::TEXT AS email,p.stage,p.grade,p.created_at,
        COALESCE(sub.active_count,0) active_subscriptions, COALESCE(sub.latest_status,'') subscription_status
      FROM public.profiles p JOIN auth.users u ON u.id=p.id
      LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE s.status='ACTIVE' AND s.expires_at>pg_catalog.now())::INTEGER active_count,
          (array_agg(CASE WHEN s.status='ACTIVE' AND s.expires_at<=pg_catalog.now() THEN 'EXPIRED' ELSE s.status END ORDER BY s.created_at DESC))[1] latest_status
        FROM public.student_teacher_subscriptions s WHERE s.student_id=p.id) sub ON TRUE
      WHERE p.role='STUDENT' AND (q IS NULL OR lower(p.full_name) LIKE lower(q)||'%' OR COALESCE(p.phone,'') LIKE q||'%')
        AND (p_stage IS NULL OR p.stage=p_stage) AND (p_status IS NULL OR sub.latest_status=p_status)
        AND (p_from IS NULL OR p.created_at::DATE>=p_from) AND (p_to IS NULL OR p.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'teacher_subscriptions' THEN
    WITH filtered AS (
      SELECT s.id,s.teacher_id,p.full_name teacher_name,u.email::TEXT email,s.duration_months,s.amount_due,s.status,s.created_at,s.submitted_at,s.approved_at,s.expires_at,
        pay.status payment_status,pay.transferred_amount,pay.submitted_at payment_submitted_at,pay.reviewed_at,pay.rejection_reason
      FROM public.teacher_platform_subscriptions s JOIN public.profiles p ON p.id=s.teacher_id JOIN auth.users u ON u.id=p.id
      LEFT JOIN LATERAL (SELECT x.* FROM public.teacher_platform_payments x WHERE x.subscription_id=s.id ORDER BY x.submitted_at DESC LIMIT 1) pay ON TRUE
      WHERE (q IS NULL OR lower(p.full_name) LIKE lower(q)||'%' OR COALESCE(p.phone,'') LIKE q||'%')
        AND (p_status IS NULL OR s.status=p_status) AND (p_secondary_status IS NULL OR pay.status=p_secondary_status)
        AND (p_from IS NULL OR s.created_at::DATE>=p_from) AND (p_to IS NULL OR s.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'student_subscriptions' THEN
    WITH filtered AS (
      SELECT s.id,s.student_id,sp.full_name student_name,s.teacher_id,tp.full_name teacher_name,s.group_id,g.name group_name,g.subject,g.educational_stage,g.grade,
        s.monthly_price_snapshot,s.status,s.created_at,s.submitted_at,s.approved_at,s.started_at,s.expires_at,pay.status payment_status,pay.provider_snapshot,pay.reviewed_at
      FROM public.student_teacher_subscriptions s JOIN public.profiles sp ON sp.id=s.student_id JOIN public.profiles tp ON tp.id=s.teacher_id
      JOIN public.teacher_groups g ON g.id=s.group_id LEFT JOIN public.student_teacher_payments pay ON pay.subscription_id=s.id
      WHERE (q IS NULL OR lower(sp.full_name) LIKE lower(q)||'%' OR lower(tp.full_name) LIKE lower(q)||'%' OR lower(g.name) LIKE lower(q)||'%')
        AND (p_status IS NULL OR s.status=p_status) AND (p_subject IS NULL OR g.subject=p_subject)
        AND (p_from IS NULL OR s.created_at::DATE>=p_from) AND (p_to IS NULL OR s.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'groups' THEN
    WITH filtered AS (
      SELECT g.id,g.name,g.teacher_id,p.full_name teacher_name,g.subject,g.educational_stage,g.grade,g.max_students,g.status,g.created_at,
        COALESCE(sc.items,'[]'::JSONB) schedule,COALESCE(st.active_students,0) active_students
      FROM public.teacher_groups g JOIN public.profiles p ON p.id=g.teacher_id
      LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('weekday',x.weekday,'start_time',x.start_time,'end_time',x.end_time) ORDER BY x.weekday,x.start_time) items FROM public.teacher_group_schedule_slots x WHERE x.group_id=g.id) sc ON TRUE
      LEFT JOIN LATERAL (SELECT count(*)::INTEGER active_students FROM public.student_teacher_subscriptions x WHERE x.group_id=g.id AND x.status='ACTIVE' AND x.expires_at>pg_catalog.now()) st ON TRUE
      WHERE (q IS NULL OR lower(g.name) LIKE lower(q)||'%' OR lower(p.full_name) LIKE lower(q)||'%') AND (p_status IS NULL OR g.status=p_status)
        AND (p_stage IS NULL OR g.educational_stage=p_stage) AND (p_subject IS NULL OR g.subject=p_subject)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'sessions' THEN
    WITH filtered AS (
      SELECT s.id,s.teacher_id,p.full_name teacher_name,s.group_id,g.name group_name,g.subject,g.educational_stage,g.grade,s.session_date,s.start_time,s.end_time,s.status,
        (SELECT count(*)::INTEGER FROM public.class_attendance a WHERE a.session_id=s.id) attendance_count
      FROM public.class_sessions s JOIN public.profiles p ON p.id=s.teacher_id JOIN public.teacher_groups g ON g.id=s.group_id
      WHERE (q IS NULL OR lower(p.full_name) LIKE lower(q)||'%' OR lower(g.name) LIKE lower(q)||'%') AND (p_status IS NULL OR s.status=p_status)
        AND (p_from IS NULL OR s.session_date>=p_from) AND (p_to IS NULL OR s.session_date<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.session_date DESC,page.start_time DESC) FROM (SELECT * FROM filtered ORDER BY session_date DESC,start_time DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'reviews' THEN
    WITH filtered AS (
      SELECT r.id,r.teacher_id,t.full_name teacher_name,r.student_id,s.full_name student_name,r.rating,r.comment,r.created_at,r.is_visible
      FROM public.reviews r JOIN public.profiles t ON t.id=r.teacher_id JOIN public.profiles s ON s.id=r.student_id
      WHERE (q IS NULL OR lower(t.full_name) LIKE lower(q)||'%' OR lower(s.full_name) LIKE lower(q)||'%')
        AND (p_status IS NULL OR (p_status='VISIBLE' AND r.is_visible) OR (p_status='HIDDEN' AND NOT r.is_visible))
        AND (p_secondary_status IS NULL OR r.rating::TEXT=p_secondary_status)
        AND (p_from IS NULL OR r.created_at::DATE>=p_from) AND (p_to IS NULL OR r.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSIF p_entity = 'audit_logs' THEN
    WITH filtered AS (
      SELECT l.id,l.admin_id,p.full_name admin_name,l.action,l.target_type,l.target_id,l.metadata,l.created_at
      FROM public.admin_audit_logs l JOIN public.profiles p ON p.id=l.admin_id
      WHERE (q IS NULL OR lower(l.action) LIKE lower(q)||'%' OR lower(l.target_type) LIKE lower(q)||'%' OR lower(p.full_name) LIKE lower(q)||'%')
        AND (p_status IS NULL OR l.action=p_status) AND (p_secondary_status IS NULL OR l.target_type=p_secondary_status)
        AND (p_from IS NULL OR l.created_at::DATE>=p_from) AND (p_to IS NULL OR l.created_at::DATE<=p_to)
    )
    SELECT (SELECT count(*) FROM filtered),COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT lim OFFSET off) page),'[]'::JSONB) INTO total_count,rows_json;
  ELSE
    RAISE EXCEPTION 'Unsupported administration list.';
  END IF;
  RETURN jsonb_build_object('rows',COALESCE(rows_json,'[]'::JSONB),'total',COALESCE(total_count,0),'offset',off,'limit',lim);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_record_details(p_entity TEXT,p_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB; actor UUID := (SELECT auth.uid());
BEGIN
  IF actor IS NULL OR NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  IF p_entity='teacher' THEN
    SELECT jsonb_build_object('profile',to_jsonb(p),'email',u.email,'teacher_profile',to_jsonb(tp),
      'groups',(SELECT COALESCE(jsonb_agg(to_jsonb(g)||jsonb_build_object('schedule',COALESCE(sl.items,'[]'::JSONB),'active_students',COALESCE(cnt.n,0))),'[]'::JSONB) FROM public.teacher_groups g
        LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('weekday',x.weekday,'start_time',x.start_time,'end_time',x.end_time) ORDER BY x.weekday,x.start_time) items FROM public.teacher_group_schedule_slots x WHERE x.group_id=g.id) sl ON TRUE
        LEFT JOIN LATERAL (SELECT count(*)::INTEGER n FROM public.student_teacher_subscriptions s WHERE s.group_id=g.id AND s.status='ACTIVE' AND s.expires_at>now()) cnt ON TRUE WHERE g.teacher_id=p.id),
      'subscriptions',(SELECT COALESCE(jsonb_agg(to_jsonb(s)||jsonb_build_object('payments',COALESCE(pay.items,'[]'::JSONB)) ORDER BY s.created_at DESC),'[]'::JSONB) FROM public.teacher_platform_subscriptions s
        LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'amount',x.transferred_amount,'receipt_path',x.receipt_path,'receipt_bucket','teacher-payment-receipts','payment_method',jsonb_build_object('provider',m.provider,'account_identifier',m.account_identifier),'submitted_at',x.submitted_at,'reviewed_at',x.reviewed_at,'rejection_reason',x.rejection_reason)) items FROM public.teacher_platform_payments x JOIN public.platform_payment_methods m ON m.id=x.payment_method_id WHERE x.subscription_id=s.id) pay ON TRUE WHERE s.teacher_id=p.id),
      'student_subscriptions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'student_name',sp.full_name,'group_name',g.name,'status',s.status,'started_at',s.started_at,'expires_at',s.expires_at) ORDER BY s.created_at DESC),'[]'::JSONB) FROM public.student_teacher_subscriptions s JOIN public.profiles sp ON sp.id=s.student_id JOIN public.teacher_groups g ON g.id=s.group_id WHERE s.teacher_id=p.id),
      'sessions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'group_name',g.name,'session_date',s.session_date,'start_time',s.start_time,'end_time',s.end_time,'status',s.status,'attendance_count',(SELECT count(*) FROM public.class_attendance a WHERE a.session_id=s.id)) ORDER BY s.session_date DESC),'[]'::JSONB) FROM public.class_sessions s JOIN public.teacher_groups g ON g.id=s.group_id WHERE s.teacher_id=p.id),
      'reviews',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'student_name',sp.full_name,'rating',r.rating,'comment',r.comment,'is_visible',r.is_visible,'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::JSONB) FROM public.reviews r JOIN public.profiles sp ON sp.id=r.student_id WHERE r.teacher_id=p.id)) INTO result
    FROM public.profiles p JOIN auth.users u ON u.id=p.id LEFT JOIN public.teacher_profiles tp ON tp.teacher_id=p.id WHERE p.id=p_id AND p.role='TEACHER';
  ELSIF p_entity='student' THEN
    SELECT jsonb_build_object('profile',to_jsonb(p),'email',u.email,
      'subscriptions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'teacher_name',tp.full_name,'group_name',g.name,'status',s.status,'price',s.monthly_price_snapshot,'started_at',s.started_at,'expires_at',s.expires_at,'payment',jsonb_build_object('status',pay.status,'amount',pay.transferred_amount,'provider',pay.provider_snapshot,'receipt_path',pay.receipt_path,'receipt_bucket','student-payment-receipts','submitted_at',pay.submitted_at,'reviewed_at',pay.reviewed_at)) ORDER BY s.created_at DESC),'[]'::JSONB) FROM public.student_teacher_subscriptions s JOIN public.profiles tp ON tp.id=s.teacher_id JOIN public.teacher_groups g ON g.id=s.group_id LEFT JOIN public.student_teacher_payments pay ON pay.subscription_id=s.id WHERE s.student_id=p.id),
      'attendance',(SELECT COALESCE(jsonb_agg(jsonb_build_object('session_id',s.id,'group_name',g.name,'session_date',s.session_date,'status',a.status,'attended_at',a.attended_at) ORDER BY s.session_date DESC),'[]'::JSONB) FROM public.class_attendance a JOIN public.class_sessions s ON s.id=a.session_id JOIN public.teacher_groups g ON g.id=s.group_id WHERE a.student_id=p.id),
      'reviews',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'teacher_name',tp.full_name,'rating',r.rating,'comment',r.comment,'created_at',r.created_at)),'[]'::JSONB) FROM public.reviews r JOIN public.profiles tp ON tp.id=r.teacher_id WHERE r.student_id=p.id)) INTO result
    FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_id AND p.role='STUDENT';
  ELSIF p_entity='session' THEN
    SELECT jsonb_build_object('id',s.id,'session_date',s.session_date,'start_time',s.start_time,'end_time',s.end_time,'status',s.status,'attendance_open',s.attendance_open,'teacher_name',tp.full_name,'group_name',g.name,'subject',g.subject,'attendance',COALESCE(a.attendance_items,'[]'::JSONB)) INTO result
    FROM public.class_sessions s JOIN public.profiles tp ON tp.id=s.teacher_id JOIN public.teacher_groups g ON g.id=s.group_id
    LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('student_id',p.id,'student_name',p.full_name,'status',ca.status,'attended_at',ca.attended_at) ORDER BY p.full_name) AS attendance_items FROM public.class_attendance ca JOIN public.profiles p ON p.id=ca.student_id WHERE ca.session_id=s.id) a ON TRUE WHERE s.id=p_id;
  ELSE RAISE EXCEPTION 'Unsupported administration record.';
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'Record not found.'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_review_visibility(p_review_id UUID,p_is_visible BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid());
DECLARE review_row public.reviews%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  IF p_is_visible IS NULL THEN RAISE EXCEPTION 'A moderation state is required.'; END IF;
  SELECT * INTO review_row FROM public.reviews WHERE id=p_review_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review was not found.'; END IF;
  IF review_row.is_visible IS DISTINCT FROM p_is_visible THEN
    UPDATE public.reviews SET is_visible=p_is_visible,updated_at=pg_catalog.now() WHERE id=p_review_id;
    PERFORM private.write_admin_audit_log(CASE WHEN p_is_visible THEN 'ADMIN_RESTORED_REVIEW' ELSE 'ADMIN_HID_REVIEW' END,'review',p_review_id,
      jsonb_build_object('rating',review_row.rating,'teacher_id',review_row.teacher_id));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_query TEXT DEFAULT NULL,p_action TEXT DEFAULT NULL,p_target_type TEXT DEFAULT NULL,p_from DATE DEFAULT NULL,p_to DATE DEFAULT NULL,p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 20)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.admin_list_records('audit_logs',p_query,p_action,p_target_type,NULL,NULL,p_from,p_to,p_offset,p_limit)
$$;

REVOKE ALL ON FUNCTION public.admin_list_records(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,DATE,INTEGER,INTEGER),
  public.admin_get_record_details(TEXT,UUID),public.admin_set_review_visibility(UUID,BOOLEAN),
  public.admin_list_audit_logs(TEXT,TEXT,TEXT,DATE,DATE,INTEGER,INTEGER)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_records(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,DATE,INTEGER,INTEGER),
  public.admin_get_record_details(TEXT,UUID),public.admin_set_review_visibility(UUID,BOOLEAN),
  public.admin_list_audit_logs(TEXT,TEXT,TEXT,DATE,DATE,INTEGER,INTEGER) TO authenticated;

-- Reviews remain stored. Hidden reviews are excluded from public and teacher rating views.
CREATE OR REPLACE FUNCTION private.get_public_teacher_review_page(p_teacher_id UUID,p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 10)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB; safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit,10),1),20); safe_offset INTEGER := GREATEST(COALESCE(p_offset,0),0);
BEGIN
  IF p_teacher_id IS NULL OR NOT public.is_active_teacher_profile(p_teacher_id) THEN RAISE EXCEPTION 'Teacher not found.'; END IF;
  SELECT jsonb_build_object('summary',jsonb_build_object('average_rating',stats.average_rating,'review_count',stats.review_count),
    'distribution',distribution.items,'reviews',page.items,'has_more',stats.review_count>safe_offset+safe_limit) INTO result
  FROM (SELECT round(avg(r.rating)::NUMERIC,1) average_rating,count(*)::INTEGER review_count FROM public.reviews r WHERE r.teacher_id=p_teacher_id AND r.is_visible) stats
  CROSS JOIN LATERAL (SELECT COALESCE(jsonb_agg(jsonb_build_object('rating',ratings.value,'count',ratings.total) ORDER BY ratings.value DESC),'[]'::JSONB) items FROM
    (SELECT vals.rating value,COALESCE(c.total,0)::INTEGER total FROM generate_series(1,5) vals(rating) LEFT JOIN
      (SELECT r.rating,count(*) total FROM public.reviews r WHERE r.teacher_id=p_teacher_id AND r.is_visible GROUP BY r.rating) c ON c.rating=vals.rating) ratings) distribution
  CROSS JOIN LATERAL (SELECT COALESCE(jsonb_agg(jsonb_build_object('display_name',COALESCE(NULLIF(btrim(student.full_name),''),'طالب'),'rating',r.rating,'comment',r.comment,'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::JSONB) items
    FROM (SELECT x.student_id,x.rating,x.comment,x.created_at FROM public.reviews x WHERE x.teacher_id=p_teacher_id AND x.is_visible ORDER BY x.created_at DESC OFFSET safe_offset LIMIT safe_limit) r
    JOIN public.profiles student ON student.id=r.student_id) page;
  RETURN result;
END;
$$;

-- Keep dashboard analytics aligned with review moderation without changing its response contract.
CREATE OR REPLACE FUNCTION public.get_teacher_phase09_analytics(p_start DATE DEFAULT NULL,p_end DATE DEFAULT NULL,p_group_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid()); result JSONB;
range_start DATE := COALESCE(p_start,(pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE-29);
range_end DATE := COALESCE(p_end,(pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE);
avg_rating NUMERIC; review_total INTEGER; distribution JSONB; recent JSONB;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND p.role='TEACHER') THEN RAISE EXCEPTION 'A teacher account is required.'; END IF;
  result := private.get_teacher_phase09_analytics(p_start,p_end,p_group_id);
  SELECT round(avg(r.rating)::NUMERIC,1),count(*)::INTEGER,
    jsonb_build_object('1',count(*) FILTER(WHERE r.rating=1),'2',count(*) FILTER(WHERE r.rating=2),'3',count(*) FILTER(WHERE r.rating=3),'4',count(*) FILTER(WHERE r.rating=4),'5',count(*) FILTER(WHERE r.rating=5))
    INTO avg_rating,review_total,distribution
  FROM public.reviews r JOIN public.student_teacher_subscriptions s ON s.id=r.subscription_id
  WHERE r.teacher_id=actor AND r.is_visible AND (p_group_id IS NULL OR s.group_id=p_group_id)
    AND (r.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('display_name',COALESCE(NULLIF(btrim(p.full_name),''),'طالب'),'rating',r.rating,'comment',r.comment,'created_at',r.created_at) ORDER BY r.created_at DESC),'[]'::JSONB)
    INTO recent FROM (SELECT r.* FROM public.reviews r JOIN public.student_teacher_subscriptions s ON s.id=r.subscription_id
      WHERE r.teacher_id=actor AND r.is_visible AND (p_group_id IS NULL OR s.group_id=p_group_id)
        AND (r.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end ORDER BY r.created_at DESC LIMIT 5) r
    JOIN public.profiles p ON p.id=r.student_id;
  result := jsonb_set(result,'{metrics,average_rating}',COALESCE(to_jsonb(avg_rating),'null'::JSONB),TRUE);
  result := jsonb_set(result,'{metrics,review_count}',to_jsonb(review_total),TRUE);
  result := jsonb_set(result,'{metrics,rating_distribution}',distribution,TRUE);
  result := jsonb_set(result,'{metrics,recent_reviews}',recent,TRUE);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_phase09_analytics(p_start DATE DEFAULT NULL,p_end DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid()); result JSONB;
range_start DATE := COALESCE(p_start,(pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE-29);
range_end DATE := COALESCE(p_end,(pg_catalog.now() AT TIME ZONE 'Africa/Cairo')::DATE);
avg_rating NUMERIC; review_total INTEGER; distribution JSONB;
BEGIN
  IF actor IS NULL OR NOT public.is_classy_admin() THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
  result := private.get_admin_phase09_analytics(p_start,p_end);
  SELECT round(avg(r.rating)::NUMERIC,1),count(*)::INTEGER,
    jsonb_build_object('1',count(*) FILTER(WHERE r.rating=1),'2',count(*) FILTER(WHERE r.rating=2),'3',count(*) FILTER(WHERE r.rating=3),'4',count(*) FILTER(WHERE r.rating=4),'5',count(*) FILTER(WHERE r.rating=5))
    INTO avg_rating,review_total,distribution FROM public.reviews r
  WHERE r.is_visible AND (r.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end;
  result := jsonb_set(result,'{metrics,average_rating}',COALESCE(to_jsonb(avg_rating),'null'::JSONB),TRUE);
  result := jsonb_set(result,'{metrics,review_count}',to_jsonb(review_total),TRUE);
  result := jsonb_set(result,'{rating_distribution}',distribution,TRUE);
  result := jsonb_set(result,'{monthly_activity}',COALESCE((SELECT jsonb_agg(jsonb_set(month_row.item,'{reviews}',to_jsonb(COALESCE(month_count.total,0)),TRUE) ORDER BY month_row.ordinality)
    FROM jsonb_array_elements(result->'monthly_activity') WITH ORDINALITY AS month_row(item,ordinality)
    LEFT JOIN LATERAL (SELECT count(*)::INTEGER total FROM public.reviews r WHERE r.is_visible
      AND (r.created_at AT TIME ZONE 'Africa/Cairo')::DATE BETWEEN range_start AND range_end
      AND date_trunc('month',(r.created_at AT TIME ZONE 'Africa/Cairo'))::DATE=(month_row.item->>'month')::DATE) month_count ON TRUE),'[]'::JSONB),TRUE);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_public_teacher_review_summaries(p_teacher_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB;
BEGIN
  IF p_teacher_ids IS NULL OR cardinality(p_teacher_ids)>100 THEN RAISE EXCEPTION 'A valid teacher list is required.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('teacher_id',requested.teacher_id,'average_rating',stats.average_rating,'review_count',stats.review_count) ORDER BY requested.teacher_id),'[]'::JSONB)
  INTO result FROM (SELECT DISTINCT unnest(p_teacher_ids) teacher_id) requested
  JOIN LATERAL (SELECT round(avg(r.rating)::NUMERIC,1) average_rating,count(*)::INTEGER review_count FROM public.reviews r WHERE r.teacher_id=requested.teacher_id AND r.is_visible) stats ON TRUE
  WHERE public.is_active_teacher_profile(requested.teacher_id);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_teacher_review_dashboard()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := (SELECT auth.uid()); result JSONB;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND p.role='TEACHER') THEN RAISE EXCEPTION 'A teacher account is required.'; END IF;
  SELECT jsonb_build_object('average_rating',stats.average_rating,'review_count',stats.review_count,'recent_reviews',COALESCE(recent.items,'[]'::JSONB)) INTO result
  FROM (SELECT round(avg(r.rating)::NUMERIC,1) average_rating,count(*)::INTEGER review_count FROM public.reviews r WHERE r.teacher_id=actor AND r.is_visible) stats
  CROSS JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('display_name',COALESCE(NULLIF(btrim(student.full_name),''),'طالب'),'rating',r.rating,'comment',r.comment,'created_at',r.created_at) ORDER BY r.created_at DESC) items
    FROM (SELECT * FROM public.reviews r WHERE r.teacher_id=actor AND r.is_visible ORDER BY r.created_at DESC LIMIT 5) r JOIN public.profiles student ON student.id=r.student_id) recent;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION private.fetch_landing_teacher_preview()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('teacher_id',eligible.teacher_id,'full_name',eligible.full_name,'avatar_path',eligible.avatar_path,'subjects',eligible.subjects,'teaching_area',eligible.teaching_area,'lesson_title',eligible.lesson_title,'monthly_price',eligible.monthly_price,'average_rating',eligible.average_rating,'review_count',eligible.review_count)
    ORDER BY eligible.average_rating DESC NULLS LAST,eligible.review_count DESC,eligible.full_name),'[]'::JSONB)
  FROM (SELECT teacher.id teacher_id,teacher.full_name,teacher.avatar_url avatar_path,profile.subjects,profile.teaching_area,profile.lesson_title,profile.monthly_price,reviews.average_rating,reviews.review_count
    FROM public.profiles teacher JOIN public.teacher_profiles profile ON profile.teacher_id=teacher.id
    CROSS JOIN LATERAL (SELECT round(avg(r.rating)::NUMERIC,1) average_rating,count(*)::INTEGER review_count FROM public.reviews r WHERE r.teacher_id=teacher.id AND r.is_visible) reviews
    WHERE teacher.role='TEACHER' AND public.is_active_teacher_profile(teacher.id) AND char_length(btrim(teacher.full_name))>=2 AND cardinality(profile.subjects)>0
      AND char_length(btrim(profile.lesson_title))>=2 AND char_length(btrim(profile.teaching_area))>=2 AND char_length(btrim(profile.teaching_address))>=5 AND profile.monthly_price>0
      AND EXISTS(SELECT 1 FROM public.teacher_groups g WHERE g.teacher_id=teacher.id AND g.status='ACTIVE')
      AND EXISTS(SELECT 1 FROM public.teacher_student_payment_methods m WHERE m.teacher_id=teacher.id AND m.is_active)
    ORDER BY reviews.average_rating DESC NULLS LAST,reviews.review_count DESC,teacher.full_name LIMIT 4) eligible
$$;

COMMENT ON TABLE public.admin_audit_logs IS 'Append-only record of significant administrator actions; readable only through role-checked administration RPCs.';
COMMENT ON COLUMN public.reviews.is_visible IS 'Admin moderation flag. Hidden reviews remain stored but are excluded from all public and teacher rating calculations.';
