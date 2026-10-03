-- Phase 08: secure in-app notifications and database-side event delivery.
-- Uses triggers for transactional events and an optional cron-compatible
-- processor for time-based reminders.

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'STUDENT_SUBSCRIPTION_APPROVED', 'STUDENT_SUBSCRIPTION_REJECTED',
    'NEW_STUDENT_SUBSCRIPTION_REQUEST', 'TEACHER_PAYMENT_SUBMITTED',
    'TEACHER_SUBSCRIPTION_APPROVED', 'TEACHER_SUBSCRIPTION_REJECTED',
    'STUDENT_PAYMENT_SUBMITTED', 'SESSION_UPCOMING', 'SESSION_OPENED',
    'SESSION_CANCELLED', 'SESSION_UPDATED', 'ATTENDANCE_RECORDED',
    'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'NEW_REVIEW',
    'GROUP_UPDATED', 'GROUP_ACTIVATED', 'GROUP_DEACTIVATED', 'ADMIN_REVIEW_REQUIRED'
  )),
  title TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(title)) BETWEEN 1 AND 120),
  message TEXT NOT NULL CHECK (pg_catalog.char_length(pg_catalog.btrim(message)) BETWEEN 1 AND 500),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (pg_catalog.jsonb_typeof(metadata) = 'object'),
  dedupe_key TEXT NOT NULL CHECK (pg_catalog.char_length(dedupe_key) BETWEEN 1 AND 240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT notifications_user_dedupe_key UNIQUE (user_id, dedupe_key)
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC, id DESC);
CREATE INDEX notifications_user_unread_created_idx ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE is_read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users mark their own notifications read or unread"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.insert_classy_notification(
  p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT,
  p_metadata JSONB, p_dedupe_key TEXT
)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notifications (user_id, type, title, message, metadata, dedupe_key)
  SELECT p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::JSONB), p_dedupe_key
  WHERE p_user_id IS NOT NULL
  ON CONFLICT (user_id, dedupe_key) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION private.notify_classy_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient UUID; session_start TIMESTAMPTZ; type_value TEXT;
BEGIN
  IF TG_TABLE_NAME = 'student_teacher_subscriptions' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM private.insert_classy_notification(NEW.teacher_id, 'NEW_STUDENT_SUBSCRIPTION_REQUEST',
        'طلب اشتراك جديد', 'لديك طلب اشتراك جديد من طالب.',
        pg_catalog.jsonb_build_object('subscription_id', NEW.id, 'student_id', NEW.student_id, 'group_id', NEW.group_id),
        'student-subscription-request:' || NEW.id::TEXT);
      RETURN NEW;
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'ACTIVE' AND NEW.approved_at IS NOT NULL THEN
        PERFORM private.insert_classy_notification(NEW.student_id, 'STUDENT_SUBSCRIPTION_APPROVED',
          'تم قبول الاشتراك', 'تم قبول اشتراكك مع المدرس ويمكنك الآن الاستفادة من المجموعة.',
          pg_catalog.jsonb_build_object('subscription_id', NEW.id, 'teacher_id', NEW.teacher_id, 'group_id', NEW.group_id),
          'student-subscription-approved:' || NEW.id::TEXT);
      ELSIF NEW.status = 'REJECTED' THEN
        PERFORM private.insert_classy_notification(NEW.student_id, 'STUDENT_SUBSCRIPTION_REJECTED',
          'تم رفض الاشتراك', CASE WHEN NEW.rejection_reason IS NULL THEN 'تم رفض طلب الاشتراك.'
            ELSE 'تم رفض طلب الاشتراك. سبب الرفض: ' || NEW.rejection_reason END,
          pg_catalog.jsonb_build_object('subscription_id', NEW.id, 'teacher_id', NEW.teacher_id, 'group_id', NEW.group_id),
          'student-subscription-rejected:' || NEW.id::TEXT);
      ELSIF NEW.status = 'EXPIRED' THEN
        PERFORM private.insert_classy_notification(NEW.student_id, 'SUBSCRIPTION_EXPIRED',
          'انتهى اشتراكك', 'انتهت فترة اشتراكك في المجموعة.',
          pg_catalog.jsonb_build_object('subscription_id', NEW.id, 'teacher_id', NEW.teacher_id, 'group_id', NEW.group_id),
          'student-subscription-expired:' || NEW.id::TEXT);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'student_teacher_payments' AND TG_OP = 'INSERT' THEN
    PERFORM private.insert_classy_notification(NEW.teacher_id, 'STUDENT_PAYMENT_SUBMITTED',
      'تم إرسال إيصال دفع', 'قام طالب بإرسال إيصال دفع يحتاج إلى المراجعة.',
      pg_catalog.jsonb_build_object('subscription_id', NEW.subscription_id, 'student_id', NEW.student_id),
      'student-payment-submitted:' || NEW.id::TEXT);
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'teacher_platform_payments' AND TG_OP = 'INSERT' THEN
    FOR recipient IN SELECT profile.id FROM public.profiles AS profile WHERE profile.role = 'ADMIN' LOOP
      PERFORM private.insert_classy_notification(recipient, 'ADMIN_REVIEW_REQUIRED',
        'طلب اشتراك مدرس جديد', 'يوجد طلب اشتراك مدرس يحتاج إلى المراجعة.',
        pg_catalog.jsonb_build_object('subscription_id', NEW.subscription_id, 'payment_id', NEW.id, 'teacher_id', NEW.teacher_id),
        'teacher-platform-payment:' || NEW.id::TEXT);
    END LOOP;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'teacher_platform_subscriptions' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'APPROVED' THEN
      PERFORM private.insert_classy_notification(NEW.teacher_id, 'TEACHER_SUBSCRIPTION_APPROVED',
        'تم تفعيل اشتراك المنصة', 'تمت الموافقة على اشتراكك في منصة Classy.',
        pg_catalog.jsonb_build_object('subscription_id', NEW.id), 'teacher-platform-approved:' || NEW.id::TEXT);
    ELSIF NEW.status = 'REJECTED' THEN
      PERFORM private.insert_classy_notification(NEW.teacher_id, 'TEACHER_SUBSCRIPTION_REJECTED',
        'تم رفض الاشتراك', 'تعذرت الموافقة على اشتراكك في المنصة. راجع تفاصيل الدفع.',
        pg_catalog.jsonb_build_object('subscription_id', NEW.id), 'teacher-platform-rejected:' || NEW.id::TEXT);
    ELSIF NEW.status = 'EXPIRED' THEN
      PERFORM private.insert_classy_notification(NEW.teacher_id, 'SUBSCRIPTION_EXPIRED',
        'انتهى اشتراك المنصة', 'انتهت فترة اشتراكك في منصة Classy.',
        pg_catalog.jsonb_build_object('subscription_id', NEW.id), 'teacher-platform-expired:' || NEW.id::TEXT);
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'class_attendance' AND TG_OP = 'INSERT' THEN
    PERFORM private.insert_classy_notification(NEW.student_id, 'ATTENDANCE_RECORDED',
      'تم تسجيل الحضور', 'تم تسجيل حضورك بنجاح.',
      pg_catalog.jsonb_build_object('session_id', NEW.session_id), 'attendance-recorded:' || NEW.id::TEXT);
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'class_sessions' AND TG_OP = 'UPDATE' THEN
    SELECT (NEW.session_date + NEW.start_time) AT TIME ZONE 'Africa/Cairo' INTO session_start;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'OPEN' THEN
      FOR recipient IN
        SELECT DISTINCT subscription.student_id FROM public.student_teacher_subscriptions AS subscription
        WHERE subscription.group_id = NEW.group_id AND subscription.status = 'ACTIVE'
          AND subscription.started_at <= session_start AND subscription.expires_at > session_start
      LOOP
        PERFORM private.insert_classy_notification(recipient, 'SESSION_OPENED', 'تم فتح الحضور',
          'تم فتح تسجيل الحضور للجلسة الحالية.', pg_catalog.jsonb_build_object('session_id', NEW.id, 'group_id', NEW.group_id),
          'session-opened:' || NEW.id::TEXT || ':' || recipient::TEXT);
      END LOOP;
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'CANCELLED' THEN
      FOR recipient IN
        SELECT DISTINCT subscription.student_id FROM public.student_teacher_subscriptions AS subscription
        WHERE subscription.group_id = NEW.group_id AND subscription.status IN ('ACTIVE', 'EXPIRED')
          AND subscription.started_at <= session_start AND subscription.expires_at > session_start
      LOOP
        PERFORM private.insert_classy_notification(recipient, 'SESSION_CANCELLED', 'تم إلغاء الجلسة',
          'تم إلغاء جلسة مجموعتك.', pg_catalog.jsonb_build_object('session_id', NEW.id, 'group_id', NEW.group_id),
          'session-cancelled:' || NEW.id::TEXT || ':' || recipient::TEXT);
      END LOOP;
    ELSIF (OLD.session_date, OLD.start_time, OLD.end_time) IS DISTINCT FROM (NEW.session_date, NEW.start_time, NEW.end_time) THEN
      FOR recipient IN
        SELECT DISTINCT subscription.student_id FROM public.student_teacher_subscriptions AS subscription
        WHERE subscription.group_id = NEW.group_id AND subscription.status IN ('ACTIVE', 'EXPIRED')
          AND subscription.started_at <= session_start AND subscription.expires_at > session_start
      LOOP
        PERFORM private.insert_classy_notification(recipient, 'SESSION_UPDATED', 'تم تعديل موعد الجلسة',
          'تم تحديث موعد جلسة في مجموعتك.', pg_catalog.jsonb_build_object('session_id', NEW.id, 'group_id', NEW.group_id),
          'session-updated:' || NEW.id::TEXT || ':' || NEW.updated_at::TEXT || ':' || recipient::TEXT);
      END LOOP;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'reviews' AND TG_OP = 'INSERT' THEN
    PERFORM private.insert_classy_notification(NEW.teacher_id, 'NEW_REVIEW', 'تقييم جديد',
      'حصلت على تقييم جديد من أحد طلابك.', pg_catalog.jsonb_build_object('review_id', NEW.id),
      'new-review:' || NEW.id::TEXT);
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'teacher_groups' AND TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      type_value := CASE WHEN NEW.status = 'ACTIVE' THEN 'GROUP_ACTIVATED' ELSE 'GROUP_DEACTIVATED' END;
    ELSIF (OLD.name, OLD.subject, OLD.educational_stage, OLD.grade, OLD.max_students) IS DISTINCT FROM
          (NEW.name, NEW.subject, NEW.educational_stage, NEW.grade, NEW.max_students) THEN
      type_value := 'GROUP_UPDATED';
    ELSE
      RETURN NEW;
    END IF;
    FOR recipient IN
      SELECT DISTINCT subscription.student_id FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.group_id = NEW.id AND subscription.status IN ('ACTIVE', 'EXPIRED')
        AND subscription.expires_at > pg_catalog.now()
    LOOP
      PERFORM private.insert_classy_notification(recipient, type_value,
        CASE type_value WHEN 'GROUP_ACTIVATED' THEN 'تم تفعيل المجموعة'
          WHEN 'GROUP_DEACTIVATED' THEN 'تم إيقاف المجموعة' ELSE 'تم تحديث المجموعة' END,
        CASE type_value WHEN 'GROUP_ACTIVATED' THEN 'أصبحت مجموعتك متاحة.'
          WHEN 'GROUP_DEACTIVATED' THEN 'تم إيقاف مجموعتك.' ELSE 'تم تحديث بيانات مجموعتك.' END,
        pg_catalog.jsonb_build_object('group_id', NEW.id),
        'group-change:' || NEW.id::TEXT || ':' || pg_catalog.transaction_timestamp()::TEXT || ':' || recipient::TEXT);
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_group_schedule_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed_group_id UUID; recipient UUID;
BEGIN
  changed_group_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.group_id ELSE NEW.group_id END;
  FOR recipient IN
    SELECT DISTINCT subscription.student_id
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.group_id = changed_group_id
      AND subscription.status IN ('ACTIVE', 'EXPIRED')
      AND subscription.expires_at > pg_catalog.now()
  LOOP
    PERFORM private.insert_classy_notification(recipient, 'GROUP_UPDATED', 'تم تحديث المجموعة',
      'تم تحديث مواعيد مجموعتك.', pg_catalog.jsonb_build_object('group_id', changed_group_id),
      'group-change:' || changed_group_id::TEXT || ':' || pg_catalog.transaction_timestamp()::TEXT || ':' || recipient::TEXT);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.insert_classy_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT),
  private.notify_classy_event(), private.notify_group_schedule_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER notify_student_subscription_insert AFTER INSERT ON public.student_teacher_subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_student_subscription_status AFTER UPDATE OF status ON public.student_teacher_subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_student_payment_insert AFTER INSERT ON public.student_teacher_payments
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_teacher_platform_payment_insert AFTER INSERT ON public.teacher_platform_payments
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_teacher_platform_subscription_status AFTER UPDATE OF status ON public.teacher_platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_attendance_insert AFTER INSERT ON public.class_attendance
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_class_session_update AFTER UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_review_insert AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_teacher_group_update AFTER UPDATE ON public.teacher_groups
  FOR EACH ROW EXECUTE FUNCTION private.notify_classy_event();
CREATE TRIGGER notify_teacher_group_schedule_change
  AFTER INSERT OR UPDATE OR DELETE ON public.teacher_group_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION private.notify_group_schedule_change();

CREATE OR REPLACE FUNCTION public.process_classy_notification_schedule()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient RECORD; session_row RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_classy_admin() THEN
    RAISE EXCEPTION 'Trusted scheduler access is required.';
  END IF;

  FOR recipient IN
    SELECT subscription.id, subscription.student_id, subscription.teacher_id, subscription.group_id
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.status = 'ACTIVE' AND subscription.expires_at > pg_catalog.now()
      AND subscription.expires_at <= pg_catalog.now() + INTERVAL '7 days'
  LOOP
    PERFORM private.insert_classy_notification(recipient.student_id, 'SUBSCRIPTION_EXPIRING',
      'اشتراكك على وشك الانتهاء', 'ينتهي اشتراكك خلال 7 أيام أو أقل.',
      pg_catalog.jsonb_build_object('subscription_id', recipient.id, 'teacher_id', recipient.teacher_id, 'group_id', recipient.group_id),
      'student-subscription-expiring:' || recipient.id::TEXT);
  END LOOP;

  FOR recipient IN
    SELECT subscription.id, subscription.teacher_id
    FROM public.teacher_platform_subscriptions AS subscription
    WHERE subscription.status = 'APPROVED' AND subscription.expires_at > pg_catalog.now()
      AND subscription.expires_at <= pg_catalog.now() + INTERVAL '7 days'
  LOOP
    PERFORM private.insert_classy_notification(recipient.teacher_id, 'SUBSCRIPTION_EXPIRING',
      'اشتراكك على وشك الانتهاء', 'ينتهي اشتراكك في Classy خلال 7 أيام أو أقل.',
      pg_catalog.jsonb_build_object('subscription_id', recipient.id),
      'teacher-platform-expiring:' || recipient.id::TEXT);
  END LOOP;

  FOR recipient IN
    SELECT subscription.id, subscription.student_id, subscription.teacher_id, subscription.group_id
    FROM public.student_teacher_subscriptions AS subscription
    WHERE subscription.status IN ('ACTIVE', 'EXPIRED') AND subscription.expires_at <= pg_catalog.now()
  LOOP
    PERFORM private.insert_classy_notification(recipient.student_id, 'SUBSCRIPTION_EXPIRED',
      'انتهى اشتراكك', 'انتهت فترة اشتراكك في المجموعة.',
      pg_catalog.jsonb_build_object('subscription_id', recipient.id, 'teacher_id', recipient.teacher_id, 'group_id', recipient.group_id),
      'student-subscription-expired:' || recipient.id::TEXT);
  END LOOP;

  FOR recipient IN
    SELECT subscription.id, subscription.teacher_id
    FROM public.teacher_platform_subscriptions AS subscription
    WHERE subscription.expires_at <= pg_catalog.now()
      AND subscription.status IN ('APPROVED', 'EXPIRED')
  LOOP
    PERFORM private.insert_classy_notification(recipient.teacher_id, 'SUBSCRIPTION_EXPIRED',
      'انتهى اشتراك المنصة', 'انتهت فترة اشتراكك في منصة Classy.',
      pg_catalog.jsonb_build_object('subscription_id', recipient.id),
      'teacher-platform-expired:' || recipient.id::TEXT);
  END LOOP;

  FOR session_row IN
    SELECT session.id, session.group_id, session.teacher_id,
      (session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo' AS starts_at
    FROM public.class_sessions AS session
    WHERE session.status = 'SCHEDULED'
      AND (session.session_date + session.start_time) AT TIME ZONE 'Africa/Cairo'
        BETWEEN pg_catalog.now() AND pg_catalog.now() + INTERVAL '24 hours'
  LOOP
    FOR recipient IN
      SELECT DISTINCT subscription.student_id FROM public.student_teacher_subscriptions AS subscription
      WHERE subscription.group_id = session_row.group_id AND subscription.status = 'ACTIVE'
        AND subscription.started_at <= session_row.starts_at AND subscription.expires_at > session_row.starts_at
    LOOP
      PERFORM private.insert_classy_notification(recipient.student_id, 'SESSION_UPCOMING', 'جلسة قادمة',
        'لديك جلسة قادمة خلال 24 ساعة.',
        pg_catalog.jsonb_build_object('session_id', session_row.id, 'group_id', session_row.group_id),
        'session-upcoming:' || session_row.id::TEXT || ':' || recipient.student_id::TEXT);
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.process_classy_notification_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_classy_notification_schedule() TO service_role;

-- Install one recurring job when pg_cron is already enabled for the project.
DO $$
DECLARE existing_job BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT jobid FROM cron.job WHERE jobname = $1' INTO existing_job USING 'classy-notification-schedule';
    IF existing_job IS NULL THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
        USING 'classy-notification-schedule', '*/15 * * * *', 'SELECT public.process_classy_notification_schedule();';
    END IF;
  END IF;
END;
$$;

-- Enable Postgres Changes delivery only when the standard publication exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
