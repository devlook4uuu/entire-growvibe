# Build Order & Development Phases

## Overview
GrowVibe is planned to be built in 8 phases over approximately 20 weeks. Phases 1-6 cover the web platform. Phase 7 is the Expo mobile app. Phase 8 is the security audit. The order follows a dependency-first approach: foundation → school structure → daily operations → academic features → chat → GrowVibe ecosystem → mobile → security.

## User Roles & Access
- **Admin (Abdullah):** Drives all decisions and is the primary user tested against in phases 1-2

## Build Phases

---

### Phase 1 — Foundation (Week 1-2)
Core infrastructure, auth, and layout.

| Task |
|---|
| Supabase project setup + `profiles` table + RLS |
| Auth trigger: auto-create profile on auth.users insert |
| Custom JWT Hook: embed `role + school_id + branch_id + class_id` |
| `schools + branches` tables + RLS |
| `create-user` Edge Function + `update-credentials` Edge Function |
| Vite + React + Tailwind + shadcn + Redux Toolkit setup |
| Login screen + role-based redirect |
| `ProtectedRoute` + role guards + isActive middleware |
| Sidebar + role-based navigation |

---

### Phase 2 — School Structure (Week 3-4)
School hierarchy, sessions, classes, staff.

| Task |
|---|
| `sessions` table + inactive=read-only policy (fees exception) |
| `classes` table + `create-class` Edge Function (atomic) |
| Staff CRUD — all roles |
| Student promotion flow |
| Admin: schools + owners + branches screens |
| Owner: sessions + classes + staff screens |

---

### Phase 3 — Daily Operations (Week 5-7)
Attendance, fees, timetables, diary, biometric, push notifications.

| Task |
|---|
| `attendance` table (`DATE` type — not timestamptz!) + manual attendance |
| `holidays` table |
| Biometric: `processing_jobs` + Edge Function |
| Expo Push setup + `send-push` Edge Function (chunked 20) |
| `fees` table + Fee CRUD + `generate-fee-receipt` |
| `timetables` table + teacher clash check |
| `diaries` table + Teacher screens |
| `pg_cron`: `process-pending-jobs` (every 1 minute) |

---

### Phase 4 — Academic (Week 8-9)
Results, exams, applications, support tickets, online classes.

| Task |
|---|
| `results` + `generate-result-pdf` |
| `datesheets` + `exams` + `leaderboards` |
| `applications` table + flow + notifications |
| `support_tickets` + reply |
| `online_classes` table + join button logic |
| `pg_cron`: 30-minute class reminder |

---

### Phase 5 — Chat (Week 10-11)
Real-time group chat with reconnect logic.

| Task |
|---|
| `messages` table + `(chat_id, created_at)` index |
| Supabase Realtime subscribe |
| `last_seen_at` reconnect logic |
| File messages (images, documents, voice) |
| Message reactions |
| Chat member management |
| Offline push notifications |

---

### Phase 6 — GrowVibe Ecosystem (Week 12-14)
The core differentiator — coins, tasks, store, orders, delivery.

| Task |
|---|
| `grow_tasks` + `grow_task_submissions` (UNIQUE constraint CRITICAL) |
| `coin_transactions` + `award-coins` Edge Function |
| Teacher GrowTasks submit screen |
| `pg_cron`: weekly (Saturday 6:59 PM UTC) + monthly coins |
| Effective days calculation |
| `vouchers` table + claim (`SELECT FOR UPDATE`) |
| `products` table + `place-order` Edge Function (`FOR UPDATE`) |
| `orders` table + `close-delivery-week` Edge Function |
| Store screens + complete purchase flow |

---

### Phase 7 — Expo App (Week 15-18)
Mobile app for students (and teacher mobile views).

| Task |
|---|
| Expo project + Expo Router + 5 bottom tabs (Home, Classes, Chat, Store, Profile) |
| Redux + RTK Query (reuse from web where possible) |
| Expo Push: token save + `DeviceNotRegistered` handle + 2 device limit |
| Auth flow + role-based redirect |
| All web features mirrored — mobile-optimized UX |
| GrowCoins hero screen — gamified (large animated balance) |

---

### Phase 8 — Security Audit (Week 19-20)
Pre-launch security verification.

| Task |
|---|
| RLS audit — every table green check |
| Storage bucket RLS audit |
| FK `ON DELETE RESTRICT` verify |
| Monthly coin balance cron — verify + auto-correct |
| Error handling + loading states — all screens |
| 2 device limit enforcement test |
| Voucher race condition test |

---

## Timeline Summary

| Phase | Focus | Weeks |
|---|---|---|
| 1 | Foundation | 1-2 |
| 2 | School Structure | 3-4 |
| 3 | Daily Operations | 5-7 |
| 4 | Academic Features | 8-9 |
| 5 | Chat | 10-11 |
| 6 | GrowVibe Ecosystem | 12-14 |
| 7 | Expo Mobile App | 15-18 |
| 8 | Security Audit | 19-20 |
| **Total** | | **~20 weeks** |

## Critical Path Notes
- Phase 1 must be solid before anything else — auth bugs propagate everywhere
- `attendance.date` must be `DATE` not `timestamptz` — set from day 1 (Phase 3)
- `grow_task_submissions` UNIQUE constraint must be in place before any coin awards (Phase 6)
- `SELECT FOR UPDATE` patterns must be implemented before store goes live (Phase 6)
- RLS must be enabled on every table as it's created — not left for Phase 8

## Open Questions / Missing Info
- Week estimates appear aggressive — no buffer weeks for bugs/rework
- Phase 7 reuses "Redux + RTK Query from web where possible" — but the web uses `Redux Toolkit` — RTK Query may need to be added to web first
- Notes/Announcements feature not explicitly mentioned in any build phase
- Biometric integration (`pg_cron` retry for failed jobs) — timing not specified
- School_payments / SaaS billing — no phase allocated for it
- Admin GrowTasks management screen — not in any phase explicitly
- `banners` table — no phase allocated
- `holidays` management screen — no phase allocated
