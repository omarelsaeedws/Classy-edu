# Classy database notes

This document records the current database responsibilities for the Classy application. Migrations under `supabase/migrations` are the schema source of truth.

## Authentication and profiles

- `auth.users` owns authentication identity.
- `public.profiles` stores public application profile data and roles.
- Profile creation is performed by the trusted Auth trigger. Client profile insertion is revoked.
- Ordinary users can read and update only their own profile. A database trigger prevents direct changes to `role`, `teacher_status`, and account-setup state.
- Public account setup accepts `STUDENT` or `TEACHER`; public users cannot provision `ADMIN`.

Migration `20261012000000_student_onboarding_without_subject_interests.sql` keeps student onboarding limited to educational stage and grade. The legacy RPC subject-array argument is optional for compatibility but is ignored; the profile stores no student subject interests.

## Phase 03 platform subscriptions

Phase 03 handles payments from teachers to Classy only. It does not model student payments, groups, or attendance.

### Tables

- `platform_subscription_plans`: one row per supported duration (1, 3, or 6 months). Prices are required positive database values set by an administrator. Rows are created when the administrator saves each price; teachers see only active plans.
- `platform_payment_methods`: administrator-managed receiving accounts for InstaPay, Vodafone Cash, Orange Cash, Etisalat Cash, or WE Pay. Only active methods are visible to teachers.
- `teacher_platform_subscriptions`: teacher, duration and positive amount snapshot, workflow status, approval, and expiry timestamps.
- `teacher_platform_payments`: transferred amount, selected receiving method, private receipt path, review metadata, and a required rejection reason when rejected.

### RLS and database authorization

RLS is enabled on all four Phase 03 tables. Authenticated users can select only active plans/methods or their own subscription and payment records; administrators can select all records. Direct insert/update/delete access is revoked. Database RPCs authenticate the caller and enforce teacher/admin role checks before performing writes. Subscription approval and the profile's `teacher_status = 'ACTIVE'` update occur in the same database transaction.

The admin payment queue RPC returns teacher email only after checking the caller's `ADMIN` profile. The browser never queries `auth.users` directly and never receives a service-role key.

### Private receipt storage

The `teacher-payment-receipts` bucket is private, limits files to 5 MiB and image/jpeg, image/png, or image/webp. Object names follow:

```text
<authenticated-teacher-uuid>/<subscription-uuid>/<payment-uuid>.<jpg|jpeg|png|webp>
```

RLS restricts uploads and reads to the owning teacher and the relevant subscription; admins can read receipts for review. Teachers cannot overwrite receipts. They can remove an unsubmitted upload only while the related subscription is still awaiting payment and no payment row references it. The UI requests short-lived signed links; no permanent public URL is created.

### Expiry processing

Teacher dashboard access checks `is_teacher_platform_subscription_active()` in PostgreSQL, which requires an approved subscription whose `expires_at` is in the future. Therefore access is denied at expiry even if the profile status has not yet been refreshed.

The migration provides `expire_teacher_platform_subscriptions()` for a trusted scheduled invocation. It is not executable by `anon` or `authenticated`. If Supabase Cron is enabled for the project, configure it from a trusted SQL editor with:

```sql
select cron.schedule(
  'classy-expire-teacher-subscriptions',
  '*/15 * * * *',
  $$select public.expire_teacher_platform_subscriptions();$$
);
```

If `pg_cron` is not enabled, enable it from the Supabase Dashboard's supported extensions and schedule the function there, or invoke it from another trusted scheduler. Do not grant this function to browser roles.

## Active teacher professional profiles

Migration `20261001000000_teacher_profiles_and_schedule.sql` adds the teacher's subject, school term, teaching address, and weekly time slots. Teachers may edit these details only while their platform subscription is active. Authenticated users may read the details of active teachers; profile and schedule writes are restricted to the `save_teacher_profile()` RPC, which checks the authenticated teacher and active subscription in PostgreSQL. The RPC saves profile and schedule changes in one transaction.

Student reviews are defined in Phase 07 and are tied to an eligible student-to-teacher subscription; this is separate from the teacher's subscription to Classy.

## Migration order

Apply the migrations in timestamp order. The Phase 03 migration depends on `public.profiles`, the profile role guard, and Supabase Storage's `storage.buckets` and `storage.objects` tables. It must be applied after the Phase 02 profile/auth migrations and with the Storage service available. The teacher professional profile migration must be applied after Phase 03 because it checks the active teacher subscription. Phase 04 migration `20261002000000_create_teacher_groups.sql` depends on the Phase 03 active-subscription check and timestamp trigger.

## Phase 04 teacher groups

Migration `20261002000000_create_teacher_groups.sql` creates `teacher_groups` for recurring weekly group schedules. Each group belongs to one profile, has a controlled `ACTIVE` / `INACTIVE` status, a positive capacity, and a validated day/time range. Capacity is stored and displayed only; student counts and capacity enforcement belong to Phase 05.

RLS is enabled. Teachers can select only their own rows; admins can read all groups. Direct writes are revoked from browser roles. The authenticated teacher's identity is derived inside the restricted `save_teacher_group()`, `set_teacher_group_status()`, and `delete_teacher_group()` RPCs. Each write verifies the teacher role, active teacher state, and unexpired approved Classy subscription. The save RPC serializes that teacher's schedule writes and rejects overlapping time ranges on the same weekday. No student subscription, payment, attendance, or review records are created in Phase 04.

Migration `20261003000000_teacher_subjects_and_multi_day_groups.sql` upgrades the applied Phase 04 model in place. It retains group IDs and details, copies each existing one-day meeting to `teacher_group_schedule_slots`, and deactivates legacy groups until a stage and grade are selected. A group can then have multiple weekly day/time slots and must be assigned a teacher subject, educational stage, and grade. Active groups of the same teacher cannot overlap. The teacher workspace combines personal name, phone, portrait, subject list, school term, address, and group management. Portraits use the private `teacher-avatars` bucket. Active teachers can upload/delete objects in their own folder; authorized authenticated viewers get short-lived signed URLs to read active teacher portraits. Object listing is not granted.

Migration `20261004000000_fix_teacher_workspace_save.sql` fixes first-time teacher profile saves so they satisfy the non-empty subjects constraint when the row is first inserted. The teacher no longer needs to enter general availability because recurring lesson times are stored with each group in `teacher_group_schedule_slots`. Empty availability input preserves any legacy schedule rows.

## Phase 05 student discovery and subscriptions

Migration `20261005000000_student_teacher_subscriptions.sql` adds teacher public profile fields (lesson title, bio, Abu Kebir area, and monthly price), teacher-owned student payment methods, student-to-teacher group subscription records, and student payment records. This flow is separate from `teacher_platform_subscriptions` and `teacher_platform_payments`: students pay the teacher, while teachers pay Classy.

Students discover only complete active teacher profiles that have at least one active group matching the student's database-stored educational stage and grade, plus an active teacher payment method. The directory and detail RPCs expose a limited set of profile fields and payment instructions; no general profile table or payment-method table access is granted to students. Prices are snapshotted on request creation.

Students create a request and submit amount, chosen teacher payment method, notes, and a private receipt. Teacher review RPCs approve or reject the payment; rejection requires a reason. Approval grants a one-calendar-month subscription. Capacity is checked when requests are created and again during approval while locking the group row, so approvals cannot exceed the group limit. Partial unique indexes prevent duplicate active subscriptions and simultaneous open requests for the same student/group.

RLS is enabled on all three new tables. Browser roles have no direct write grants for subscriptions or payments; writes use authenticated, role-checking database functions. Teacher payment methods are writable only by their owning active teacher with an active Classy subscription. The `student-payment-receipts` bucket is private, limited to 5 MiB image files, and has object policies for the uploading student, relevant teacher, and administrator. The UI uses short-lived signed URLs.

The migration also moves student onboarding completion into `complete_student_onboarding()` so a student cannot alter stage/grade eligibility directly after onboarding, and wraps teacher workspace/profile writes in `save_teacher_workspace_phase05()`.

Apply the Phase 05 migration after `20261004000000_fix_teacher_workspace_save.sql` and all earlier migrations. It requires the existing profiles, teacher subscription helpers, teacher profile/group tables, timestamp trigger function, and Supabase Storage schema/buckets. It has not been applied to the remote Supabase project by this implementation.

## Phase 06 class sessions and attendance

Migration `20261006000000_class_sessions_attendance.sql` creates `class_sessions` (one real meeting for a recurring group) and `class_attendance` (one immutable check-in per student/session). Weekly group schedules remain references; they do not generate sessions. Sessions are created by the owning active teacher through database RPCs. The database rejects past dates, invalid time ranges, inactive/foreign groups, and overlapping sessions for the same group/date.

RLS is enabled on both tables. Teachers can read their sessions and associated attendance; students can read only sessions tied to subscriptions active at the scheduled lesson time and their own check-ins; admins retain read visibility. Browser roles cannot write either table. The six-digit code is not available through table reads and is returned only to the owning teacher RPC. Opening is limited to the Cairo session date and the code lasts ten minutes. Check-in locks the session row, validates the code/window and the authenticated student's current active group subscription, then writes once under a unique `(session_id, student_id)` constraint. Attendance is accepted only by the `check-attendance` Edge Function; its service-role key remains server-side, and its database endpoint is not executable by browser roles.

Student history and attendance percentages are calculated from the database. Teacher roster/statistics and student upcoming sessions use role-checked RPCs. Admin read policies permit authorized inspection without exposing write operations.

Apply `20261006000000_class_sessions_attendance.sql` only after the Phase 05 migration and every earlier migration have been applied. Deploy `supabase/functions/check-attendance` after applying it. The project does not currently have a local Supabase CLI/Postgres instance, so this migration and the deployed Edge Function have not been integration-tested against the remote project.

Migration `20261007000000_extend_class_attendance.sql` adds a restricted `extend_teacher_class_attendance()` RPC. Only the owning active teacher with an active Classy subscription can extend an open session; each successful call adds five minutes to the current expiry (or five minutes from now if it has expired). The existing attendance code remains guarded by the session status and server-side expiration check. Apply this follow-up after the Phase 06 migration.

Migration `20261011000000_attendance_history_and_subscription_controls.sql` adds separate subject-based student attendance histories and teacher student rosters/search with per-student attendance details. Completed sessions with no recorded check-in count as absent only when the student's approved subscription covered the Cairo session time. It adds one-month student subscription renewals with private receipt uploads and teacher review; approval extends the original expiry by a month, while teacher cancellation immediately stops access and future renewals. Deleting a group with subscription/session history archives it as inactive so historical records remain intact; groups with no dependent records are permanently deleted.

Migration `20261013000000_attendance_history_per_subscription_period.sql` presents attendance separately for each approved student subscription period. Student history cards and teacher detail reports include that period's start/end dates and count only completed group sessions within that interval. The student dashboard attendance summary reflects currently active subscription periods; after expiry its current-period totals return to zero, while prior periods remain available in attendance history. Attendance rows are retained and are not deleted on expiry.

The same migration adds the `purge_account_related_data(UUID)` RPC for permanent student/teacher account deletion. It is executable only by `service_role`, and removes related reviews, attendance, student and teacher subscription/payment records, sessions, groups, and payment methods in dependency order. `supabase/functions/delete-account` verifies the caller's bearer token with Supabase Auth, removes that user's objects from the private avatar/receipt buckets, calls the restricted purge RPC, then deletes the Auth user through the Admin API. The service-role key is read only from Edge Function secrets and is never included in the frontend. Deploy the function after applying the migration; admins cannot use this self-service deletion endpoint.

## Phase 07 teacher reviews

Migration `20261009000000_teacher_reviews.sql` creates `public.reviews`, with one review per student/teacher and a composite foreign key tying the review's student, teacher, and subscription to the existing `student_teacher_subscriptions` record. Ratings are constrained to 1–5 and comments are trimmed, nullable, and limited to 1000 characters. Only subscriptions that reached `ACTIVE` or `EXPIRED` with an approval timestamp are eligible; rejected, cancelled, and pending requests do not qualify.

RLS is enabled. Direct browser writes are revoked. Students create/edit reviews through authenticated RPCs that derive the student from `auth.uid()` and accept no student or subscription ID from the client; updates preserve ownership and subscription links. There is no delete policy or delete RPC. Public review reads and aggregates are returned through narrow RPCs that expose only a display name, rating, optional comment, and date. Teacher dashboards return only the teacher's summary and recent public review fields. Table SELECT privileges are restricted to non-sensitive review columns and RLS limits authenticated reads to active teacher reviews, the caller's own rows, or admins.

Migration `20261010000000_landing_top_rated_teachers.sql` adds a public, read-only RPC for the landing page. It returns at most four fully configured teachers with an active Classy subscription, an active group, and an active student payment method. Teachers are ordered by their real review average (highest first); teachers without reviews follow those with reviews. It returns only the current avatar path for those teachers and no payment information. A narrow Storage RLS policy lets anonymous visitors create expiring signed URLs only for the current portrait of an active teacher; the `teacher-avatars` bucket remains private. Apply this migration only after Phase 07 because it aggregates `public.reviews`.

## Phase 08 in-app notifications

Migration `20261014000000_phase08_in_app_notifications.sql` adds `public.notifications`, a controlled notification type check, recipient-scoped RLS, idempotency keys, and indexes for newest and unread notification queries. Authenticated users can select only their own notifications and update only `is_read`; browser inserts and deletes are revoked. Trigger functions create notifications transactionally for student subscription requests/reviews and payment receipts, teacher platform payment decisions, session opening/cancellation/schedule changes, attendance records, new reviews, and teacher group changes. The trigger helpers are private, have an empty search path, and are not callable by browser roles.

`public.process_classy_notification_schedule()` sends idempotent reminders for sessions starting within 24 hours and subscriptions expiring within seven days, plus expiry notices. It is executable only by `service_role`; when `pg_cron` is already enabled, the migration schedules it every 15 minutes. Otherwise enable `pg_cron` in Supabase Database > Extensions and schedule `SELECT public.process_classy_notification_schedule();` every 15 minutes. Notifications are added to `supabase_realtime` when that standard publication exists. The frontend subscribes to the authenticated user's rows, paginates notifications, and supports marking one or all as read. No email/SMS/push delivery is used.

## Phase 09 analytics and account settings

Migration `20261015000000_phase09_analytics_and_account_settings.sql` adds three narrow authenticated RPCs. `update_my_account_profile()` accepts only the caller's name and Egyptian mobile number and validates them in PostgreSQL; it cannot change role, teacher approval, onboarding, or subscription state. `get_teacher_phase09_analytics()` checks the caller's TEACHER role and returns aggregates and student rows limited to subscriptions in that teacher's own groups. Its date and group filters apply to sessions and attendance. `get_admin_phase09_analytics()` checks ADMIN and returns platform-level aggregates and monthly activity without student-level rows. The RPCs expose no direct table writes or broad table reads and can only be executed by `authenticated`.

The teacher attendance denominator counts completed group sessions only when the student's approved subscription covered the scheduled Cairo time. Teacher and platform dashboards use date-range aggregate results; student attendance continues using the existing role-scoped RPCs. Admin data includes monthly users, student subscriptions, sessions, and reviews, alongside status counts and rating aggregates.

Apply Phase 09 after all migrations through `20261014000000_phase08_in_app_notifications.sql`. Account deletion remains the existing `delete-account` Edge Function plus `purge_account_related_data()` path; no browser code deletes `auth.users`, and the Edge Function still requires its server-side service-role secret. The migration was reviewed against the repository schema, but apply it to Supabase before using the new dashboards and profile settings.

## Phase 10 administration

Migration `20261016000000_phase10_admin_management.sql` adds administrator-only, paginated read RPCs for teachers, students, both subscription systems, groups, sessions, reviews, and audit history. `admin_list_records()` and `admin_get_record_details()` derive the caller from `auth.uid()` and require `public.is_classy_admin()` before reading profiles, `auth.users` email, payment metadata, or linked business rows. The browser receives only the page requested; it has no direct grants for audit logs or business-data writes.

`admin_audit_logs` has RLS enabled, no browser table privileges, no direct insert/update/delete path, and an append-only interface through a role-checked list RPC. Database triggers record teacher-to-Classy payment decisions and changes to platform plan/payment-method settings. Review hide/restore actions are transactional with an audit record and retain the review. The new `reviews.is_visible` flag defaults to true; public profile review pages, rating summaries, teacher review dashboards, the landing page, and direct public review reads exclude hidden reviews and compute averages from visible reviews only.

Teacher payment decisions still use the existing Phase 03 `admin_review_teacher_payment()` RPC and its established activation/rejection transitions. Student subscription approval remains teacher-controlled. Teacher status and group/session/attendance rows are inspection-only in the Phase 10 admin interface; no arbitrary status editor is introduced. Receipts remain in private buckets and detail screens request short-lived signed URLs under existing Storage RLS.

Subjects, stages, grades, and teaching areas remain existing profile/group fields and arrays rather than standalone reference tables. Phase 10 therefore provides filters and inspection for those values, without introducing an unrelated educational catalog or destructive edits to referenced data.

Apply the Phase 10 migration after Phase 09 and all earlier migrations. The project has no local Supabase CLI or Postgres client configured, so this migration must be applied to Supabase before its RPC-backed pages and moderation tools can be used. No live database was available for migration execution or role/RLS integration tests during implementation.

## Phase 11 attendance attempt throttling

Migration `20261017000000_phase11_attendance_attempt_limit.sql` adds a private, RLS-enabled attempt-window table and a service-role-only RPC used by `check-attendance`. Each authenticated student may make at most 10 well-formed attendance-code attempts per minute; the 11th attempt starts a five-minute block. The Edge Function obtains the student ID only after validating the Supabase Auth token, and it consumes an attempt before calling the service-role-only attendance recorder. Browser roles receive no table or RPC access to the limiter.

Apply Phase 11 after the corrected Phase 10 migration. Then deploy the updated `check-attendance` Edge Function. Until both steps complete, the existing hosted function does not enforce this database-backed attempt limit. CORS allowlists are configured independently through the `APP_ALLOWED_ORIGINS` Edge Function secret; see [security.md](security.md).
