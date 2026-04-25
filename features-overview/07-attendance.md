# Attendance Management

## Overview
Attendance is GrowVibe's most complex feature. It has three distinct systems: (1) marking attendance, (2) calculating coins from attendance, and (3) displaying attendance to students. Both manual and biometric attendance are supported. Late status counts as Present for coin calculation purposes. An "Unmarked Day" (school day with zero attendance records) is excluded from Effective Days.

## User Roles & Access
- **Teacher:** Mark own class, today only. Cannot edit own attendance. Cannot edit past days.
- **Owner:** Mark any branch, any date, unlimited edit
- **Principal:** Mark own branch, any date, unlimited edit
- **Coordinator:** Mark own branch, any date, unlimited edit
- **Student:** View only (own attendance)

## Core Functionality
- Mark attendance: Present / Absent / Late / Leave per student
- Bulk action: Mark All Present
- Edit attendance (Owner/Principal/Coordinator — any date; Teacher — today only, cannot edit)
- Biometric file upload and processing (background via Edge Function)
- View attendance history with filters (class, date)
- Student attendance view: weekly + monthly progress + calendar
- Effective Days calculation for coin awards
- Push notifications to students on absence/late mark

## UI Screens & Components

### Screen: Teacher — Mark Attendance (Today)
**Visible To:** Teacher (own class), Owner, Principal, Coordinator (any class, any date)

**Data Displayed:**
- Class name header
- Date: today (Teacher) or date picker (Owner/Principal/Coordinator)
- Students list: name + profile photo
- Status buttons per student: Present / Absent / Late / Leave
- Bulk action: "Mark All Present" button
- Submit button

**User Actions:**
- Tap status button per student → Submit → notifications sent to absent/late students

**UX Flow:**
Teacher opens Attendance → today date auto-selected → sees student list → marks each student → Submit → records saved → push notifications sent to absent/late students (parent receives on same device as student)

**Empty State:** "No students in this class yet."

**Error States:**
- Already marked today → show existing marks with edit option (Teacher: edit blocked; Owner/Principal/Coordinator: edit allowed)
- Off day → yellow warning banner "Ye off day hai — phir bhi mark karna chahte ho?" → confirm → allow
- Network error → "Save failed. Check connection." → retry button

**Edge Cases:**
- Status change triggers another notification — no cooldown
- Teacher marks → Principal changes → student gets new notification

---

### Screen: Owner/Principal/Coordinator — Attendance History
**Visible To:** Owner, Principal, Coordinator

**Data Displayed:**
- Date picker
- Class filter dropdown
- Attendance table: student name, status, `marked_by`, source (manual/biometric)
- Summary: Present count, Absent count, Late count, Leave count

**User Actions:**
- Select date + class → view records
- Click student record → edit status (with confirmation)

**UX Flow:**
Select date → select class → records load → click any record to edit if needed

**Empty State:** "Is din ke liye koi attendance record nahi hai."

**Edge Cases:**
- Biometric source records: show "Biometric" badge
- Manual source: show "Manual" badge
- Edit attempt on off day → warning shown but allowed with confirmation

---

### Screen: Biometric Upload
**Visible To:** Owner, Principal, Coordinator

**Data Displayed:**
- Branch selector
- Date picker
- File upload area (drag & drop or click)
- Processing status: Pending / Processing / Done / Failed
- Results summary after processing: X present, X absent, X late, X unknown IDs skipped

**User Actions:**
- Select branch + date → upload file → submit

**UX Flow:**
Select branch → select date → upload file → submit → instant "File upload ho gayi" response → Edge Function processes in background → `processing_jobs` status updates → push notification when done

**Error States:**
- Same branch + date already processed → "Ye file already process ho chuki hai is din ke liye"
- File format wrong → "Invalid file format. ZK Techo K40 format required"
- Edge Function fail → `status = failed` → `pg_cron` retries → if still fails → manual intervention needed

**Edge Cases:**
- Manual + biometric same student same day: **Manual wins** — biometric is skipped
- Unknown biometric ID: silently skipped, logged
- Chunked inserts: 20 records at a time to prevent timeout

---

### Screen: Student — Attendance View (App)
**Visible To:** Student only

**Data Displayed:**
- Weekly progress: "Is hafte: 3/4 din present" (actual numbers, not percentage)
- Monthly progress: "Is mahine: 18/20 din present"
- Weekly coins status: "Is hafte coins milenge / nahi milenge"
- Monthly coins status: "Is mahine 90% ke liye 2 aur din chahiye"
- Calendar view: color-coded days
  - Green = Present
  - Red = Absent
  - Yellow = Late
  - Gray = Leave
  - White = Off day / Holiday

**User Actions:** View only — no actions

**Empty State:** "Abhi tak koi attendance record nahi."

**Edge Cases:**
- Effective days = 0 (pure off/holiday week): "Is hafte effective days nahi hain" — no coins shown
- Off day: gray on calendar — not counted in totals

## Data & Fields
| Field | Description |
|---|---|
| user_id | FK to profiles |
| date | `DATE` type — NOT `timestamptz` (critical for timezone bug prevention) |
| status | Enum: present / absent / late / leave |
| marked_by | FK to profiles (who marked it) |
| source | Enum: manual / biometric |
| class_id | FK to classes |
| branch_id | FK to branches |

**Key Constraints:** `(user_id, date) UNIQUE`  
**Key Indexes:** `(class_id, date)`, `(branch_id, date)`

## Business Rules & Logic

### Effective Days Formula
```
Effective Days = Total Days − Off Days − Declared Holidays − Unmarked Days
```
- **Unmarked Day:** A school day where zero attendance records exist (no one marked any class)
- **Off Day:** Listed in `branches.off_days` (e.g. Sunday)
- **Declared Holiday:** Entered in `holidays` table
- **Effective Days = 0:** Skip completely — no coins, no penalty

### Coin Award Rules
- **Weekly:** 100% of effective days present or late → coins awarded
- **Monthly:** 90%+ of effective days present or late → coins awarded
- Late = Present for coin calculation purposes
- Awards run via `pg_cron`: weekly Saturday 6:59 PM UTC, monthly end of month

### Biometric Rules
- Device: ZK Techo K40 format
- Manual attendance wins over biometric on same student+date
- Unknown `biometric_id`: silently skipped and logged
- Duplicate file for same branch+date: blocked
- Processing is background — `pg_cron` retries on failure

## API / Integrations
- **Edge Function:** Biometric file processing (background)
- **pg_cron:** 
  - Weekly coin calculation (Saturday 6:59 PM UTC)
  - Monthly coin calculation (end of month)
  - `process-pending-jobs` (every 1 minute)
- **Expo Push Notifications:** Sent on absent/late mark, resent on status change
- **`processing_jobs` table:** Tracks biometric upload status

## Open Questions / Missing Info
- What is the exact biometric file format from ZK Techo K40? CSV? Binary? What fields?
- When `pg_cron` retries a failed biometric job — how many retries before "manual intervention"?
- "Unmarked Day" definition — what if 1 out of 10 classes marks attendance? Does that count as "marked" for the whole branch, or per-class?
- Off days change on branch — does it retroactively affect past effective days calculations or only future?
- Late status for coins: "Present counts" — but is there a time cutoff for "late" vs "absent"? Not specified
- Can a Teacher mark attendance for a date in the past (yesterday)? Doc says "today only" but "Already marked today → edit blocked" — so teachers cannot edit at all?
- Monthly coin calculation: is 90% calculated on calendar month effective days or session-to-date?
- Is there a "Holiday" declaration screen? (holidays table is in DB schema but no screen described)
