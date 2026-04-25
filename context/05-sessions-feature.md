# 05 — Sessions Feature

## What was built
Session management for owner role: create/edit sessions per branch, horizontal branch+session pill selector on the owner Home screen, and Redux global state for the selected branch/session context.

## Migration applied
| File | What it does |
|------|-------------|
| `20260415120000_create_sessions.sql` | Creates `sessions` table with `school_id`, `branch_id`, `session_name`, `session_start`, `session_end`, `is_active`; partial unique index enforcing one active session per branch; RLS for admin (full) and owner (own school only) |

## App files created/changed
- `store/appSlice.js` — new Redux slice: `selectedBranchId`, `selectedSessionId`; actions: `setSelectedBranch` (clears session), `setSelectedSession`, `clearAppContext`
- `store/index.js` — added `app: appReducer`
- `hooks/useSessionForm.js` — create/edit hook; handles deactivating the previously active session before activating a new one
- `app/screens/session/sessionForm.jsx` — create/edit form with date inputs (YYYY-MM-DD), status toggle, info banner explaining auto-deactivation
- `components/BranchSessionSelector.jsx` — two horizontal pill rows: branches (top) + sessions (bottom); auto-selects first branch + active/first session on mount; dispatches to Redux; shows "Create Session" CTA when branch has no sessions; edit (pencil) + add (+) icon buttons when sessions exist
- `app/(tabs)/home.jsx` — renders `<BranchSessionSelector />` between TopBar and ScrollView for `owner` role only

## Key decisions

### One active session per branch — enforced two ways
1. DB: `partial unique index` on `(branch_id) where is_active = true` — prevents two active sessions at the DB level
2. App: `useSessionForm.save()` explicitly deactivates the previous active session before setting the new one, to avoid hitting the unique constraint

### `is_active` not `session_status` enum
User confirmed boolean is sufficient — only one active at a time per branch. Avoids enum migration complexity and keeps queries simple (`eq('is_active', true)`).

### school_id denormalised on sessions
Per CLAUDE.md rule — `school_id` carried directly even though it's reachable via `branch_id → branches.school_id`. Enables direct RLS and `eq('school_id', ...)` queries.

### appSlice for global context
Branch/session selection is UI-scoped context (not auth). A separate `appSlice` keeps it clean and lets future screens `useSelector((s) => s.app.selectedBranchId)` without touching authSlice.

### setSelectedBranch clears session
When the user taps a different branch pill, `selectedSessionId` is reset to `null` immediately so no stale session from the previous branch leaks into downstream screens.

### Session pill colour = purple
Branch pills use primary blue; session pills use purple (`Colors.purple` / `Colors.purpleLight`) to visually distinguish the two levels.

### Auto-select on mount
`BranchSessionSelector` fetches branches once on mount, picks the first, then fetches that branch's sessions and picks the `is_active` one (or first if none is active). Both IDs are dispatched to Redux before the user interacts.

### Date input as plain text (YYYY-MM-DD)
No date-picker library added — plain `Input` with `keyboardType="numeric"` and Yup regex + cross-field validation. Keeps zero new dependencies. A native date picker can be swapped in later.

## Gotchas
- `BranchSessionSelector` only mounts for `role === 'owner'` in home.jsx — other roles never trigger branch/session fetches.
- After creating or editing a session via `sessionForm`, the selector does NOT auto-refresh — user must navigate back to Home; the selector refetches on the next mount cycle. A `useFocusEffect` refresh can be added later.
- The partial unique index means the DB will reject a second `is_active = true` row for the same branch if the app-layer deactivation step somehow fails — safe by design.
