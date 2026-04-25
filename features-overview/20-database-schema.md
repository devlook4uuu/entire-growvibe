# Database Schema Reference

## Overview
Complete reference of all PostgreSQL tables in GrowVibe, with key constraints, indexes, and RLS status. All tables use Supabase RLS except `processing_jobs`. Foreign keys use `ON DELETE RESTRICT` to prevent orphan records. No hard deletes anywhere.

## User Roles & Access
- **Supabase RLS:** Enforces data isolation per school/branch/class on every table
- **Admin (Abdullah):** Service Role Key access via Edge Functions only

## All Tables

| Table | Key Constraint | Key Index | RLS |
|---|---|---|---|
| profiles | PK = auth.users.id | school_id, branch_id, (school_id+role) | YES |
| schools | owner_id UNIQUE | — | YES |
| branches | — | school_id | YES |
| sessions | (branch_id, name) UNIQUE | (branch_id, is_current) | YES |
| classes | — | (school_id, session_id) | YES |
| chats | class_id UNIQUE | — | YES |
| chat_members | (chat_id, user_id) UNIQUE | — | YES |
| messages | — | (chat_id, created_at) | YES |
| attendance | (user_id, date) UNIQUE | (class_id, date), (branch_id, date) | YES |
| holidays | — | (school_id, date), (branch_id, date) | YES |
| processing_jobs | — | status | NO |
| fees | (student_id, month) UNIQUE | (class_id, month) | YES |
| timetables | (class_id, week_type) UNIQUE | — | YES |
| results | — | (class_id, session_id) | YES |
| datesheets | — | class_id | YES |
| exams | — | class_id | YES |
| diaries | — | (class_id, date) | YES |
| leaderboards | — | (class_id, session_id) | YES |
| applications | — | (branch_id, status) | YES |
| notes | — | (branch_id, target_roles) | YES |
| support_tickets | — | (school_id, status) | YES |
| grow_tasks | — | is_active | YES |
| grow_task_submissions | (student_id, grow_task_id, cycle_label) UNIQUE | (student_id, cycle_label) | YES |
| coin_transactions | — | (student_id, created_at) | YES |
| products | — | is_active | YES |
| orders | — | (school_id, delivery_week), (user_id, created_at) | YES |
| vouchers | — | (student_id, is_redeemed) | YES |
| school_payments | — | (school_id, month) | YES |
| banners | — | is_active | YES |
| online_classes | — | (class_id, scheduled_at), status | YES |

## Key Design Decisions

### Identity & Profiles
- `profiles.id = auth.users.id` — Supabase Auth UUID
- Single `profiles` table for all 6 roles
- Role stored on profile — injected into JWT via Custom JWT Hook
- `device_tokens` jsonb — max 2 entries — `[{token, device_name, last_login}]`
- `grow_coins` — denormalized cache on profiles — `coin_transactions` is source of truth

### School Isolation
- Every table has `school_id` or traces back via FK to a school
- RLS policies enforce school isolation
- `schools.owner_id UNIQUE` — one owner per school

### Sessions & Classes
- `(branch_id, name) UNIQUE` — duplicate session names blocked per branch
- `(branch_id, is_current)` index — fast current session lookup
- `classes` scoped to `(school_id, session_id)` — new session = new classes

### Chat Architecture
- `chats.class_id UNIQUE` — exactly one chat per class
- `(chat_id, created_at)` index — efficient message pagination
- `(chat_id, user_id) UNIQUE` on `chat_members` — no duplicate members

### Attendance
- `(user_id, date) UNIQUE` — one record per student per day
- `date: DATE` type — NOT `timestamptz` (timezone bug prevention)
- `processing_jobs` has NO RLS — Edge Functions need unrestricted access

### Coins & GrowTasks
- `(student_id, grow_task_id, cycle_label) UNIQUE` — double award impossible
- `coin_transactions` is the ledger — profiles.grow_coins is a cache
- Monthly cron verifies + auto-corrects the cache

### E-Commerce
- `orders` indexed by `(school_id, delivery_week)` — efficient week close batching
- `vouchers` indexed by `(student_id, is_redeemed)` — quick voucher lookup

### Fees
- `(student_id, month) UNIQUE` — no duplicate fee per student per month

### Timetable
- `(class_id, week_type) UNIQUE` — one timetable per week type per class
- Schedule stored as jsonb — no separate periods table

### Storage Buckets (Supabase Storage)
All buckets must be **private** with RLS:
- Profile images
- School logos
- Diary attachments
- Application attachments
- Order receipts / fee PDFs
- Online class attachments
- Product images

## Notable Tables Not in Main Features

### `school_payments`
Tracks SaaS subscription payments per school per month. Key index: `(school_id, month)`.

### `banners`
Likely marketing/announcement banners for the app. Index: `is_active`. No feature screen described.

### `holidays`
Branch or school-wide declared holidays. Affects effective days calculation for attendance coins.  
Index: `(school_id, date)`, `(branch_id, date)`. No dedicated management screen described.

### `datesheets`
Exam schedule/datesheet. Separate from `exams` table (which holds the actual paper).  
Index: `class_id`. No detailed screen described beyond Create Exam.

### `processing_jobs`
Tracks biometric file upload processing status. **No RLS** — Edge Functions need full access.  
Index: `status`. Status values: Pending / Processing / Done / Failed.

## Open Questions / Missing Info
- `banners` table — what is this for? No screen or feature described for it
- `datesheets` vs `exams` — what's the exact distinction? Both indexed by `class_id`
- `notes.target_roles` — what does this field contain? An array of roles? Not described in feature section
- `holidays` management screen — not described. Who creates holidays? Owner? Admin?
- `school_payments` — how are SaaS payments recorded? Manual entry by Admin? Automated billing?
- RLS policies are mentioned as required but not specified — what are the exact policies per table?
- `profiles` compound index `(school_id, role)` — used for staff list filtering?
- `vouchers` table structure — beyond `student_id` and `is_redeemed`, what other fields? (type, claimed_at, used_in_order_id?)
- `processing_jobs` — who cleans up old completed/failed jobs?
