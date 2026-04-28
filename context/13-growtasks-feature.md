# 13 — GrowTasks & GrowCoins Feature

## What Was Built

A coin-reward system where teachers award GrowCoins to top-performing students weekly across three categories (Discipline, Cleanliness, Study). Attendance coins are auto-awarded by DB cron jobs. Admin can configure coin amounts per task. Students accumulate `grow_coins` on their profile.

---

## Database (Migrations Applied)

### `20260421100000_coin_tables.sql`
- `grow_tasks` table — seed rows for 5 task types: `attendance_weekly`, `attendance_monthly`, `discipline`, `cleanliness`, `study`
  - Columns: `id, category, coins_reward, is_active, description`
- `coin_transactions` table — immutable log of every coin award
  - Columns: `id, school_id, branch_id, student_id, task_id, category, coins, cycle_label, awarded_by, created_at`
  - Unique: `(student_id, task_id, cycle_label)` — one award per student per task per cycle
- `grow_tasks_submissions` table — tracks which teacher-cycle-category combos have been submitted
  - Columns: `id, teacher_id, class_id, category, cycle_label, created_at`
  - Unique: `(teacher_id, class_id, category, cycle_label)`

### `20260421110000_coin_cron_jobs.sql` + `20260421120000_coin_cron_schedule.sql`
- DB cron jobs (pg_cron) auto-award attendance coins:
  - Weekly attendance: every Monday — checks last 7 days, awards if ≥80% present
  - Monthly attendance: 1st of each month — checks prior month, awards if ≥80% present
- Cron updates `profiles.grow_coins` directly via SQL aggregation

### `20260421130000_growtask_submit_rpc_grant.sql`
- RPC `submit_growtask(p_class_id, p_category, p_cycle_label, p_student_ids jsonb, p_coins_reward, p_school_id, p_branch_id)` — SECURITY DEFINER
  - Inserts into `coin_transactions` (ignores conflicts — idempotent)
  - Inserts into `grow_tasks_submissions`
  - Updates `profiles.grow_coins` for each awarded student

### `20260421140000_award_coins_awarded_by.sql`
- Adds `awarded_by uuid` column to `coin_transactions` (who submitted the award)

### `20260421160000_growtask_submissions_teacher_read.sql`
- Teacher SELECT policy on `grow_tasks_submissions` — own rows only

### `20260426120000_grow_tasks_admin_rls.sql`
- Admin full access on `grow_tasks` (read + update coins_reward, is_active)

---

## Web

### `GrowTasksPage.jsx` (Teacher)
Route: `/growtasks` — teacher role only

- Three panels: Discipline, Cleanliness, Study (each an accordion/card)
- Loads student list from teacher's `class_id` + current `grow_tasks` rows
- Checks `grow_tasks_submissions` for current ISO week cycle — already-submitted panels show locked badge
- Teacher selects up to `MAX_SELECT = 5` students per panel via checkbox
- Submit calls `submit_growtask` RPC, fires push notifications to awarded students
- After submit: panel locks, shows "submitted" state
- Cycle label format: `YYYY-WNN` (ISO week number)
- Week range label format: `Week of Apr 14–20`

### `GrowTasksAdminPage.jsx` (Admin)
Route: `/growtasks-admin` — admin role only

- Lists all 5 task types as cards with `CATEGORY_META` labels, cycle type, coin amount
- Admin can edit `coins_reward` and toggle `is_active` via slide-over
- No create/delete — tasks are seeded at DB level, admin only configures values
- Skeleton cards while loading

---

## App — `growTaskSubmit.jsx` (Teacher)

Route: `app/screens/growtask/growTaskSubmit.jsx`

- Same three-panel UI as web version
- Loads students from `profile.class_id`
- Same MAX_SELECT = 5 guard
- Calls `submit_growtask` RPC on submit
- Fires `sendPush` to awarded students: title "GrowCoins Awarded 🏆", body "You earned {coins} coins for {category}!"
- Panel locks after submission with trophy icon

---

## Home Screen (Student)

`StudentGrowCoinsCard` in `home.jsx`:
- Reads `profile.grow_coins` directly from Redux — no extra query
- Shows trophy icon + coin balance
- Only rendered for `role === 'student'`

---

## Attendance Coins (Auto)

Awarded by pg_cron — no UI involved:
- Weekly: `attendance_weekly` task — if student ≥ 80% present in last 7 days
- Monthly: `attendance_monthly` task — if student ≥ 80% present in prior month
- Coin amounts from `grow_tasks.coins_reward` — configurable by admin

---

## Key Decisions

1. **Cycle label as deduplication key** — `(student_id, task_id, cycle_label)` unique constraint prevents double-awarding without needing explicit lock logic.
2. **SECURITY DEFINER RPC** — teachers have no direct INSERT on `coin_transactions`. The RPC runs as the table owner, bypassing RLS for the award operation while still validating input.
3. **`grow_coins` denormalized on profiles** — avoids a SUM query on every leaderboard/dashboard fetch. Cron + RPC keep it in sync.
4. **MAX_SELECT = 5** — enforced on frontend only. Prevents inflation but not a hard DB constraint.
5. **Push on award** — fire-and-forget; awarded students get notified immediately.

---

## Gotchas

- Teacher must have `class_id` set on their profile — without it, the GrowTasks page shows an empty state and no students load.
- Cron jobs require `pg_cron` extension enabled in Supabase. If coins stop auto-awarding, check the cron schedule in `supabase/migrations/20260421120000_coin_cron_schedule.sql`.
- `grow_tasks` rows are seeded — if they are missing (e.g., fresh DB), the teacher page shows no panels and cannot submit.
