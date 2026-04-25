# Fee Management

## Overview
Fee management is deliberately simple and binary — a fee record is either paid or unpaid. There is no partial payment. The flow has three distinct steps: (1) create fee record, (2) mark as paid, (3) generate receipt. Teachers can create fee records but cannot mark paid or generate receipts. Even inactive sessions allow fee marking (special exception). Data is never deleted.

## User Roles & Access
- **Owner / Principal / Coordinator:** Full access — create, mark paid, generate receipt
- **Teacher:** Create fee record only — cannot mark paid, cannot generate receipt
- **Student:** View own fee history (app only) — read only
- **Admin:** No fee management (per-school feature)

## Core Functionality
- Create fee records for a class (bulk — all students in a class for a month)
- Pre-fill amounts from student `default_fee`
- Mark fee as paid (Owner/Principal/Coordinator only)
- Generate PDF receipt (Owner/Principal/Coordinator only)
- View fee list with filters: class, month, status
- Summary bar: total collected, total pending, total students
- Bulk mark multiple records as paid
- Student app view: month-wise history with PAID/UNPAID badges

## UI Screens & Components

### Screen: Fee List
**Visible To:** Owner, Principal, Coordinator, Teacher (create only)

**Data Displayed:**
- Filter: Class dropdown, Month picker (YYYY-MM), Status: All / Paid / Unpaid
- Table: Student name, month, amount, status badge (PAID green / UNPAID red), `paid_at` date, `created_by`
- Summary bar: Total collected, Total pending, Total students

**User Actions:**
- "+ Create Fee Record" button
- Click row → Fee Detail
- Bulk: select multiple → Mark as Paid (Owner/Principal/Coordinator only)
- "Generate Receipt" per student (Owner/Principal/Coordinator only)

**UX Flow:**
Open Fee List → filter by class + month → see all records → click to manage individual records

**Empty State:** "Koi fee record nahi. Pehla fee record banao."

**Error States:**
- Filter returns no results → "Is filter ke liye koi record nahi"

**Edge Cases:**
- Session switch: old session fees still accessible via session filter
- Student mid-session join: only fee records from their join date onwards

---

### Screen: Create Fee Record
**Visible To:** Owner, Principal, Coordinator, Teacher

**Data Displayed:**
- Class selector
- Month picker (YYYY-MM)
- Students list with amount field per student (pre-filled from `default_fee`)
- Notes field (optional)
- Submit button

**User Actions:**
- Select class → select month → edit amounts if needed → submit

**UX Flow:**
Open Create Fee → select class → select month → students load with `default_fee` pre-filled → edit amounts if needed → add notes → Submit → records created → push notifications sent to students

**Error States:**
- Duplicate fee (student + month already exists) → "Kuch students ki is month ki fee already record hai: [names]" → shows which ones failed, rest are created
- Amount 0 → "Amount 0 nahi ho sakta"
- No students in class → "Is class mein koi student nahi"

**Edge Cases:**
- Partial create allowed: if some students already have fee for that month, only the new ones are created — no full rollback

---

### Screen: Student — Fee History (App)
**Visible To:** Student only

**Data Displayed:**
- Month-wise list: YYYY-MM, Amount, Status badge
  - Example: Jan 2026 — PKR 3,500 — PAID (green)
  - Example: Feb 2026 — PKR 3,500 — UNPAID (red)
- Total paid amount
- Total pending amount

**User Actions:** View only — no actions for student

**UX Flow:**
Student opens Fee tab → sees history → PAID/UNPAID badges → parent can view on same device

**Empty State:** "Koi fee record nahi abhi tak."

**Edge Cases:**
- Student is also parent's view — same account, same device

## Data & Fields
| Field | Description |
|---|---|
| student_id | FK to profiles |
| month | `YYYY-MM` format |
| amount | PKR amount — pre-filled from `default_fee` |
| status | Enum: paid / unpaid |
| paid_at | Timestamp — set when marked paid |
| receipt_number | Auto-generated: `REC-YYYY-XXXX` sequential per school |
| receipt_url | Supabase Storage URL — generated PDF |
| created_by | FK to profiles (who created the record) |
| notes | Optional text field |
| session_id | FK to sessions |

**Key Constraint:** `(student_id, month) UNIQUE` — no duplicate fee per student per month  
**Key Index:** `(class_id, month)`

## Business Rules & Logic
- Fee is **binary**: paid or unpaid — no partial payment, ever
- `(student_id, month) UNIQUE` — duplicate fee creation blocked at DB level
- Teacher: can create fee records, cannot mark paid, cannot generate receipt
- Inactive session exception: fees can still be marked as paid even on inactive sessions
- Fee edit: only allowed if receipt has not been generated yet
- Receipt number: auto-generated on payment — format `REC-YYYY-XXXX` sequential per school
- Receipt must clearly show "PAID" or "UNPAID" watermark
- Push notification sent to student on fee record creation
- Partial create: if some students in a class already have fee for the month, the new records are created for the rest — no error blocks the whole batch

## API / Integrations
- **Edge Function:** `generate-fee-receipt` — uses `pdf-lib` to generate PDF → saves to Supabase Storage → returns URL
- **Expo Push Notifications:** Sent to student on fee record creation
- `school_payments` table: tracks SaaS subscription payments (separate from student fees)

## Open Questions / Missing Info
- Can a fee record be deleted before receipt generation? Or is deletion also prohibited?
- What happens to fee records when a student is deactivated or promoted? (Doc says data preserved — but filtered how?)
- `default_fee` — is it per student or per class? Doc shows it as a per-student field
- Receipt "UNPAID watermark" — when would you generate a receipt for an unpaid fee? Is that intentional?
- Can the fee amount be edited after creation but before payment? (Doc says "sirf agar receipt generate nahi hui ho" — but does this mean only before payment, or before receipt specifically?)
- Notes field — is this visible to the student in their fee history?
- Who receives the "Close Delivery Week" receipt mentioned in notifications? (Branch Principal/Coordinator) — this is Store receipt, not fee receipt, but fee PDF generation is also mentioned for store
- `session_id` on fees — is this automatically inferred from the current session or explicitly set?
