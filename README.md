# Classy

Classy is an Arabic-first, right-to-left education platform that connects students with teachers and helps them manage lessons, subscriptions, and attendance. The platform is initially focused on Abu Kebir, Sharqia, Egypt.

## What Classy Does

Classy provides separate experiences for students, teachers, and platform administrators.

### Students

- Sign in or create an account with Google and complete their student profile.
- Discover active teachers and browse groups that match their educational stage and grade.
- Request a group subscription, submit payment details, and upload a receipt for the teacher to review.
- Track subscription status, renew subscriptions, and view attendance by subject and subscription period.
- Register attendance using a teacher-provided code or QR code during an active attendance window.
- View a digital student ID with a six-digit identifier and QR code.
- Review eligible teachers after an eligible subscription.

### Teachers

- Sign in with Google, create a teacher profile, and submit a Classy platform subscription payment for administrator review.
- After activation, manage their public profile, subjects, teaching location, groups, and weekly lesson schedules.
- Create class sessions, open attendance with a time-limited code or QR code, and view student attendance records.
- Review student subscription requests and payment receipts, and approve or reject them.
- Verify a student's active subscription using the six-digit student ID or the QR code on the student's digital ID.
- Review platform analytics, subscription duration, and ratings from eligible students.

### Platform Administrators

- Review teacher platform subscription payments and activate or reject teacher accounts.
- Configure platform subscription plans and payment methods.
- Inspect teachers, students, subscriptions, groups, sessions, reviews, and administrative audit records.

Classy also provides in-app notifications for relevant account, subscription, session, attendance, and review events.

## Technology

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4
- **Routing:** React Router 7
- **Backend platform:** Supabase
- **Authentication:** Supabase Auth with Google OAuth
- **Database:** PostgreSQL with Row Level Security (RLS), database functions, triggers, and migrations
- **File storage:** Supabase Storage for profile images and private payment receipts
- **Server-side operations:** Supabase Edge Functions for attendance verification and account deletion
- **Icons:** Lucide React
- **QR support:** `qrcode` for QR generation and `@zxing/browser` for QR scanning
- **Code quality:** ESLint and TypeScript

The browser uses only public Supabase configuration. Sensitive operations and service-role credentials remain on the server side. Authorization and important business rules are enforced in PostgreSQL and Edge Functions, not only in the UI.

## Getting Started

### Requirements

- Node.js and npm
- A Supabase project configured for this application

### Install dependencies

```bash
npm install
```

### Configure environment variables

Copy `.env.example` to `.env` and add the public project URL and publishable key from Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The app also supports the legacy `VITE_SUPABASE_ANON_KEY` variable for compatibility. Never place a Supabase service-role key in a `VITE_*` variable or frontend file.

Configure Google OAuth and the allowed redirect URLs in Supabase Auth before using Google sign-in.

### Run locally

```bash
npm run dev
```

### Build and lint

```bash
npm run build
npm run lint
```

## Supabase Setup

Database migrations are in `supabase/migrations/`. Apply them to the Supabase project in timestamp order, following any additional instructions in [`docs/database.md`](docs/database.md). Adding a migration file to the repository does not apply it to the remote database.

Deploy the Edge Functions from `supabase/functions/` when required by the migration and feature documentation. Configure any required server-side secrets in Supabase Edge Function settings. Do not expose service-role credentials to the browser.

## Project Structure

```text
src/
  components/       Shared UI, navigation, and reusable components
  features/         Authentication and domain-specific services and logic
  pages/            Student, teacher, administrator, and public pages
  routes/           React Router and access control
  lib/              Supabase client and shared utilities
supabase/
  functions/        Supabase Edge Functions
  migrations/      PostgreSQL schema and security migrations
docs/               Architecture, design, and database documentation
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — application architecture and authorization boundaries
- [`docs/database.md`](docs/database.md) — database objects, RLS, RPCs, storage, and migration order
- [`docs/design.md`](docs/design.md) — visual identity and interface design system
