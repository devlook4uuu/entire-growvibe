# 21 — Dashboards Feature

## What Was Built

Six role-based web dashboards (Admin, Owner, Principal, Coordinator, Teacher, Student) and a unified role-based home screen for the app. All dashboards show real data from Supabase — no hardcoded/mock values.

---

## Shared Infrastructure — `AdminDashboard.jsx`

All dashboards import from `AdminDashboard.jsx`. It exports:
- `C` — design tokens (colors, backgrounds)
- `fmtPKR(n)` — formats number as "PKR 1,234"
- `cap(s)` — capitalizes first letter
- `useBreakpoint()` — returns current breakpoint string (`xs | sm | md | lg | xl | 2xl`)
- `Card`, `CardHeader`, `StatCard`, `StatsGrid`, `TwoColGrid`, `SingleCol`, `PageHeader` — layout components
- `Badge`, `ActionBtn` — UI primitives
- `STATUS_COLORS` — status color map

`StatCard` accepts a `loading` prop — shows skeleton divs instead of values while loading.

---

## Web Dashboards

### Admin Dashboard
Real data:
- Total schools, active schools count
- Total active students (all schools)
- Open support tickets count
- School list with per-school student count (parallel Promise.all)
- Recent open support tickets (limit 8)

Components: `SupportTicketsCard`, `SchoolsStatusCard`

### Owner Dashboard
Real data (school-scoped):
- Active students, active staff (principal+coordinator+teacher), today's attendance %, fees collected this month, unpaid count
- Per-branch attendance table (today)
- Per-branch fee collection progress bar (this month)
- Unmarked classes alert banner

Components: `BranchAttendanceCard`, `FeeProgressCard`
Includes: `BranchSessionSelector` (to select active branch/session for management screens)

### Principal Dashboard
Real data (branch-scoped):
- Branch students count, classes count, today's attendance %, unmarked class count, fees collected, unpaid, top GrowCoins holder
- Per-class attendance table (teacher name, present/total, marked/missing status)
- GrowCoins leaderboard (top 5 students)
- Lowest attendance rate classes this week (progress bars)
- Unmarked classes alert banner

Components: `ClassAttendanceCard`, `GrowCoinsCard`, `WeakClassesCard`

### Coordinator Dashboard
Real data (branch-scoped):
- Today's attendance %, unpaid fees count + amount, chronically absent students (3+ consecutive absences)
- Per-class attendance table (same as principal)
- Unpaid fees grouped by class (this month)
- Students with 3+ consecutive absences (7-day window, streak detection)

Streak detection logic:
```js
const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
let streak = 0;
for (const r of sorted) {
  if (r.status === 'absent') streak++; else break;
}
if (streak >= 3) // flag as chronically absent
```

Components: `ClassAttendanceCard`, `UnpaidFeesCard`, `AbsentStudentsCard`

### Teacher Dashboard
Real data (class-scoped):
- Class students count, today's attendance %, GrowTasks submitted this week vs total active, chat unread count
- Self-attendance widget (mark own attendance for today)
- Absent students today list
- GrowTasks card (navigates to /growtasks)
- Diary card (today's entries; "Post Today's Diary" if none)

Chat unread: `chat_members.last_read_at` vs `chat_messages.created_at` for the class chat.

Components: `TeacherAttendanceWidget`, `AbsentStudentsCard`, `GrowTasksCard`, `DiaryCard`

### Student Dashboard
Minimal — profile display only. Real stats planned for future.

---

## App Home Screen (`home.jsx`)

Role-based sections, all data real:

| Role | Stats shown | Widgets |
|------|-------------|---------|
| Admin | Total schools, total owners | Management shortcuts |
| Owner | Branches, students, staff, revenue (all time) | BranchSessionSelector, management sections |
| Principal | Classes, students, teachers, today's attendance % | Management shortcuts |
| Coordinator | Classes, students | Management shortcuts |
| Teacher | — | TeacherSelfAttendanceWidget (mark + view today), management shortcuts |
| Student | — | StudentAttendanceWidget (today's status + history), Coin Progress widget, Diary card, GrowCoins balance card |

### Stats loading states
- `stats === null` → skeleton grid (correct skeleton count per role)
- `stats === []` → nothing (no stats for this role)
- `stats.length > 0` → StatCard grid

### Student-specific widgets (all in order at bottom of student block)
1. `StudentAttendanceWidget` — today's status chip or "Not Marked"
2. `StudentProgressSection` → `AttendanceProgressWidget` — weekly/monthly attendance progress bars + coin motivation text
3. `StudentDiaryCard` — active diary entry count, tap to view list
4. `StudentGrowCoinsCard` — trophy icon + coin balance from `profile.grow_coins`

---

## Key Decisions

1. **Separate `useEffect` per data concern** — each dashboard widget loads independently. One failing query doesn't block others.
2. **`null` = loading, `[]` = empty** — consistent pattern across all dashboard state variables.
3. **No shared dashboard state** — each role's dashboard is a standalone component. No prop drilling or shared context.
4. **App home: no UI changes rule** — only real data replaces hardcoded values; new sections added only at the bottom.
5. **`SkeletonRows` and `EmptyMsg` defined once per file** — duplicate definitions caused crashes; removed duplicate copies at end of files.

---

## Gotchas

- `SkeletonRows` and `EmptyMsg` were duplicated in `OwnerDashboard.jsx` and `PrincipalDashboard.jsx` — caused duplicate function declaration crashes. Fixed by removing the bottom duplicates.
- `AdminDashboard.jsx` is both a functional dashboard AND the shared design system exporter. Never remove or rename its exports.
- `useBreakpoint()` uses `window.innerWidth` with a resize listener — ensure it's only used in web components, never in React Native.
- Coordinator streak detection reads the last 7 days of attendance sorted descending. It breaks on the first non-absent day, so a student who was present yesterday resets to 0 even if they have many prior absences.
