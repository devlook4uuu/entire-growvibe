# 04 — Branches Feature

## What was built
Branch management per school: list screen (scoped to one school), create/edit form with off-days picker, off-days table, and a view joining branches with their off-days.

## Migrations applied (in order)
| File | What it does |
|------|-------------|
| `20260414000008_create_branch_off_days.sql` | Creates `branch_off_days` table with `branch_id` FK + `day_of_week` check constraint + RLS policies |
| `20260414000009_create_branches_with_off_days_view.sql` | View: `branches_with_off_days` — branches + `off_days` as a sorted JSON array |
| `20260414000010_branches_rls_insert_update.sql` | Adds admin insert/update policies to `branches`; fixes select policy to allow admins to see all branches |

## App files created/changed
- `hooks/useBranchList.js` — list hook scoped to a `schoolId`; cache key is `"<schoolId>|<query>"`
- `hooks/useBranchForm.js` — form hook; exports `ALL_DAYS` and `OFF_DAY_PRESETS` constants used by the picker
- `app/screens/school/branchList.jsx` — branch list screen; receives `schoolId` + `schoolName` as route params
- `app/screens/school/branchForm.jsx` — create/edit form with off-days picker
- `app/screens/school/schoolList.jsx` — wired `handleBranches` navigation; added "Branches" label to card button

## Key decisions

### branch_off_days table design
Weekly off days are stored as individual rows (one per day per branch) with a `unique(branch_id, day_of_week)` constraint. This makes querying and diffing easy. The view aggregates them back into a sorted JSON array (`off_days`).

### Off-days picker UI
- 3 preset buttons: "Fri – Sun", "Sat – Sun", "Sun only" — covers the most common Pakistani school schedules
- 7 individual day chip toggles for custom combinations
- "Clear" button appears only when days are selected
- Summary text shows the full selected day names

### Off-days save strategy (edit mode)
Delete all existing rows for the branch then re-insert. Simple and avoids diffing logic. Safe because `branch_off_days` has `on delete cascade` from branches.

### Cache key includes schoolId
`useBranchList` cache key is `"<schoolId>|<query>"` so multiple schools' branch lists can be cached independently without collision.

### invalidateSchoolCache on branch save
Saving a branch changes `branch_subscription_fee`, which affects `total_subscription_fee` in `schools_with_details`. Both caches are invalidated on every branch save.

### schoolName passed as route param
The branch list and form headers show the school name as a subtitle. It's passed as a route param from the school card to avoid an extra fetch.

## Gotchas
- `branch_off_days` RLS uses `branch_id in (select id from branches where school_id = ...)` for member-level select — this requires branches RLS to also allow the same user select, which is now split into admin/member policies.
- The `off_days` field from the view is a JSON array — always parse with `Array.isArray()` guard before use.
- `branch_subscription_fee` in Formik is stored as a string (text input) and converted to `Number()` before saving.
