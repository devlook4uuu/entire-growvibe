# Applications (Leave System)

## Overview
Students and teachers can submit leave applications (sick leave, etc.). Student applications route to the incharge teacher. Teacher applications route to Coordinator/Principal. Only approve or reject — no reason field or counter-offer. Optional file attachment. Push notification on status change. Only current session's history is visible.

## User Roles & Access
- **Student:** Submit applications — view own history
- **Teacher:** Submit applications — view own history
- **Incharge Teacher:** Approve/reject student applications in own class
- **Principal / Coordinator:** Approve/reject teacher applications in own branch
- **Owner:** View all applications

## Core Functionality
- Submit leave application (student or teacher)
- Optional attachment (e.g. medical certificate)
- Approve application (approver role)
- Reject application (approver role)
- Push notification to applicant on approve/reject
- Push notification to approver on new application
- Filter: Pending / Approved / Rejected / All
- View only current session's history

## UI Screens & Components

### Screen: Applications List (Approver)
**Visible To:** Incharge Teacher (student apps), Principal/Coordinator (teacher apps), Owner (all)

**Data Displayed:**
- Pending applications list: applicant name, type, date, submitted at
- Filter: Pending / Approved / Rejected / All

**User Actions:**
- Tap application → detail → Approve / Reject buttons

**UX Flow:**
Approver opens Applications → sees pending → taps → reviews → approves or rejects → applicant notified

**Empty State:** "Koi pending applications nahi."

**Edge Cases:**
- Approved leave: push notification to student/teacher — attendance is NOT auto-marked (teacher must manually mark Leave in attendance)

---

### Screen: Submit Application (Student/Teacher)
**Visible To:** Student, Teacher

**Data Displayed:**
- Form: Type (Sick Leave, Other), Date/Date Range, Reason (text), Optional attachment

**User Actions:**
- Fill form → Submit

**UX Flow:**
Open Applications → tap "+ New Application" → fill form → optional attachment → submit → sent to incharge teacher (student) or coordinator/principal (teacher) → push notification to approver

**Error States:**
- Attachment upload fail → "Attachment upload nahi hua — bina attachment ke submit karo ya dobara try karo"

**Edge Cases:**
- Only current session applications history is shown
- Approved leave: teacher must manually go to Attendance and mark Leave — it is NOT automatic

## Data & Fields
| Field | Description |
|---|---|
| applicant_id | FK to profiles |
| type | Enum: sick_leave / other |
| date | Date or date range |
| reason | Text |
| attachment_url | Optional — Supabase Storage |
| status | Enum: pending / approved / rejected |
| reviewed_by | FK to profiles (approver) |
| reviewed_at | Timestamp |
| branch_id | FK to branches (for routing/filtering) |

**Key Index:** `(branch_id, status)`

## Business Rules & Logic
- Routing: student application → incharge teacher | teacher application → coordinator/principal
- No reason field for approval/rejection — binary decision only
- Approved leave does NOT auto-mark attendance — teacher must do it manually
- Only current session history visible (filtered by `session_id` or date range)
- Optional attachment — application can be submitted without it
- If attachment upload fails: user can submit without it or retry
- Push notification to approver on submission
- Push notification to applicant on status change

## API / Integrations
- **Supabase Storage:** Application attachments
- **Expo Push Notifications:**
  - On submission: notification to approver
  - On approval/rejection: notification to applicant

## Open Questions / Missing Info
- Can an application be withdrawn by the applicant after submission?
- Can a rejected application be resubmitted?
- "Date Range" for applications — is this a start + end date pair, or a list of individual dates?
- Is there a maximum number of applications per student per session?
- Teacher applies to Coordinator OR Principal — if both exist, who gets the notification? Both?
- "Other" leave type — is this free text or a predefined list that might expand?
- Can the approver add comments when approving/rejecting? (Doc says no reason field — but this needs clarification for UX)
- Application history: "only current session" — how is session determined for applications? By date range matching session dates?
- Owner sees "all" applications — across all branches and all application types?
