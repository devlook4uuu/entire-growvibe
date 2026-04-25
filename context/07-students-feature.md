# 07 — Students Feature

## What was built
Class-scoped student management: create/edit students with a `student_fee` field, dedicated student list and form screens, and navigation from the class card's Students button.

## Migration applied
| File | What it does |
|------|-------------|
| `20260416130000_add_student_fee_to_profiles.sql` | Adds `student_fee numeric(10,2) not null default 0` column to `profiles` |

## Edge functions updated
- `supabase/functions/create-user/index.ts` — now accepts `class_id` and `student_fee` in request body; sets them on profile upsert for student role
- `supabase/functions/update-user/index.ts` — now accepts `student_fee` in request body; updates it on profiles

## App files created/changed
- `hooks/useStudentList.js` — class-scoped list hook; queries `profiles` where `role='student' AND class_id=<classId>`
- `app/screens/student/studentList.jsx` — student list screen; shows fee + join date per card; navigates to `studentForm` on add/edit
- `app/screens/student/studentForm.jsx` — student create/edit form with `student_fee` field; calls `create-user` RPC (with `class_id`) on create, `update-user` on edit; same pattern as `staffForm.jsx`
- `app/screens/class/classList.jsx` — Students button now navigates to `/screens/student/studentList` (was incorrectly going to `staffList`)

## Key decisions

### Students are a full auth role
Students are created via the `create-user` edge function (same as teachers, coordinators, etc.). This means they get a Supabase Auth account and can log in.

### class_id shared between teachers and students
`profiles.class_id` is used by both teachers (incharge of a class) and students (member of a class). The FK is `references classes(id) on delete set null` for both. The `available_teachers` view already filters `role = 'teacher'` so student rows don't interfere. The `update_class_teacher` RPC only touches teacher profiles.

When creating a student, `class_id` is passed to `create-user` and written directly into the profile upsert payload.

### student_fee on profiles
`student_fee` lives directly on `profiles` (not a separate fees table). It stores the per-student fee amount set at enrollment time. A `0` default means existing profiles are not affected.

### Class-scoped list hook
`useStudentList(classId)` filters by `class_id` (not `branch_id` like staff). Cache key: `${classId}|${query}`.

### Navigation flow
Classes List → tap "Students" on class card → studentList (class-scoped) → tap "+" → studentForm (create) or tap edit icon → studentForm (edit)

## Gotchas
- `student_fee` is stored as `numeric(10,2)` in Postgres; passed as `Number(values.student_fee)` from the form to avoid string→decimal issues.
- In edit mode, `student_fee` is initialized as `String(student.student_fee)` in Formik (Input expects a string), then converted back to `Number` on submit.
- The `create-user` edge function already had `'student'` in `VALID_ROLES` and `CREATION_RULES` — only payload fields needed adding.
