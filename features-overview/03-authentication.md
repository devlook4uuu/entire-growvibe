# Authentication & Authorization

## Overview
GrowVibe uses Supabase Auth with a custom JWT hook. There is no self-service registration — all accounts are created by a superior role via an Edge Function. Students get school-generated fake emails. No email verification. No self-service password reset. Superior role resets credentials. Max 2 devices per user enforced.

## User Roles & Access
All roles — single login screen for everyone.

## Core Functionality

### Login Flow
1. Superior role creates user via Edge Function (Service Role Key → `auth.admin.createUser()`)
2. Postgres trigger fires → `profiles` table auto-creates with all fields
3. Credentials manually given to user (no email verification link)
4. Students get school-generated fake email: e.g. `ahmed.class5a@schoolname.com`
5. User logs in → Custom JWT Hook runs → injects `role + school_id + branch_id + class_id` into token
6. Every subsequent request: middleware checks `is_active` for user, school, and branch

### isActive Middleware — 3 Checks (on every request)
| Check | Condition | Response |
|---|---|---|
| User | `profiles.is_active = false` | 403 — Account inactive |
| School | `schools.is_active = false` | 403 — School inactive |
| Branch | `branches.is_active = false` | 403 — Branch inactive |

### Role-Based Redirect After Login
| Role | Redirect |
|---|---|
| Admin | Admin Dashboard |
| Owner | Owner Dashboard |
| Principal / Coordinator | Branch Dashboard |
| Teacher | Teacher Dashboard |
| Student | Student Home (App) |

### Device Limit
- Max **2 devices** per user
- `device_tokens` field in `profiles`: `jsonb` — `[{token, device_name, last_login}]`
- 3rd device login attempt → blocked with error message
- Both registered devices receive push notifications

## UI Screens & Components

### Screen: Login
**Visible To:** All roles — single login screen

**Data Displayed:**
- Email input field
- Password input field
- Login button
- GrowVibe logo + branding

**User Actions:**
- Enter email + password → Login
- Forgot password — NOT available (superior role resets)

**UX Flow:**
Login button click → API call → JWT token received → role check → redirect to role-based dashboard

**Empty State:** N/A — login page always shown

**Error States:**
- Wrong credentials → "Email ya password galat hai" toast error
- Account inactive → "Aapka account inactive hai. School se rabta karein."
- School inactive → "School inactive hai. Admin se rabta karein."
- 3rd device login → "Max 2 devices pe login allowed hai. Pehle ek device se logout karein."
- Network error → "Connection error. Dobara try karein."

**Edge Cases:**
- User on 2 devices — both logged in — 3rd device blocked
- Password reset — only superior role can do it — no self-service

## Data & Fields
| Field | Description |
|---|---|
| email | School-generated for students (e.g. `firstname.classname@schoolname.com`) |
| password | Manually shared by school with user |
| role | Injected into JWT by Custom JWT Hook |
| school_id | Injected into JWT |
| branch_id | Injected into JWT |
| class_id | Injected into JWT |
| is_active | Checked on every request via middleware |
| device_tokens | `jsonb` array — max 2 entries — `[{token, device_name, last_login}]` |
| expo_push_token | Set automatically on login — system managed |

## Business Rules & Logic
- No self-service registration — superior role creates all accounts
- No email verification — credentials shared manually
- No self-service password reset — superior role handles via Edge Function
- Role change → IMMEDIATELY force logout (`auth.admin.signOut(userId)`) — JWT would otherwise remain valid for 7 days
- Credentials change (email/password) → force logout immediately
- Max 2 devices — 3rd device blocked at login time
- `device_tokens` manages device registry — login updates the entry

## API / Integrations
- **Supabase Auth:** `auth.admin.createUser()` — only via Edge Functions with Service Role Key
- **Custom JWT Hook:** Embeds `role`, `school_id`, `branch_id`, `class_id` into every token
- **Edge Functions:**
  - `create-user` — creates auth user + profile via Service Role Key
  - `update-credentials` — email/password change + force logout
- **RLS:** All tables protected — Anon Key used on frontend enforces RLS

## Open Questions / Missing Info
- What happens to `device_tokens` if a device is lost? Can the user (or superior role) manually remove a device?
- Is there a "remember me" / session persistence setting?
- What is the JWT expiry duration? (Doc mentions "7 days" as context for why force logout is needed after role change)
- How exactly are credentials delivered to users — in-person, WhatsApp, email? Not specified
- Biometric login mentioned (`biometric_id` field in profiles) — no screen or flow described for biometric auth setup
- Is there a web-based forgot password flow for Admin? (Admin has no superior)
