# 03 — School Feature

## What was built
Full school management: list screen, create/edit form, owner assignment, and views for the school picker dropdown.

## Migrations applied (in order)
| File | What it does |
|------|-------------|
| `20260414000001_alter_schools_add_fields.sql` | Adds `school_address text`, `school_contact text` to `schools` |
| `20260414000002_alter_branches_add_fields.sql` | Adds `branch_address text`, `branch_contact text`, `branch_subscription_fee numeric(10,2) default 0` to `branches` |
| `20260414000003_create_available_owners_view.sql` | View: `available_owners` — profiles where `role='owner'` AND `school_id IS NULL` |
| `20260414000004_create_schools_with_details_view.sql` | View: `schools_with_details` — schools + owner name/email/avatar + active branch count + total active subscription fee |
| `20260414000005_create_assign_school_owner_rpc.sql` | RPC: `assign_school_owner(p_school_id, p_new_owner_id, p_old_owner_id)` — atomic owner swap |

## App files changed/created
- `hooks/useSchoolList.js` — list hook (pagination, search, cache)
- `hooks/useSchoolForm.js` — form hook (loads school + available owners, handles save + RPC call)
- `app/screens/school/schoolList.jsx` — list screen
- `app/screens/school/schoolForm.jsx` — create/edit form with owner picker modal

## Key decisions

### Atomic owner swap via RPC
Changing a school's owner requires 3 DB writes (clear old owner's `school_id`, set new owner's `school_id`, update `school.owner_id`). These are wrapped in `assign_school_owner` Postgres function (`security definer`) so they run as a single transaction. Called from `useSchoolForm.save()` whenever `selectedOwnerId !== oldOwnerId`.

### Owner picker dropdown
- Built as a bottom-sheet Modal (not a native Select)
- Shows "No Owner" option first (to allow unassigning)
- In edit mode: current owner is prepended to the available_owners list so they remain selectable even though they are assigned
- In create mode: only unassigned owners (from `available_owners` view)
- Includes search inside the modal

### `available_owners` view
Only shows owners with `school_id IS NULL`. The `schools` table has a unique index on `owner_id` so one owner → one school is enforced at DB level.

### Total subscription fee
Computed in the view as `SUM(branch_subscription_fee) FILTER (WHERE is_active = true)`. Shown in the school card only when `active_branch_count > 0`.

### "View Branches" button
Button is present on the card but navigation is a `// TODO` — branch list screen not built yet.

## Gotchas
- `selectedOwnerId` in the form starts as `undefined` (not `null`) to distinguish "not yet initialised" from "intentionally no owner". Once the school loads in edit mode or on first render in create mode it's set to either `school.owner_id` or `null`.
- Both `invalidateSchoolCache()` and `invalidateOwnerCache()` are called after every save, because assigning/removing an owner changes both the school list (owner_name column) and the owner list (school_name column).
