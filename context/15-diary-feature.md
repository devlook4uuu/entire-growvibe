# 15 — Class Diary Feature

## What Was Built

A per-class diary system where teachers post homework and task entries for their class. Entries have an expiry date. Students see all active (non-expired) entries for their class. Coordinators can view entries for their branch.

---

## Database (Migrations Applied)

### `20260424180000_create_class_diary.sql`
- Table: `class_diary`
  - Columns: `id, school_id, branch_id, class_id, title, description, subjects (text[]), expire_date (date), posted_by, created_at, updated_at`
  - `subjects` is a text array — multiple subjects per entry
- RLS:
  - Admin: full access
  - Owner: school-scoped full access
  - Principal/Coordinator: branch-scoped full access
  - Teacher: INSERT/UPDATE/DELETE own entries only (`posted_by = auth.uid()`)
  - Student: SELECT entries for their class only (`class_id = profile.class_id`)

### `20260424190000_class_diary_add_is_expired.sql`
- Adds `is_expired boolean default false` — teacher can manually mark an entry expired before its date
- Soft-expiry: entry stays in DB but hidden from active views when `is_expired = true` or `expire_date < today`

### `20260425190000_fix_class_diary_coordinator_branch_scope.sql`
- Fixed coordinator RLS to use branch-scoped access rather than class-scoped

---

## Web — `DiaryPage.jsx`

Route: `/diary` — teacher role

- Lists all diary entries for the teacher's assigned class (`profile.class_id`)
- Cache keyed by `${scope}|${query}`, TTL 30s, `PAGE_SIZE = 12`
- Card shows: title, description preview, subjects as chips, expire date, expired badge if applicable
- Add via slide-over: title (required), description, subjects (comma-separated or multi-input), expire_date
- Edit: same slide-over pre-filled
- "Mark Expired" button on each card (toggles `is_expired`) — does not delete
- Expired entries shown with reduced opacity (0.7), "Expired" badge
- Teacher can only edit/expire their own entries; coordinator/principal see all branch entries read-only

---

## App — `diaryList.jsx` + `diaryDetail.jsx`

### `diaryList.jsx`
- Route params: none (uses `profile.class_id` from Redux)
- Shows active entries only (`is_expired = false` AND `expire_date >= today`)
- `PAGE_SIZE = 20`, TTL 30s module-level cache keyed by `classId`
- Pull-to-refresh, Load More button
- Each card: title, description, subjects, expire date
- Tap → `diaryDetail`

### `diaryDetail.jsx`
- Shows full entry: title, full description, subjects list, expire date
- Read-only for students

---

## Home Screen Integration

`StudentDiaryCard` in `home.jsx` (student role):
- Fetches count of active diary entries for `profile.class_id`
- If count > 0: shows a tappable card with count and "View" chevron → navigates to `diaryList`
- If count = 0: renders `null` (hidden)

`DiaryCard` in `TeacherDashboard.jsx` (web, teacher role):
- Fetches today's diary entries for the teacher's class
- If entries exist: lists them
- If none: shows "Post Today's Diary" button → navigates to `/diary`

---

## Key Decisions

1. **`subjects` as text array** — flexible; no subjects table needed. Displayed as chips.
2. **Dual expiry mechanism** — date-based auto-expiry + manual `is_expired` toggle. Teacher can pull an entry early without waiting for the date.
3. **Student read via class_id RLS** — students can only see their own class diary. No branch-level visibility for students.
4. **No push notification on diary post** — diary is passive discovery (student checks the app). Push could be added later.

---

## Gotchas

- `expire_date` is a `date` column (not timestamp). Comparison is `>= today` using the date string `YYYY-MM-DD`.
- Teachers without a `class_id` see an empty list — no entries can be posted or viewed until the teacher is assigned a class.
- The `subjects` array can be empty — cards still render, just without subject chips.
