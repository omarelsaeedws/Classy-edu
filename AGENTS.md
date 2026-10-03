# Classy — AI Development Rules

> This file is the mandatory development contract for the Classy project.
>
> Every AI agent, coding assistant, or developer working on this repository MUST read and follow this file before making changes.

---

# 1. Project Identity

Project Name:

Classy

Project Type:

Arabic Local EdTech Platform

Initial Geographic Scope:

Abu Kebir Center, Sharqia, Egypt

Primary Language:

Arabic

UI Direction:

RTL

Primary Users:

1. Student
2. Teacher
3. Super Admin

---

# 2. Core Principle

The existing project architecture, business rules, security model, and design system MUST NOT be changed without explicit approval.

AI agents MUST NOT:

- Replace the selected technology stack.
- Introduce a different backend architecture.
- Replace Supabase.
- Replace PostgreSQL.
- Change the authentication architecture.
- Change the user roles.
- Change core business workflows.
- Modify security policies without explicit approval.
- Remove existing functionality.
- Rename major modules without approval.
- Create duplicate systems for an existing feature.

If a requested change conflicts with this file:

STOP and ask for clarification.

Do not make assumptions.

---

# 3. Technology Stack

The official stack is:

Frontend:

- Vite
- React.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React

Backend / BaaS:

- Supabase

Supabase services:

- Supabase Auth
- PostgreSQL
- Supabase Storage
- Row Level Security
- Supabase Edge Functions when required

The project MUST NOT introduce:

- Express
- MongoDB
- Mongoose
- Firebase
- Prisma unless explicitly approved
- Another authentication provider
- Another backend platform

---

# 4. Architecture

The project uses:

react.js    

- Supabase

There is NO separate Express backend.

Frontend communicates with Supabase through:

- Supabase client
- Supabase server client
- Server Actions where appropriate
- Supabase Edge Functions for sensitive server-side operations

Security-sensitive operations MUST NOT rely only on client-side validation.

---

# 5. Language & Localization

The application is Arabic-first.

All user-facing UI MUST be Arabic.

The application MUST use:

lang="ar"

and:

dir="rtl"

English may only be used for:

- Code
- Database identifiers
- API identifiers
- Technical documentation
- Brand name "Classy"

Do not create English UI labels unless explicitly requested.

---

# 6. Brand

Brand Name:

Classy

The brand name MUST remain:

Classy

Do not rename the platform.

The visual identity is defined in:

docs/design.md

`design.md` is the source of truth for:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Components
- Light Mode
- Dark Mode
- Visual style

AI agents MUST read `design.md` before modifying UI.

---

# 7. Design Philosophy

Classy UI MUST be:

- Minimal
- Clean
- Modern
- Professional
- Educational
- Premium
- Accessible

Avoid:

- Excessive gradients
- Excessive animations
- Excessive shadows
- Excessive rounded components
- Excessive icons
- Visual clutter
- Unnecessary decoration
- Generic template-looking interfaces

Light Mode is the default.

Dark Mode is supported.

---

# 8. User Roles

Classy has exactly three primary roles:

STUDENT

TEACHER

ADMIN

Do not create additional roles without explicit approval.

---

# 9. Student Business Rules

A student can:

- Create an account.
- Log in.
- Complete educational information.
- Select educational stage.
- Select grade.
- Browse available teachers.
- Filter teachers.
- View teacher profile.
- View teacher groups.
- Submit a subscription request.
- View teacher payment information.
- Enter transfer amount.
- Upload payment receipt.
- Track subscription status.
- View attendance.
- Register attendance.
- Review eligible teachers.

A student MUST NOT:

- Approve subscriptions.
- Modify teacher information.
- Access another student's private information.
- Access teacher payment settings.
- Access admin functionality.

---

# 10. Teacher Business Rules

A teacher can create an account.

However:

A newly registered teacher MUST NOT immediately receive full teacher functionality.

Teacher account lifecycle:

REGISTERED
→
PENDING SUBSCRIPTION
→
PAYMENT SUBMITTED
→
ADMIN REVIEW
→
APPROVED
→
ACTIVE

Only an ACTIVE teacher can access the complete teacher dashboard.

An inactive teacher cannot:

- Create groups
- Receive student subscriptions
- Manage students
- Open attendance
- Publish teacher profile

---

# 11. Teacher Platform Subscription

Teacher platform subscription options are exactly:

- 1 Month
- 3 Months
- 6 Months

Do not add:

- 1 Year
- Weekly
- Custom plans

unless explicitly approved.

Prices MUST be configurable by Super Admin.

Prices MUST NOT be hardcoded in frontend components.

---

# 12. Teacher Platform Payment

The teacher pays the Classy platform manually.

The Super Admin owns the platform payment information.

Possible payment methods include:

- InstaPay
- Vodafone Cash
- Orange Cash
- Etisalat Cash
- WE Pay

The platform does NOT currently use automated payment gateways.

Teacher payment workflow:

Teacher selects plan
→
Views platform payment information
→
Transfers money
→
Enters transfer amount
→
Uploads receipt
→
Submits payment
→
Status = PENDING
→
Super Admin reviews
→
APPROVED or REJECTED

Only Super Admin can approve teacher platform subscriptions.

---

# 13. Teacher Profile

After teacher activation, the teacher can configure:

- Profile image
- Name
- Bio
- Subject
- Educational stage
- Grades
- Teaching location
- Lesson title
- Student subscription price
- Payment information

---

# 14. Teacher Groups

Teachers can create groups.

Each group may contain:

- Group name
- Subject
- Grade
- Day
- Start time
- End time
- Maximum students
- Status

Group capacity MUST be enforced.

Students MUST NOT be able to subscribe when the group is full.

---

# 15. Student Subscription

Student subscription workflow:

Student
→
Select Teacher
→
Select Group
→
View Price
→
View Teacher Payment Information
→
Transfer Payment
→
Enter Transfer Amount
→
Upload Receipt
→
Submit Request
→
PENDING
→
Teacher Review
→
APPROVED / REJECTED

Only the relevant teacher can approve or reject the student's subscription.

---

# 16. Payment Separation

There are TWO completely different payment systems.

System A:

Teacher → Classy

Purpose:

Teacher platform subscription.

Approval:

Super Admin.

System B:

Student → Teacher

Purpose:

Teacher/group subscription.

Approval:

Teacher.

Do NOT mix these two payment flows.

---

# 17. Payment Security

Payment receipt images are private.

Payment receipts MUST NOT be publicly accessible.

Use Supabase Storage with appropriate access policies.

Users can only access receipts they are authorized to view.

Students cannot access another student's payment receipt.

Teachers cannot access receipts unrelated to their subscriptions.

Students cannot access teacher platform subscription payments.

---

# 18. Attendance

Attendance is group/session based.

Teacher creates or opens an attendance session.

The system generates:

- QR Code
- Attendance Code

Attendance is open for a limited period.

Default attendance window:

10 minutes.

After the attendance window expires:

Attendance registration MUST close automatically.

Students can register attendance only if:

- They have an active subscription for the group.
- The attendance session is active.
- The current time is within the allowed window.
- They have not already registered attendance.

A student MUST NOT be able to manually mark themselves present.

---

# 19. Attendance Security

Attendance validation MUST be performed server-side.

Do NOT rely only on frontend timers.

Do NOT trust:

- Client timestamps
- Client role
- Client subscription status
- Client attendance status

Server-side validation MUST verify eligibility.

---

# 20. Admin

There is one primary platform administrator role:

ADMIN

The Admin can:

- Manage teachers
- Manage students
- Review teacher subscription payments
- Approve teacher accounts
- Reject teacher payments
- Manage platform subscription prices
- Manage platform payment information
- Manage platform settings

Admin permissions MUST be protected by server-side authorization and Supabase RLS.

---

# 21. Database Rules

PostgreSQL is the official database.

Database design MUST use relational modeling.

Use:

- Foreign keys
- Unique constraints
- Check constraints
- NOT NULL where appropriate
- Indexes where necessary

Do not duplicate data unnecessarily.

Business-critical integrity MUST be enforced at database level whenever possible.

---

# 22. Supabase RLS

Row Level Security MUST be enabled for all application tables containing user or business data.

Never rely solely on frontend authorization.

Every policy MUST follow least privilege.

Default principle:

DENY unless explicitly allowed.

Do not create:

USING (true)

or:

WITH CHECK (true)

for production user data.

---

# 23. Authentication

Authentication is handled by Supabase Auth.

Do not implement custom password authentication.

Do not store plaintext passwords.

User identity comes from:

auth.users

Application profile information belongs in application tables such as:

profiles

---

# 24. File Storage

Supabase Storage is used for:

- Profile images
- Payment receipts

Payment receipts are private.

Public assets may be stored in public buckets only when appropriate.

Do not expose private files through permanent public URLs.

Use signed URLs when necessary.

---

# 25. Frontend Architecture



Use Server Components by default.

Use Client Components only when interactivity requires them.

Do not create giant components.

Use reusable components.

Recommended structure:

src/
├── components/
├── features/
├── pages/
├── layouts/
├── routes/
├── lib/
├── hooks/
├── types/
├── constants/
├── data/
├── App.tsx
└── main.tsx

---

# 26. Components

Reusable UI belongs in:

components/ui

Feature-specific components belong in:

features/

Do not duplicate common components.

For example:

Do NOT create:

StudentButton
TeacherButton
AdminButton

if they are visually the same.

Use:

Button

with variants.

---

# 27. Validation

Validation MUST exist at multiple levels when necessary:

1. Client validation
2. Server validation
3. Database constraints

Never trust client validation as the only validation.

---

# 28. Environment Variables

Secrets MUST NEVER be committed.

Never place:

- Supabase service role key
- API secrets
- private credentials
- payment secrets

in frontend source code.

Use:

.env.local

and:

.env.example

Only public Supabase configuration may use:

VITE_* 

The Supabase service role key MUST remain server-side.

---

# 29. Security Rules

Never:

- Disable RLS to fix a bug.
- Make private storage public to fix access issues.
- Expose service role keys.
- Trust client-side roles.
- Trust client-side prices.
- Trust client-side subscription status.
- Trust client-side attendance status.
- Store passwords manually.
- Bypass authorization for convenience.

If a security issue occurs:

Fix the authorization or database policy.

Do not weaken security.

---

# 30. Business Logic Rules

Business logic MUST have a single source of truth.

Do not duplicate subscription state logic across:

- UI
- Multiple API functions
- Multiple components

Prefer centralized server-side logic.

---

# 31. Status Values

Use controlled status values.

Teacher subscription:

PENDING
ACTIVE
REJECTED
EXPIRED
CANCELLED

Student subscription:

PENDING
ACTIVE
REJECTED
EXPIRED
CANCELLED

Payment:

PENDING
APPROVED
REJECTED

Do not invent random status strings.

---

# 32. Geographic Scope

Initial platform scope:

Abu Kebir Center, Sharqia, Egypt.

Do not implement multi-city support unless explicitly requested.

The architecture may be extensible for future expansion.

---

# 33. Development Rules

Before modifying the project:

1. Read this file.
2. Read docs/design.md for UI changes.
3. Read docs/database.md for database changes.
4. Understand existing implementation.
5. Reuse existing components.
6. Avoid unnecessary refactoring.

---

# 34. Change Management

If a requested feature conflicts with an existing rule:

DO NOT silently modify the rule.

Explain the conflict.

Ask for explicit approval before changing:

- Architecture
- Database structure
- Roles
- Security policies
- Business workflows
- Design system
- Authentication strategy

---

# 35. No Unrequested Features

Do not add features simply because they seem useful.

Examples:

Do NOT add:

- Chat
- Notifications
- Online video classes
- Automated payment gateways
- Coupons
- Affiliate system
- Multi-language support
- Multiple cities
- Parent accounts
- AI features

unless explicitly requested.

---

# 36. No Fake Implementations

Do not create fake production functionality.

Avoid:

- Fake authentication
- Fake database
- Fake payment approval
- Fake attendance verification
- Fake API responses

Static mock data is allowed ONLY for UI previews that have not yet been connected to the backend.

Clearly separate mock data from production data.

---

# 37. Code Style

Use:

- TypeScript
- Strict typing
- Meaningful names
- Small components
- Clear functions
- Consistent formatting

Avoid:

- any
- duplicated logic
- deeply nested components
- magic numbers
- magic strings

Use constants where appropriate.

---

# 38. Documentation

Important architectural decisions should be documented.

Main documentation:

docs/
├── design.md
├── requirements.md
├── database.md
└── architecture.md

Do not delete documentation without approval.

---

# 39. AI Agent Workflow

Every AI agent MUST follow this workflow:

1. Read AGENTS.md.
2. Identify the requested task.
3. Inspect the existing implementation.
4. Identify affected modules.
5. Check for conflicts with project rules.
6. Implement the smallest correct change.
7. Reuse existing architecture.
8. Run validation/tests.
9. Fix errors.
10. Summarize the changes.

---

# 40. Important Rule

The AI MUST NOT assume that:

"newer is better"

or:

"another architecture is better"

Existing project decisions are intentional.

Do not replace technologies, architecture, workflows, or design decisions without explicit approval.

---

# 41. Definition of Done

A feature is NOT considered complete if:

- It only works visually.
- Authorization is missing.
- RLS is missing where required.
- Validation is missing.
- Errors are ignored.
- TypeScript errors remain.
- Security is bypassed.
- Existing functionality is broken.

A feature is complete only when it works correctly within the existing architecture and security model.

---

# 42. Final Rule

When uncertain:

DO NOT GUESS.

Ask for clarification.

The project owner's explicit decisions always override assumptions made by the AI.

This file is the project's development contract.
