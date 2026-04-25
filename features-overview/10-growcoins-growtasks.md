# GrowCoins & GrowTasks System

## Overview
GrowCoins is GrowVibe's core differentiator. Students earn coins automatically via `pg_cron` for attendance, and manually via teacher recognition (GrowTasks). Coins are spent in the store for discounts or free products. Coins never expire and carry forward on session promotion. The coin ledger (`coin_transactions`) is the source of truth. Vouchers unlock at spend thresholds and are claimed atomically to prevent race conditions.

## User Roles & Access
- **Admin:** Manage GrowTask definitions and coin amounts
- **Incharge Teacher:** Submit weekly GrowTask recognitions (max 5 per category per week)
- **Student:** View balance, view progress, claim vouchers, use in store
- **Owner/Principal/Coordinator:** View student balances (via student profile)

## Core Functionality

### GrowCoins Earning
- Auto-awarded by `pg_cron` for weekly 100% attendance (effective days)
- Auto-awarded by `pg_cron` for monthly 90%+ attendance
- Awarded by incharge teacher via GrowTasks (3 categories: discipline, cleanliness, study)
- All awards recorded in `coin_transactions` ledger

### GrowTasks System
- 5 task types — 3 teacher-submitted, 2 auto (attendance)
- Teacher selects up to 5 students per category per weekly cycle
- Each category submits independently
- Once submitted for a cycle, that panel is locked
- `(student_id, grow_task_id, cycle_label) UNIQUE` — double award impossible at DB level
- Cycle label format: "Week of Jan 13-19"

### Voucher System
- **Basic Voucher:** Unlocks at 500 total coins spent — `floor(total_coins_spent / 500)` available
- **Premium Voucher:** Unlocks at 800 total coins spent — `floor(total_coins_spent / 800)` available
- Student manually claims voucher from GrowCoins screen
- Claim: atomic `SELECT FOR UPDATE` — race condition prevented
- Coins deducted IMMEDIATELY on claim (not on order)
- Claimed voucher used in store for free product
- Cancelled order: coins NOT refunded — voucher already spent
- Returned order: coins NOT refunded — final decision, no exceptions

## UI Screens & Components

### Screen: Teacher — GrowTasks Submit
**Visible To:** Incharge Teacher only

**Data Displayed:**
- 3 panels: Discipline, Cleanliness, Study
- Each panel: class students list with checkboxes
- Max 5 selection indicator per panel
- Current week cycle label: "Week of Jan 13-19"
- Already submitted panels: locked with "Submitted" badge

**User Actions:**
- Select up to 5 students per panel → Submit panel independently

**UX Flow:**
Teacher opens GrowTasks → sees 3 panels → selects students (max 5 each) → Submit each panel → selected students get coins credited → push notification sent to each awarded student

**Empty State:** "Abhi tak koi student nahi is class mein."

**Error States:**
- Select more than 5 → 6th checkbox disabled automatically
- Already submitted this cycle → panel shows "Already submitted for this week" + locked

**Edge Cases:**
- Each category submits independently — can submit 1, 2, or all 3 in any order
- Class has fewer than 5 students: max = available students
- `(student_id, grow_task_id, cycle_label) UNIQUE` — database-level double award prevention

---

### Screen: Student — GrowCoins Home (App)
**Visible To:** Student only

**Data Displayed:**
- Big coin balance (gamified — large number, animated)
- Weekly attendance progress: "Is hafte: 3/4 din present" + coins status
- Monthly attendance progress: "Is mahine: 18/20 din" + coins status
- Available vouchers section: Basic Voucher (X available) + Premium Voucher (X available)
- Progress to next voucher: "Next Basic Voucher ke liye X aur coins spend karo"
- Recent coin history: last 5 transactions (earn/spend)

**User Actions:**
- "Claim Basic Voucher" button (if available)
- "Claim Premium Voucher" button (if available)
- "Use in Store" button → goes to Store

**UX Flow:**
Student opens GrowCoins tab → sees big balance → if vouchers unlocked, claim buttons visible → tap Claim → confirmation → atomic deduction → voucher ready to use in store

**Empty State:** "Abhi tak koi coins nahi. School jaao aur coins kamao!"

**Error States:**
- Claim fail (race condition) → "Voucher claim karne mein masla hua. Dobara try karo."

**Edge Cases:**
- 2 devices: both show same balance (from `profiles.grow_coins`)
- Voucher claimed: disappears from "available", appears as "ready to use" in store
- Coins carry forward on session promotion

---

### Screen: Admin — GrowTasks Management
**Visible To:** Admin only

**Data Displayed:**
- 5 tasks list: name, category, `coins_reward`, cycle, `is_active`
- Edit `coins_reward` per task

**User Actions:**
- Edit coins amount per task (same for all schools)
- Activate/deactivate task

**UX Flow:**
Admin opens GrowTasks → sees 5 tasks → edits coins amounts → save → immediately effective for all schools

**Error States:**
- Coins amount 0 → "Coins reward 0 nahi ho sakta"

**Edge Cases:**
- Admin changes coins: future awards use new amount — past awards unaffected

## Data & Fields

### 5 Task Types
| Task | Category | Cycle | Max Selections | Who Awards |
|---|---|---|---|---|
| Discipline Improved | discipline | Weekly | 5 per class | Incharge Teacher |
| Cleanliness Improved | cleanliness | Weekly | 5 per class | Incharge Teacher |
| Study Improved | study | Weekly | 5 per class | Incharge Teacher |
| Weekly 100% Attendance | attendance_weekly | Weekly | All eligible | pg_cron auto |
| Monthly 90%+ Attendance | attendance_monthly | Monthly | All eligible | pg_cron auto |

### Voucher Thresholds
| Type | Unlock Threshold | Eligible Products | Formula |
|---|---|---|---|
| Basic Voucher | 500 total coins spent | `basic_voucher_eligible = true` | `floor(total_coins_spent / 500)` |
| Premium Voucher | 800 total coins spent | `premium_voucher_eligible = true` | `floor(total_coins_spent / 800)` |

### Key Fields
| Field | Description |
|---|---|
| grow_coins | Current balance — on `profiles` |
| total_coins_spent | Total lifetime coins spent — on `profiles` |
| coin_transactions | Ledger table — source of truth |
| cycle_label | Text — e.g. "Week of Jan 13-19" |
| `(student_id, grow_task_id, cycle_label)` | UNIQUE constraint — prevents double awards |

**Monthly Cron:** Verifies `grow_coins` balance vs. `coin_transactions` ledger total — auto-corrects if mismatch (security item #11)

## Business Rules & Logic
- Coin balance never expires — carries forward on session promotion
- `coin_transactions` is the source of truth — `profiles.grow_coins` is a denormalized cache
- Monthly cron auto-corrects if `profiles.grow_coins` diverges from ledger
- Teacher: max 5 students per category per week — enforced by disabled checkbox at 5
- Cycle label is the deduplication key — same `(student, task, cycle)` cannot be awarded twice
- Voucher claim: atomic `SELECT FOR UPDATE` prevents two simultaneous claims from race condition
- Coins deducted at **claim time** (not order time) for voucher
- Coins deducted at **order time** for coin discount
- Push notification on every coin credit
- Push notification when Basic Voucher threshold crossed (500 total spent)
- Push notification when Premium Voucher threshold crossed (800 total spent)

## API / Integrations
- **pg_cron:** 
  - Weekly Saturday 6:59 PM UTC: award weekly attendance coins
  - Monthly end of month: award monthly attendance coins
  - Monthly: verify coin balance vs. ledger (auto-correct)
- **Edge Function:** `award-coins` — handles coin credit + `coin_transactions` insert
- **Expo Push Notifications:** On coin award, voucher unlock

## Open Questions / Missing Info
- What is the exact `coins_reward` amount for each of the 5 tasks? Not specified in doc (Admin can edit, but no default shown)
- How are weekly attendance coins triggered — is the `pg_cron` job per-school or platform-wide?
- When Admin deactivates a task, do ongoing cycles get cancelled or just no new cycles?
- Can a teacher see which students have already received GrowTask coins this cycle before they select?
- Voucher "ready to use in store" — how is it surfaced in the store? Auto-applied or manual selection?
- What happens to unclaimed vouchers if student is deactivated?
- `cycle_label` format for monthly tasks ("Week of..." makes sense for weekly — what's the monthly label format?)
- Is there a leaderboard based on GrowCoins? (There is a leaderboard feature but it appears to be teacher-managed scores, not coins-based)
