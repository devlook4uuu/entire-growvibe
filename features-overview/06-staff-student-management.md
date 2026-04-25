# Staff & Student Management

## Overview
Owner/Principal/Coordinator create and manage staff and students. All accounts are created via an Edge Function using the Service Role Key. Students get school-generated fake emails. No account is ever deleted — only deactivated. Principal vacancy is handled by reusing the old account with updated info.

## User Roles & Access
- **Admin:** Can view all users across schools
- **Owner:** Can create/manage all staff in own school, view all
- **Principal:** Can create/manage Coordinators, Teachers, Students in own branch
- **Coordinator:** Can create/manage Teachers, Students in own branch
- **Teacher:** Cannot create users
- **Student:** Cannot create users

## Core Functionality
- Create staff accounts (Owner/Principal/Coordinator depending on role being created)
- Create student accounts with school-generated fake email
- View staff list with filters by role
- Search staff by name
- Toggle active/inactive per staff/student
- Edit personal info (name, phone, DOB, gender, emergency contact)
- Change password (via Edge Function — superior role only)
- Change email (via Edge Function — superior role only)
- Assign/change class for teachers and students
- Set `can_message` per student (default: false)
- Set `default_fee` per student
- Set `biometric_id` per student

## UI Screens & Components

### Screen: Staff List
**Visible To:** Owner (all staff), Principal (branch staff), Coordinator (branch staff), Admin (all)

**Data Displayed:**
- Staff table: name, role badge, email, phone, `is_active` status, class assigned (teachers)
- Filter tabs: All / Principal / Coordinator / Teacher / Student
- Search by name

**User Actions:**
- "+ Add Staff/Student" button
- Click staff row → Staff Detail/Edit
- Toggle active/inactive

**UX Flow:**
Owner opens Staff List → filter by role → click "+ Add" → form modal → fill details → submit → user created in auth + profile auto-created via trigger

**Empty State:** "No staff yet. Add your first staff member."

**Error States:**
- Email already exists → "Ye email already use ho rahi hai"
- 3rd device login attempt → blocked at login (see Auth)

**Edge Cases:**
- Teacher incharge of class: `class_id` assigned at creation
- Student: `class_id` assigned, `can_message` default false

---

### Screen: Create/Edit Staff Modal
**Visible To:** Owner, Principal (limited), Coordinator (limited)

**Data Displayed:**
- Form: Full Name (required), Email (required), Password (required), Role (dropdown), Phone, Date of Birth, Gender, Emergency Contact
- For Teacher: Class assignment dropdown
- For Student: Class + Default Fee fields
- For Student: `can_message` toggle (default OFF)

**User Actions:**
- Fill form → Submit
- Cancel

**UX Flow:**
Fill details → Submit → Edge Function: `auth.admin.createUser()` → profile auto-created via Postgres trigger → success toast → list refreshes

**Error States:**
- Name empty → "Full name required"
- Email empty/invalid → "Valid email required"
- Password too short → "Password minimum 8 characters"
- Teacher already incharge of another class → "Ye teacher already ek class ke incharge hain"

**Edge Cases:**
- Student email format suggestion: `firstname.classname@schoolname.com`
- Password: school manually shares with the student/parent

---

### Screen: Staff/Student Detail & Edit
**Visible To:** Superior role of that user

**Data Displayed:**
- All profile info
- Role, school, branch, class
- Active/inactive status
- For students: GrowCoins balance, `can_message` status
- For teachers: assigned class

**User Actions:**
- Edit personal info
- Change password (via Edge Function)
- Change email (via Edge Function)
- Activate/Deactivate account
- Change class assignment
- Toggle `can_message` (students only)

**UX Flow:**
Click staff from list → detail opens → edit fields → save → Edge Function handles credentials change → force logout if credentials changed

**Error States:**
- Email change → force logout immediately
- Role change → force logout immediately

**Edge Cases:**
- Account deactivate → user gets 403 immediately — no grace period
- Profile image: new upload → success → delete old from Supabase Storage automatically

## Data & Fields
| Field | Editable By | Notes |
|---|---|---|
| full_name | Self + superior | Required |
| email | Superior only | School-generated for students |
| password | Superior only | Min 8 chars, manually shared |
| profile_image | Self | Old deleted on new upload |
| about, interests, languages, social_links | Self | Optional |
| role | System only | Cannot be changed |
| school_id, branch_id, class_id | System only | Assigned at creation |
| is_active | Superior role | False = 403 immediately |
| grow_coins | System automatic | Read-only |
| total_coins_spent | System automatic | Read-only |
| expo_push_token | System (login) | Auto-set |
| device_tokens | System (login) | jsonb, max 2 |
| biometric_id | Owner / Principal / Coordinator | For biometric attendance |
| default_fee | Owner / Principal / Coordinator | Pre-fills fee records |
| can_message | Owner / Principal / Coordinator | Student default: false |

## Business Rules & Logic
- No hard delete — ever. Only `is_active = false`
- Account deactivation is immediate — no grace period
- Teacher class assignment is UNIQUE — one teacher per class as incharge
- Student fake email format: `firstname.classname@schoolname.com`
- `can_message = false` by default for all students — must be explicitly enabled
- Principal vacancy: assign new principal to old account (update email + personal info on existing profile — do not create new account)
- Credentials change (email or password) → immediate force logout of target user
- Profile image: old image deleted from Supabase Storage when new one uploaded

## API / Integrations
- **Edge Functions:**
  - `create-user`: calls `auth.admin.createUser()` with Service Role Key
  - `update-credentials`: changes email/password + calls `auth.admin.signOut()` on target user
- **Postgres Trigger:** Auto-creates `profiles` row when `auth.users` row is created
- **Supabase Storage:** Profile image uploads

## Open Questions / Missing Info
- When a teacher is removed as class incharge (class reassigned), does their `class_id` become NULL?
- Can a student be in multiple classes? (Doc implies one class per student)
- What is the "Role (dropdown)" in Create modal? Can it create any role including Owner? Or is it scoped to what the creator is allowed to create?
- Emergency contact — is this just a text field or structured (name + phone + relation)?
- `default_fee` — is this a PKR amount or a fee plan ID?
- Student mid-session join — how is their starting date handled for attendance/coins calculation?
- Can Coordinator create another Coordinator? (Doc says "Owner, Principal" create Coordinators — Coordinator is not listed)
