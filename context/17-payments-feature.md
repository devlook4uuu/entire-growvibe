# 17 — Payments Feature (SaaS Subscriptions)

## What Was Built

Admin-managed SaaS subscription payments for schools. Admin records monthly/annual payments per school. After recording a payment, a push notification is sent to the school owner.

---

## Database (Migrations Applied)

### `20260414000012_create_subscription_payments.sql`
- Table: `subscription_payments`
  - Columns: `id, school_id, amount, payment_method ('cash'|'bank_transfer'|'cheque'|'online'), payment_status ('paid'|'partial'|'unpaid'), month (text — e.g. "April 2026"), notes (text), recorded_by (uuid), created_at, updated_at`
  - FK: `school_id → schools(id) ON DELETE CASCADE`
- RLS:
  - Admin: full access
  - Owner: SELECT own school's payments only (`school_id = profile.school_id`)

---

## Web — `PaymentsPage.jsx`

Route: `/payments` — admin only

- Lists all payments across all schools
- Cache keyed by `schoolId|query`, TTL default
- `PAGE_SIZE` default
- Each card shows: school name, month, amount (PKR formatted), payment method, status pill, notes
- Add via slide-over: school picker, month (text input), amount, payment method dropdown, status dropdown, notes
- Edit via same slide-over pre-filled
- After successful insert:
  1. Fetches school owner (`profiles` where `school_id` + `role = 'owner'`)
  2. Fires `sendPush([owner.id], 'Payment', 'A payment has been recorded for {month}')` — fire-and-forget

Payment methods: Cash, Bank Transfer, Cheque, Online
Payment statuses: Paid (green), Partial (yellow), Unpaid (red)

### `invalidatePaymentCache(schoolId)`
Exported — call after any payment mutation.

---

## App — `paymentList.jsx` + `paymentForm.jsx`

Hook: `hooks/usePaymentList.js` + `hooks/usePaymentForm.js`

### `paymentList.jsx`
- Route params: `schoolId`, `schoolName`
- Lists all payments for the given school
- Pull-to-refresh, pagination with Load More
- Same card layout as web: month, amount, method, status pill
- Edit FAB on each card → `paymentForm` in edit mode

### `paymentForm.jsx`
- Create and edit payments
- Fields: month, amount, payment method picker, status picker, notes
- On create: fires push to school owner

---

## Key Decisions

1. **`month` as free text** — e.g. "April 2026". Not a date column. Avoids timezone issues and lets admin enter custom periods like "Q1 2026".
2. **Admin-only write access** — owners can only read their own school's payments. No owner-side payment entry.
3. **Push notification on record** — owner is notified immediately when admin records a payment, without needing to check the app.
4. **`recorded_by`** — audit trail. Stores the admin's `auth.uid()` at insert time.

---

## Gotchas

- `month` field is freeform text — no validation on format. Admin must enter consistently (e.g. always "April 2026") for reports to be meaningful.
- The push notification fires after a successful DB insert. If the owner has no device token, the push silently fails (fire-and-forget catch).
- `PaymentsPage` is admin-only. Owners see a read-only list via the app's `paymentList` screen navigated from the school detail.
