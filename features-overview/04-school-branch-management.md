# School & Branch Management

## Overview
Admin creates schools and branches. Each school is linked to exactly one Owner (UNIQUE constraint). Branches are subdivisions of a school. Deactivating a school or branch causes all linked users to receive 403 errors — no data is ever deleted. All changes are non-destructive.

## User Roles & Access
- **Admin:** Full access — create schools, create branches, activate/deactivate
- **Owner:** View and manage own school's branches — cannot create new schools
- **Principal:** View own branch detail
- **Others:** No access

## Core Functionality
- Create school (Admin only)
- Assign owner to school (one owner per school — UNIQUE)
- Create branches for a school (Admin only, at school creation time or later)
- Activate / deactivate school
- Activate / deactivate branch
- View all schools list with search and filter
- View school detail: info, branches, payment history
- View branch detail: staff, sessions, off days
- Edit school info (name, logo, address, phone, email)
- Edit branch info (name, address, off days)
- Assign / change Principal for a branch

## UI Screens & Components

### Screen: Admin — Schools List
**Visible To:** Admin only

**Data Displayed:**
- Table of all schools: school name, logo, owner name, branches count, `is_active` status, created date
- Search bar — search by school name
- Filter: active / inactive

**User Actions:**
- "+ Create School" button → opens Create School modal
- Click school row → School Detail screen
- Toggle active/inactive — confirmation dialog first

**UX Flow:**
Admin opens Schools List → sees all schools → clicks "+ Create School" → modal opens → fills name + owner (dropdown from owners list) → submit → school created → list refreshes

**Empty State:** "No schools yet. Create your first school." + Create button

**Error States:**
- Owner already assigned to another school → "Ye owner already ek school ka owner hai"
- Network error → toast error + retry

**Edge Cases:**
- Owner account must exist before school creation
- Inactive school — all linked users cannot login

---

### Screen: Admin — School Detail
**Visible To:** Admin only

**Data Displayed:**
- School name, logo, address, phone, email
- Owner info: name + contact
- Branches list with status
- SaaS payment history — last 12 months
- Created date

**User Actions:**
- Edit school info button
- Add branch button
- Activate / Deactivate school toggle
- Click branch → Branch detail

**UX Flow:**
Admin clicks school from list → School Detail loads → Admin can edit info or manage branches

**Error States:**
- Cannot deactivate school with pending orders → warning dialog

**Edge Cases:**
- School deactivate → all users 403 immediately
- Logo upload: new logo → success → delete old from Supabase Storage

---

### Screen: Admin — Create/Edit School Modal
**Visible To:** Admin only

**Data Displayed:**
- Form fields: School Name (required), Logo upload, Address, Phone, Email
- Owner dropdown — shows only unassigned owners

**User Actions:**
- Fill form → Submit
- Cancel

**UX Flow:**
Admin fills school name + selects owner from dropdown → submit → school created → modal closes → list refreshes

**Error States:**
- School name empty → inline validation "School name required"
- No owner selected → "Owner select karna zaroori hai"
- Logo upload fail → "Logo upload failed. Try again."

**Edge Cases:**
- Owner dropdown shows only unassigned owners (no owner can be linked to 2 schools)

---

### Screen: Owner/Admin — Branches List
**Visible To:** Admin (all schools), Owner (own school only)

**Data Displayed:**
- Branch name, address, principal name (or "Not Assigned"), `is_active` status
- Off days
- Created date

**User Actions:**
- "+ Add Branch" button (Admin only)
- Click branch → Branch Detail
- Toggle active/inactive

**Empty State:** "No branches yet." (Admin sees add button, Owner contacts Admin)

**Error States:**
- Branch deactivate → all branch users 403

**Edge Cases:**
- Principal vacancy: if principal becomes inactive → `branch.principal_id = NULL` → Owner handles or re-assigns

---

### Screen: Owner — Branch Detail
**Visible To:** Owner, Principal (own branch), Admin

**Data Displayed:**
- Branch name, address, phone
- Principal info (or "Not Assigned")
- Off days setting
- Active sessions list
- Staff count by role
- `is_active` status

**User Actions:**
- Edit branch info
- Assign/change principal
- Change off days
- Activate/deactivate branch

**UX Flow:**
Owner clicks branch → detail loads → can edit off days → change takes effect on next effective days calculation

**Error States:**
- Off days change → warning "Coins calculation affect hogi" → confirm dialog

**Edge Cases:**
- `off_days`: stored as `text[]` e.g. `["sunday"]` or `["saturday","sunday"]`

## Data & Fields
| Field | Description |
|---|---|
| school name | Required, text |
| logo | Image upload — stored in Supabase Storage |
| address | Text |
| phone | Text |
| email | Text |
| owner_id | FK to profiles — UNIQUE per school |
| is_active | Boolean — false = all linked users get 403 |
| branch name | Text |
| branch address | Text |
| principal_id | FK to profiles (nullable) |
| off_days | `text[]` e.g. `["sunday"]` |

## Business Rules & Logic
- School creator: Admin only
- Branch creator: Admin only (alongside school or later)
- One owner per school — UNIQUE constraint on `owner_id`
- School/branch inactive (`is_active = false`): all linked users get 403 — data fully preserved
- Hard delete: NEVER — only `is_active = false`
- School deactivation warning if pending orders exist
- Off days change triggers warning about coins calculation impact
- Old logo deleted from Storage when new logo uploaded successfully
- Principal vacancy: assign new principal to old account (update email + personal info on the existing profile)

## API / Integrations
- Supabase Storage for logo uploads
- `ON DELETE RESTRICT` on all FKs — no orphan records

## Open Questions / Missing Info
- Can Admin edit branch off days, or only Owner?
- What fields exactly are editable in "Edit branch info"? (Only address/phone mentioned; off days has its own action)
- School payment history (SaaS) — how is it recorded? Is there a billing integration or manual entry?
- "Add Branch" — can Owner request Admin to add a branch, or is it strictly Admin-only with no workflow?
- What is the maximum number of branches per school? Not specified
- How does "Cannot deactivate school with pending orders" resolve — does admin have to resolve orders first?
