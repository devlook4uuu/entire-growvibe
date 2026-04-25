# Security Checklist

## Overview
A pre-launch security audit checklist covering 16 critical items. Items marked CRITICAL must be resolved before launch. All items are known vulnerabilities or race conditions in the system design. This file should be treated as a living checklist — mark items complete as they are implemented and verified.

## User Roles & Access
- **Admin (Abdullah):** Responsible for verifying all items
- **Developers:** Must implement every item before launch

## Core Functionality
Pre-launch security verification across: JWT security, RLS, race conditions, file storage, device limits, and data integrity.

## Security Checklist

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | JWT stale after role change | Force logout: `auth.admin.signOut(userId)` | ☐ |
| 2 | Service Role Key leak | Sirf Edge Functions — env vars — never frontend | ☐ |
| 3 | RLS not enabled | Har nayi table pe RLS enable — first action | ☐ |
| 4 | Attendance timezone bug | `date: DATE` type — not `timestamptz` | ☐ |
| 5 | Coins + order race condition | Atomic transaction: coins deduct + order together | ☐ |
| 6 | Orphan files in storage | Upload new → success → delete old | ☐ |
| 7 | Chat reconnect miss messages | `last_seen_at` → fetch messages after timestamp | ☐ |
| 8 | Stock race condition | `SELECT FOR UPDATE` in `place-order` Edge Function | ☐ |
| 9 | FK orphan records | `ON DELETE RESTRICT` all FKs | ☐ |
| 10 | Session switch race | Atomic: old false + new true + force reload | ☐ |
| 11 | Coin balance mismatch | Monthly cron: verify `grow_coins` vs ledger — auto-correct | ☐ |
| 12 | Biometric double file | `(branch_id, date)` already processed check | ☐ |
| 13 | Storage bucket RLS | Private buckets properly configured | ☐ |
| 14 | IDOR in Edge Functions | Manually verify ownership — not RLS alone | ☐ |
| 15 | Voucher race condition | `SELECT FOR UPDATE` on voucher claim — atomic | ☐ |
| 16 | 3rd device login | Max 2 devices — block 3rd login with error message | ☐ |

## Detailed Notes Per Item

### Item 1 — JWT Stale After Role Change
**Risk:** Role change without force logout → user retains old role JWT for up to 7 days  
**Fix:** Call `auth.admin.signOut(userId)` immediately on role change via Edge Function  
**Applies to:** Any role update, school change, branch change

### Item 2 — Service Role Key Leak
**Risk:** Exposing Service Role Key in frontend bypasses all RLS  
**Fix:** Service Role Key only in Edge Function environment variables — never in Vite/React frontend  
**Frontend uses:** Anon Key only (enforces RLS)

### Item 3 — RLS Not Enabled
**Risk:** Any new table without RLS is globally readable/writable by all authenticated users  
**Fix:** Enable RLS on every new table as the first action — before any other work

### Item 4 — Attendance Timezone Bug
**Risk:** Using `timestamptz` for attendance date causes timezone-related date shifts (Pakistan +5 → date appears as previous day in UTC)  
**Fix:** `attendance.date` must be `DATE` type, not `timestamptz`

### Item 5 — Coins + Order Race Condition
**Risk:** Two concurrent orders could both read sufficient coins balance and both deduct — resulting in negative balance  
**Fix:** Atomic transaction — coin deduction and order creation in single DB transaction with locking

### Item 6 — Orphan Files in Storage
**Risk:** Old files (profile images, logos) accumulate in Supabase Storage after updates  
**Fix:** Upload new → confirm success → delete old file

### Item 7 — Chat Reconnect Missed Messages
**Risk:** Device reconnects after being offline — misses messages sent while offline  
**Fix:** Track `last_seen_at` per chat member → on reconnect, fetch all messages with `created_at > last_seen_at`

### Item 8 — Stock Race Condition
**Risk:** Two students simultaneously order the last item — both succeed — stock goes negative  
**Fix:** `SELECT FOR UPDATE` on stock row inside `place-order` Edge Function — serialize concurrent orders

### Item 9 — FK Orphan Records
**Risk:** Deleting a parent record (if ever allowed) leaves child records without valid FK  
**Fix:** `ON DELETE RESTRICT` on all foreign keys — prevent parent deletion if children exist

### Item 10 — Session Switch Race
**Risk:** Two concurrent session switch requests could result in two sessions having `is_current = true`  
**Fix:** Atomic transaction: `UPDATE old SET is_current = false` + `UPDATE new SET is_current = true` in single transaction + force reload

### Item 11 — Coin Balance Mismatch
**Risk:** `profiles.grow_coins` (denormalized cache) could drift from `coin_transactions` ledger  
**Fix:** Monthly `pg_cron` job: `SUM(coin_transactions)` per student → compare → auto-correct `profiles.grow_coins`

### Item 12 — Biometric Double File
**Risk:** Same biometric file uploaded twice for same branch + date → duplicate attendance records  
**Fix:** Check `(branch_id, date)` in `processing_jobs` before processing — reject if already processed

### Item 13 — Storage Bucket RLS
**Risk:** Public storage buckets expose private files (profile images, receipts, attachments)  
**Fix:** All Supabase Storage buckets must be private with proper RLS policies

### Item 14 — IDOR in Edge Functions
**Risk:** Edge Functions may trust user-supplied IDs (student_id, school_id) without verifying the caller owns them  
**Fix:** Manually verify resource ownership in every Edge Function — do not rely on RLS alone (Edge Functions use Service Role Key which bypasses RLS)

### Item 15 — Voucher Race Condition
**Risk:** Student claims voucher from 2 devices simultaneously → both succeed → extra voucher generated  
**Fix:** `SELECT FOR UPDATE` on voucher claim — atomic deduction

### Item 16 — 3rd Device Login
**Risk:** User logs into 3rd device — security risk, also violates subscription model  
**Fix:** Check `device_tokens` array length at login — if 2 devices already, block with error: "Max 2 devices pe login allowed hai"

## Business Rules & Logic
- All 16 items must be resolved before launch
- Items 1, 2, 3, 4 are foundational — implement first
- Items 5, 8, 10, 15 are race conditions — require atomic DB transactions or `SELECT FOR UPDATE`
- Item 14 (IDOR) requires manual ownership checks in every Edge Function

## API / Integrations
- **Supabase Auth:** `auth.admin.signOut()` — items 1, credential change
- **pg_cron:** Item 11 — monthly coin balance verification
- **Edge Functions:** Items 2, 5, 8, 14, 15 — all privileged ops

## Open Questions / Missing Info
- Item 9 (FK ON DELETE RESTRICT): if no hard deletes ever happen, this is moot — but still important for accidental admin errors
- Item 11 (coin correction): what is the auto-correct logic? Overwrite `grow_coins` with ledger total? What if ledger shows MORE than profile (could indicate exploit)?
- IDOR check (item 14): what's the specific ownership verification pattern for each Edge Function? Not documented per function
- Are there additional security items not in this list (e.g. rate limiting, brute force protection on login)?
- Input sanitization / SQL injection prevention — not mentioned (Supabase's parameterized queries handle this, but worth noting)
