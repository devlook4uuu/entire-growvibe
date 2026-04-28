# 20 — Owners Feature

## What Was Built

Admin-managed owner accounts. Each owner is linked to one school. Admin creates, edits, and deactivates owners. Owner accounts are created via the `create-user` Edge Function.

---

## Database

Owners are stored in the `profiles` table with `role = 'owner'`. No separate owners table.

Key columns:
- `role = 'owner'`
- `school_id` — the school this owner manages
- `is_active` — soft deactivation
- `avatar_url` — optional profile photo
- `phone`, `email`, `name`

### Views (Migrations)

### `20260413000004_create_owners_with_school_view.sql`
- View: `owners_with_school` — joins `profiles` (role=owner) + `schools` (school name, is_active)
- Used by web OwnersPage to show school name alongside owner info

### `20260414000003_create_available_owners_view.sql`
- View: `available_owners` — owners who are active but NOT yet assigned to a school
- Used by SchoolsPage when assigning an owner to a school

### `20260414000005_create_assign_school_owner_rpc.sql`
- RPC `assign_school_owner(p_school_id, p_owner_id)` — sets `schools.owner_id = p_owner_id` and `profiles.school_id = p_school_id` atomically

---

## Web — `OwnersPage.jsx`

Route: `/owners` — admin only

- Lists all owners via `owners_with_school` view (shows school name)
- Cache keyed by query, TTL 30s, `PAGE_SIZE = 12`
- Add via slide-over: name, email, password, phone, `is_active` toggle
  - Calls `create-user` Edge Function with `role: 'owner'`
- Edit: same slide-over (no password field on edit — separate credentials reset flow)
- Toggle `is_active` — soft deactivation
- Avatar: initials fallback

### `invalidateOwnerCache()`
Exported — called after any create/edit/deactivate.

---

## App — `ownerList.jsx` + `ownerForm.jsx`

Hook: `hooks/useOwnerList.js` — reference implementation for all list hooks

### `ownerList.jsx`
- Lists all owners (admin only)
- Search, pull-to-refresh, Load More
- Card shows: avatar, name, email, phone, school name, status pill
- Edit FAB → `ownerForm` in edit mode

### `ownerForm.jsx`
- Create and edit owner
- Email + password fields on create only
- `is_active` toggle on edit

---

## Key Decisions

1. **`owners_with_school` view** — avoids a join in the list query. View is queried directly; school name comes along for free.
2. **`available_owners` view** — used in school assignment flow so admin can only pick unassigned owners.
3. **No separate owners table** — owners are profiles. Role-based filtering (`role = 'owner'`) is sufficient. Reduces schema complexity.
4. **`useOwnerList.js` as reference implementation** — all other list hooks follow its exact pattern (cache, refs, fetchPage modes, pagination). See CLAUDE.md List Screen Rules.

---

## Gotchas

- Deleting or deactivating an owner while they are the `school.owner_id` leaves the school without an owner. UI should warn before deactivating a linked owner.
- The `assign_school_owner` RPC is used from SchoolsPage, not OwnersPage. OwnersPage only creates/edits owner profiles.
- `available_owners` excludes owners who already have `school_id` set — if an owner is moved between schools, their old `school_id` must be cleared first.
