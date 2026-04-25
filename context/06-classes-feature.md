# 06 — Classes Feature

## What was built
Class management per session: create/edit classes scoped to a session+branch+school, atomic group chat creation on class create, incharge teacher assignment with automatic chat membership, and teacher swap on edit.

## Migration applied
| File | What it does |
|------|-------------|
| `20260416120000_create_classes_chats.sql` | Creates `classes`, `chats`, `chat_members` tables; `available_teachers` view; `classes_with_teacher` view; `create_class` RPC; `update_class_teacher` RPC; RLS for all three tables |

## App files created/changed
- `hooks/useClassList.js` — session-scoped list hook; queries `classes_with_teacher` view
- `hooks/useClassForm.js` — create/edit hook; calls `create_class` RPC on create, `update_class_teacher` RPC on teacher change; loads `available_teachers` view for picker
- `app/screens/class/classList.jsx` — class list screen; shows teacher badge in card footer
- `app/screens/class/classForm.jsx` — create/edit form with class name input + teacher picker bottom-sheet modal
- `app/screens/session/sessionList.jsx` — added "Classes" button to each session card footer; navigates to `classList` with `sessionId`, `sessionName`, `branchId`, `branchName`, `schoolId`
- `hooks/useStaffList.js` — teacher role now joins `classes(class_name)` via FK for display
- `app/screens/staff/staffList.jsx` — teacher card shows actual class name from `item.classes?.class_name`

## Key decisions

### Atomic create via RPC
Three writes happen in one Postgres transaction on class create:
1. `INSERT INTO classes`
2. `INSERT INTO chats` (group chat named `"<ClassName> Chat"`)
3. `INSERT INTO chat_members` (incharge teacher as first member)
4. `UPDATE profiles SET class_id = <class_id>` (teacher profile update)

This uses a `SECURITY DEFINER` function `create_class` — same pattern as `assign_school_owner`.

### Atomic teacher swap via RPC
`update_class_teacher(p_class_id, p_new_teacher_id, p_old_teacher_id)` handles:
- Remove `class_id` from old teacher's profile
- Remove old teacher from `chat_members`
- Set `class_id` on new teacher's profile
- Add new teacher to `chat_members` (with `ON CONFLICT DO NOTHING`)
- Update `classes.teacher_id`

All in one transaction. Called only when teacher actually changed in edit mode.

### "No Teacher" option
Passing `p_teacher_id = null` to `create_class` skips steps 3 & 4 — class and chat are still created without a member. In edit mode, selecting "No Teacher" calls `update_class_teacher` with `p_new_teacher_id = null`, which only removes the old teacher.

### `available_teachers` view
Filters `profiles` to `role='teacher' AND is_active=true AND class_id IS NULL` (unassigned teachers in the branch). In edit mode, the current teacher is prepended manually from `profiles` since they have `class_id` set and would not appear in the view.

### `classes_with_teacher` view
Joins `classes` + `profiles` (teacher) + `chats` so every query returns `teacher_name`, `teacher_avatar`, and `chat_id` without extra round-trips. Used by both `useClassList` and `useClassForm`.

### Teacher class name in staffList
`useStaffList` for `role='teacher'` selects `classes(class_name)` via PostgREST FK join (`profiles.class_id → classes.id`). PostgREST returns it as an object `{ class_name: "..." }` for a to-one relation — accessed as `item.classes?.class_name` in the UI. Falls back to "Class assigned" if `class_id` is set but join returns null.

### No `is_active` on classes
Classes have no active/inactive status — unlike sessions there is no need to track this. The `classes` table only has `class_name`, `teacher_id`, and the scoping FKs.

### Teacher picker pattern
The app picker matches the `schoolForm` `OwnerPicker` exactly: tappable trigger row (Avatar + name + email + chevron) opens a bottom-sheet Modal with a search `TextInput` and a `FlatList`. "No Teacher" is always the first option.

### Students button on class card
Each class card in `classList.jsx` has a purple "Students" button that navigates to `staffList` with `role='student'` and the `classId` as a param (for future scoping).

### Web version
`ClassesPage.jsx` follows the `SessionsPage`/`StaffPage` pattern exactly:
- `usePageList` hook querying `classes_with_teacher` view
- `SlideOver` for create/edit form
- Custom `TeacherPicker` dropdown (trigger + absolute dropdown list with search) — no external library
- Same `create_class` / `update_class_teacher` RPC calls as the app
- Guards: shows message if no branch or no session is selected in Redux
- `/classes` route wired in `App.jsx`

### school_id denormalised on chats and chat_members
Per CLAUDE.md rule — both tables carry `school_id` directly for RLS and direct `eq('school_id', ...)` queries.

### Unique class name per session
`UNIQUE INDEX classes_name_per_session ON classes(session_id, lower(class_name))` — prevents two classes with the same name (case-insensitive) within one session.

### Navigation flow
Sessions List → tap "Classes" button on session card → classList (session-scoped) → tap "+" → classForm (create) or tap edit icon → classForm (edit)

## Gotchas
- `available_teachers` is branch-scoped in the app (filtered by `branchId` in the hook), not in the view itself — the view returns all unassigned active teachers across all branches. The hook adds `.eq('branch_id', branchId)`.
- PostgREST join `classes(class_name)` in `useStaffList` returns an object `{ class_name: "..." }` for a to-one relation — accessed as `item.classes?.class_name` in the UI.
- The `update_class_teacher` RPC looks up `chat_id` by joining `classes → chats` internally — the app never needs to pass `chat_id` explicitly.
- If a teacher is removed from a class (set to null) and later another class is created with the same teacher, the teacher's `class_id` must be correctly reset to null first — the RPC handles this.
