# 09 — Attendance Feature

## What Was Built

Full attendance system for both teacher and student attendance, session-scoped, across app and web.

---

## Database (Migrations Applied)

### `20260418140000_create_attendance_enum.sql`
- `public.attendance_status` enum: `present | absent | late | leave`

### `20260418150000_create_teacher_attendance.sql`
- Table: `teacher_attendance`
  - Columns: `id, school_id, branch_id, session_id, teacher_id, date, status, marked_by, note, created_at, updated_at`
  - Unique: `(teacher_id, session_id, date)`
- RLS:
  - Admin: full access
  - Owner: school-scoped full access
  - Principal/Coordinator: branch-scoped full access
  - Teacher: INSERT own only + SELECT own only (no UPDATE/DELETE — immutable after mark)
- RPC `upsert_teacher_attendance(...)` — ON CONFLICT DO UPDATE. Teachers can only insert (no UPDATE RLS), managers can both insert and update.

### `20260418160000_create_student_attendance.sql`
- Table: `student_attendance`
  - Columns: `id, school_id, branch_id, session_id, class_id, student_id, date, status, marked_by, note, created_at, updated_at`
  - Unique: `(student_id, session_id, date)`
- RLS:
  - Admin: full access
  - Owner: school-scoped full access
  - Principal/Coordinator: branch-scoped full access
  - Teacher: INSERT for their assigned class (`classes.teacher_id = auth.uid()`) + SELECT for their class (no UPDATE/DELETE)
  - Student: SELECT own records only
- RPC `upsert_class_attendance(p_records jsonb)` — bulk JSONB array upsert for entire class in one call

### `20260418170000_create_attendance_views.sql`
- `teacher_attendance_with_name` — joins teacher_attendance + profiles (teacher_name, teacher_avatar, marked_by_name)
- `student_attendance_with_name` — joins student_attendance + profiles (student_name, student_avatar, marked_by_name)
- Both: `grant select to authenticated`

---

## App Hooks

### `hooks/useTeacherAttendance.js`
- Cache key: `${teacherId}|${sessionId}`, TTL 60s
- Fetches all teacher_attendance records for teacher + session
- Derives `todayRecord` from records
- `markAttendance({ schoolId, branchId, date, status, note })` — calls `upsert_teacher_attendance` RPC, invalidates cache, optimistically updates state
- Exports `invalidateTeacherAttendanceCache(teacherId, sessionId)`

### `hooks/useStudentAttendance.js`
- Cache key: `${classId}|${date}`, TTL 60s
- Fetches student roster (profiles) + attendance records for class + date in parallel
- Merges into `students[]` with `attendance` field (null = not marked)
- `submitAttendance({ schoolId, branchId, records })` — calls `upsert_class_attendance` RPC, refetches
- Exports `invalidateStudentAttendanceCache(classId, date)`

### `hooks/useStudentOwnAttendance.js`
- Cache key: `${studentId}|${sessionId}`, TTL 60s
- Fetches all student_attendance records for a student + session
- Derives `todayRecord`
- Exports `invalidateStudentOwnAttendanceCache(studentId, sessionId)`

---

## App Screens

### `app/screens/attendance/teacherAttendanceHistory.jsx`
- Calendar view of teacher attendance for a session
- Month navigator (can't go beyond current month)
- Day cells colored by status, "—" for not-marked past days, empty for future
- **Managers** (`canEdit='true'`): tap any past day → MarkModal (status picker) → calls `markAttendance`
- **Teachers** (`canEdit='false'`): read-only
- Resolves `sessionId` from teacher's class via Supabase if not passed as param (manager path from staffList passes empty sessionId)
- Route params: `teacherId, teacherName, sessionId, schoolId, branchId, canEdit`

### `app/screens/attendance/markStudentAttendance.jsx`
- Full class roster for a selected date with P/A/L/Lv pill buttons
- Date navigator (teacher can't go future; managers can navigate any past date)
- Local state tracks unsaved changes; "Save Attendance" button appears when changes exist
- Calls `upsert_class_attendance` on submit
- Resolves `sessionId` from class table if not passed (teacher home navigates without sessionId)
- Route params: `classId, className, sessionId, schoolId, branchId, canEdit`

### `app/screens/attendance/studentAttendanceHistory.jsx`
- Same as markStudentAttendance but reached from class card "Attendance" button
- Shows daily attendance summary badges (Present: N, Absent: N, etc.)
- Managers can edit, teachers read-only
- Route params: same as markStudentAttendance

### `app/screens/attendance/studentSelfAttendance.jsx`
- Calendar view for a student's own attendance
- Monthly summary counts + legend
- Read-only (students cannot mark or edit)
- Route params: `studentId, sessionId, studentName`

---

## App Home Screen Changes (`app/(tabs)/home.jsx`)

### Teacher role additions
- `TeacherAttendanceWidget`: resolves `sessionId` from teacher's class via Supabase on mount. If no `todayRecord` → shows status pills (Present/Absent/Late/Leave) to mark attendance. If marked → shows colored status chip. "History" button → `teacherAttendanceHistory`.
- `MANAGEMENT.teacher` section: "Mark Attendance" + "Attendance History" items. Only shown if `profile.class_id` exists.
- Route handlers for `__mark_attendance__` and `__student_attendance_history__`

### Student role additions
- `StudentAttendanceWidget`: shows today's status or "Not Marked" chip. "History" button → `studentSelfAttendance`.

---

## App List Screen Changes

### `app/screens/staff/staffList.jsx`
- Teacher cards gain an "Attendance" button (orange) → `teacherAttendanceHistory` with `canEdit: 'true'`

### `app/screens/class/classList.jsx`
- Class cards gain an "Attendance" button (orange) → `studentAttendanceHistory` with `canEdit: 'true'`

---

## Web Pages

### `growvibe-web-v1/src/pages/management/TeacherAttendancePage.jsx`
- Route: `/teacher-attendance?teacherId=…&teacherName=…&sessionId=…`
- Calendar grid + monthly summary sidebar
- Managers click any past day → inline modal (status picker) → `upsert_teacher_attendance` RPC
- Resolves sessionId from teacher's class if not in URL
- Layout: calendar (left, wide) + summary + legend (right, 280px)

### `growvibe-web-v1/src/pages/management/StudentAttendancePage.jsx`
- Route: `/student-attendance?classId=…&className=…&sessionId=…`
- Date navigator + full student list with P/A/L/Lv pill buttons
- Save button appears when changes exist; calls `upsert_class_attendance` RPC
- Summary panel (right sidebar) shows counts
- Layout: student list (left) + summary + save (right, 240px)

---

## Web Wiring

### `StaffPage.jsx`
- Teacher cards gain "Attendance" button → navigates to `/teacher-attendance?teacherId=…`

### `ClassesPage.jsx`
- Class cards gain "Attendance" button → navigates to `/student-attendance?classId=…`

### `App.jsx`
- Added routes: `/teacher-attendance` → `TeacherAttendancePage`, `/student-attendance` → `StudentAttendancePage`
- Replaced `/attendance` placeholder with the two real routes

---

## Key Decisions

1. **Immutability via RLS only** — teachers have no UPDATE/DELETE policy. The upsert RPC's ON CONFLICT clause handles the first mark; subsequent calls are rejected by RLS for teachers. No extra DB column needed.

2. **sessionId resolution** — teachers/students don't have `session_id` on their profile. Resolved lazily from their class row (`classes.session_id`) inside the screen using a one-time Supabase fetch.

3. **No "holiday" concept** — if no record exists for a past day: show "Not Marked". Simple, no holiday table.

4. **Bulk class attendance** — single `upsert_class_attendance` RPC with JSONB array avoids N individual calls for a class of 40+ students.

5. **school_id on both tables** — follows CLAUDE.md rule; enables direct school-scoped RLS without joins.

6. **Teacher marks their own attendance** — from home screen widget. Managers mark teacher attendance from the staff card "Attendance" button or from the teacher attendance history calendar.

7. **Student attendance marked by incharge teacher only** — enforced by RLS (`classes.teacher_id = auth.uid()`). Students with no assigned class don't see the option on teacher home.

---

## Gotchas

- `supabase.single()` on class lookup returns error if teacher has no class — always guard with `if (data?.session_id)`.
- Web `TeacherAttendancePage` passes `profile.branch_id` to the RPC — ensure the manager has `branch_id` on their profile (owner may not; owner uses `selectedBranchId` from Redux instead).
- Calendar cells: future days are non-interactive, rendered transparent. Past days with no record show `—` on a light gray background.
- `markStudentAttendance` and `studentAttendanceHistory` are functionally identical screens reached from different entry points. They could be merged into one route in the future.
