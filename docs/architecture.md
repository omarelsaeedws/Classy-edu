# Classy architecture

Classy is an Arabic RTL web platform built with React, Vite, TypeScript, Tailwind CSS, React Router, and Supabase. Supabase Auth owns identity, PostgreSQL stores application data, RLS limits row access, Storage keeps profile images and receipts private, and Edge Functions are reserved for operations that require server secrets.

## Authorization

The frontend protects pages with authenticated role routes, while PostgreSQL RPCs and RLS enforce the same authorization at the data boundary. Public registration may create only STUDENT and TEACHER profiles. ADMIN assignment is a trusted provisioning operation. Sensitive administration RPCs derive the actor from `auth.uid()` and verify the stored ADMIN profile; the browser never supplies an authoritative role or administrator ID.

## Admin Management

The admin routes share `AdminShell` navigation. Phase 09 analytics stays on `/admin`; Phase 10 provides paginated lists and detail views for teachers, students, teacher/student subscriptions, groups, sessions, reviews, and audit logs. These views call role-checked database RPCs instead of giving the browser broad table access. Existing Phase 03 teacher payment review and platform settings RPCs remain the only write paths for those workflows. Student subscription decisions remain with the relevant teacher; attendance and group/session records are inspection-only for admins.

Significant administrator actions are recorded in `public.admin_audit_logs`. Database triggers record plan/payment-method changes and teacher platform payment decisions; review moderation logs hide/restore operations in the same transaction. Audit records are append-only from browser roles. Hidden reviews remain in the database and are excluded from public teacher pages and rating calculations.

See [database.md](database.md) for migration order, data ownership, RLS, RPCs, and Storage details. See [design.md](design.md) for the visual system.
