# 08 — Fee Records Feature

## What Was Built

Full per-student monthly fee tracking across both the mobile app and the web dashboard, plus a web-only fee receipt printing page.

---

## Database

### Migration files

| File | Description |
|------|-------------|
| `supabase/migrations/20260418120000_create_student_fee_records.sql` | Table, enums, RLS policies, updated_at trigger, `upsert_fee_record` RPC |
| `supabase/migrations/20260418130000_create_fee_records_view.sql` | `fee_records_with_details` view — joins fee records with school name, student profile, class name |

### Table: `student_fee_records`

```sql
id              uuid PK
school_id       uuid FK → schools       (denormalised per CLAUDE.md rule)
branch_id       uuid FK → branches
session_id      uuid FK → sessions
class_id        uuid FK → classes
student_id      uuid FK → profiles
month           text   -- 'YYYY-MM'
fee_amount      numeric(12,2)
amount_paid     numeric(12,2)
payment_method  fee_payment_method enum (cash | bank_transfer | cheque | online)
payment_status  fee_payment_status enum (paid | partial | unpaid)  -- auto-computed
description     text
created_at / updated_at
UNIQUE (student_id, session_id, month)
```

### Enums

```sql
fee_payment_method: cash | bank_transfer | cheque | online
fee_payment_status: paid | partial | unpaid
```

### RPC: `upsert_fee_record`

- `security definer` function — bypasses RLS for the write
- Auto-computes `payment_status`:
  - `paid` if `amount_paid >= fee_amount`
  - `partial` if `amount_paid > 0`
  - `unpaid` otherwise
- Does `INSERT ... ON CONFLICT (student_id, session_id, month) DO UPDATE`
- Returns the full updated row

### View: `fee_records_with_details`

Joins `student_fee_records` with `schools`, `profiles`, `classes` to expose:
- `school_name`, `school_logo_url`
- `student_name`, `student_email`, `student_avatar_url`
- `class_name`

Used by `FeeReceiptsPage` so it needs only one query — no separate school/student fetches. RLS is inherited from the base table.

### RLS policies

| Role | Access |
|------|--------|
| admin | Full access (all rows) |
| owner | Full access scoped to `school_id` |
| principal / coordinator | Full access scoped to `branch_id` |
| student | Select own rows only (`student_id = auth.uid()`) |

---

## App (React Native / Expo)

### New files

| File | Purpose |
|------|---------|
| `hooks/useFeeList.js` | Data hook for per-student fee records. Module-level cache keyed by `${studentId}\|${sessionId}`, 30s TTL. Returns `{ items, loading, refreshing, error, refresh, updateItem, addItem }`. Exports `invalidateFeeCache(studentId, sessionId)`. |
| `app/screens/fee/feeList.jsx` | Fee records list screen. Header with back + add buttons, session banner, `FeeCard` per record (month, status badge, fee/paid/remaining rows, edit button), empty state, skeleton loading, pull-to-refresh. |
| `app/screens/fee/feeForm.jsx` | Add/edit fee record form. `DropdownSheet` modal for month and payment method. Live remaining preview. Calls `upsert_fee_record` RPC. Invalidates cache on save then `router.back()`. |

### Modified files

| File | Change |
|------|--------|
| `app/screens/student/studentList.jsx` | Added green "Fee" button on each student card. `handleFee(student)` navigates to `/screens/fee/feeList` passing `studentId`, `studentName`, `sessionId`, `sessionName`, `classId`, `branchId`, `schoolId`. Falls back to Redux `selectedSessionId` if `sessionId` not in params. |
| `app/screens/class/classList.jsx` | `handleStudents` now passes `sessionId` and `sessionName` params through to `studentList` so they reach `feeList`. |

---

## Web (React + Vite)

### New files

| File | Purpose |
|------|---------|
| `src/pages/management/FeeRecordsPage.jsx` | Full listing page for one student's fee records. Route: `/fee-records?studentId=…&studentName=…&studentFee=…&classId=…&className=…`. Card grid + SlideOver add/edit form. Same pattern as `ClassesPage`. Module-level cache keyed by `${studentId}\|${sessionId}`. |
| `src/pages/management/FeeReceiptsPage.jsx` | Receipt printing page. Route: `/fee-receipts`. Class dropdown → month dropdown → fetches from `fee_records_with_details` view → card grid with multiselect checkboxes → print selected receipts. |

### Modified files

| File | Change |
|------|--------|
| `src/pages/management/StudentsPage.jsx` | Fee button on student card now navigates to `/fee-records?…` instead of opening a slide-over. All fee slide-over components (`FeeSlideOver`, `FeeRecordCard`, `FeeRecordForm`) removed. Exports `MONTH_OPTIONS` (used by `FeeReceiptsPage`). |
| `src/App.jsx` | Added routes: `/fee-records` → `FeeRecordsPage`, `/fee-receipts` → `FeeReceiptsPage`. |
| `src/data/sidebarConfig.js` | Added `Fee Receipts` sidebar entry (Receipt icon, `/fee-receipts`) for owner, principal, coordinator roles. |

---

## Key Decisions

### school_id denormalised on fee table
Per CLAUDE.md rule — every school-scoped table carries `school_id` directly even if reachable via FK chain, for fast RLS and direct `eq('school_id', …)` queries.

### View for receipt printing
`FeeReceiptsPage` originally did separate fetches for school name and student profiles. Both failed silently due to RLS on `schools` table (owner profile only has `school_id`, no direct select grant on the row). Fixed by creating `fee_records_with_details` view which joins everything — one query, no RLS hop issues, school name always present.

### Print isolation in React SPA
`body > *:not(#print-area) { display: none }` doesn't work because the print area is nested inside `#root`. Solution: inject a temporary `<style>` tag into `<head>` before `window.print()` and remove it after:
```js
body * { visibility: hidden !important; }
#print-area, #print-area * { visibility: visible !important; }
#print-area { position: fixed !important; top: 0; left: 0; width: 100%; display: block; }
```

### Receipt print design — grayscale only
School cannot afford colour printing. Receipt cards use only black (`#111`), grays, and white. Solid dark header bar, grayscale avatar, black-border balance box, gray status stamp. No coloured ink needed.

### `upsert_fee_record` is security definer
The RPC runs with elevated privileges so it can write regardless of the caller's RLS policy, while the SELECT policies still restrict reads normally.

### Fee records page is a full page, not a slide-over
Initial implementation used a slide-over with an embedded list + inline form switching. Replaced with a dedicated `/fee-records` route that matches the pattern of all other listing pages (ClassesPage, StudentsPage, StaffPage etc.) — full page, card grid, SlideOver for add/edit only.

---

## Gotchas

- `payment_status` is never set by the client — always computed by the RPC from `fee_amount` vs `amount_paid`.
- The unique constraint is `(student_id, session_id, month)` — not `(student_id, month)`. A student can have different records for the same month across different sessions.
- `MONTH_OPTIONS` is exported from `StudentsPage.jsx` and imported by both `FeeRecordsPage.jsx` and `FeeReceiptsPage.jsx`. If `StudentsPage` is ever split, move `MONTH_OPTIONS` to a shared constants file.
- The `fee_records_with_details` view does not have its own RLS — it inherits from `student_fee_records`. The `grant select` on the view is still required so PostgREST exposes it.
- On the app, `sessionId` may come from route params (when navigating class → students → fee) or from Redux `selectedSessionId` (when navigating directly). `feeList.jsx` always resolves `sessionId || selectedSessionId`.
