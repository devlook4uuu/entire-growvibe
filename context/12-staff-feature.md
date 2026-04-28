# 12 — Staff Feature

## What Was Built

Full staff management for principal, coordinator, and teacher roles. A single page/screen handles all three staff types, with role-specific rules (principal and coordinator are one-per-branch; teachers are many-per-branch).

---

## Database

Staff records live in the `profiles` table (same as students and owners). No separate staff table.

Key columns used:
- `role` — `'principal' | 'coordinator' | 'teacher'`
- `branch_id` — links staff to their branch
- `school_id` — direct school scope (CLAUDE.md rule)
- `class_id` — for teachers: their assigned class
- `is_active` — soft deactivation
- `device_tokens` — push notification tokens (jsonb array)

Staff are created via the `create-user` Edge Function (same as owners/students).

---

## Web — `StaffPage.jsx`

Route: `/staff?role=principal | coordinator | teacher`

- Single page handles all three role types via URL search param
- `ROLE_META` map drives label, singular name, subtitle, `singleOnly` flag
- `singleOnly: true` for principal/coordinator — Add button hidden when one already exists in the branch
- Cache keyed by `${role}|${branchId}|${query}`, TTL 30s
- `PAGE_SIZE = 12`
- Slide-over form: name, email, phone, is_active toggle
- For teachers: additional `class_id` dropdown (classes in the branch, unassigned only)
- Avatar: initials fallback if no photo
- Teacher cards show an "Attendance" button → navigates to `/teacher-attendance?teacherId=…`
- Branch-scoped via Redux `selectedBranchId`

### `invalidateStaffPageCache(role, branchId)`
Exported — called from other pages after creating staff from a different entry point.

---

## App — `staffList.jsx` + `staffForm.jsx`

Hook: `hooks/useStaffList.js`

- Route params: `role`, `branchId`, `schoolId`, `branchName`
- Same `singleOnly` logic: Add FAB hidden when one exists for principal/coordinator
- Teacher cards show an "Attendance" action button → `teacherAttendanceHistory` with `canEdit: 'true'`
- `staffForm.jsx`: create and edit staff; teacher form includes class picker

---

## Key Decisions

1. **Shared `profiles` table** — staff and students both live in `profiles`, differentiated by `role`. No joins needed for basic profile info.
2. **One principal / coordinator per branch** — enforced on frontend only (Add button hidden); not a DB constraint to avoid breaking edge cases.
3. **Teacher-class binding** — teacher's `class_id` set at creation or update. Affects attendance RLS (teacher can only mark attendance for their class).
4. **No hard deletes** — `is_active = false` soft-deactivates. Deactivated staff still appear in historical records.

---

## Gotchas

- Owners do not have a `branch_id` — the branch is selected from Redux `selectedBranchId`. Always pass `branchId` as a param or read from Redux, never assume `profile.branch_id` when in an owner context.
- When a teacher is assigned a class, the class's `teacher_id` must also be updated in the `classes` table. Failure to do this breaks the teacher's home screen attendance widget.
- `invalidateStaffPageCache` must be called after any operation that changes staff count (create, deactivate) to avoid stale "Add" button state.
