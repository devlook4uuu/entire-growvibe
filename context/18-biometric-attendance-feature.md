# 18 — Biometric Attendance Upload Feature

## What Was Built

A web-only feature that processes ZK Teco K40 `attlog.dat` files and bulk-marks student attendance for a selected branch and date. Handled by a Supabase Edge Function `process-biometric`.

---

## Flow

1. Owner/Principal/Coordinator opens `/biometric-attendance`
2. Owner sees a branch dropdown (loads active branches for their school). Principal/Coordinator do NOT see the dropdown — their `profile.branch_id` is used automatically.
3. User selects a date (defaults to today)
4. User uploads an `attlog.dat` file via drag-and-drop or file picker
5. Page calls the `process-biometric` Edge Function with: `branchId`, `date`, file content
6. Edge Function parses the attlog, matches device IDs to student profiles, upserts attendance records
7. Result shows: Processed, Matched, Unmatched counts with colored stat pills

---

## Web — `BiometricAttendancePage.jsx`

Route: `/biometric-attendance` — owner, principal, coordinator

### Role-based branch selection
- `isOwner = profile?.role === 'owner'`
- `branchesLoading` initialized to `isOwner` (false for principal/coordinator — no branches to load)
- `selectedBranch` initialized to `isOwner ? '' : (profile?.branch_id ?? '')` — principal/coordinator auto-use their branch
- `useEffect` to load branches only runs when `isOwner` is true
- Branch selector UI only rendered when `isOwner` is true

### File handling
- `useRef` for hidden `<input type="file">` — custom drag-and-drop zone triggers it
- Drag states: `dragOver` (boolean) — border color changes
- File validation: must be `.dat` or `.txt` extension
- File content read via `FileReader.readAsText`

### Edge Function call
- POST to `{SUPABASE_URL}/functions/v1/process-biometric`
- Auth header: `Bearer {session.access_token}`
- Body: `{ branchId, date, fileContent }`
- Response: `{ processed, matched, unmatched, errors[] }`

### Result display
- `StatPill` components: Processed (blue), Matched (green), Unmatched (yellow)
- Error list if any rows failed to parse/match
- Upload another file button to reset state

---

## Edge Function — `process-biometric`

Location: `supabase/functions/process-biometric/`

- Parses attlog.dat format: each line = `deviceUserId\tYYYY-MM-DD HH:MM:SS\tverifyMode\t...`
- Matches `deviceUserId` to `profiles.biometric_id` (or similar device field) for students in the branch
- Upserts into `attendance` table with `status = 'present'` for matched students
- Returns counts

---

## Key Decisions

1. **Principal/coordinator skip branch dropdown** — they only manage their own branch. Avoids confusion and removes one unnecessary interaction step.
2. **File-based upload over API punch** — ZK Teco K40 doesn't have a native API integration; exporting `attlog.dat` and uploading is the standard workflow.
3. **Edge Function handles parsing** — keeps attlog parsing logic server-side, away from client. Client just passes raw file text.
4. **Web only** — biometric device is physically at the branch; the person uploading is on a desktop/laptop. No mobile use case.

---

## Gotchas

- ZK Teco attlog format varies slightly across firmware versions. The Edge Function parser must handle both tab-separated and space-separated lines.
- `selectedBranch` must be set before allowing file upload — the submit button is disabled until both branch and file are selected.
- Date defaults to today but can be changed — useful for uploading yesterday's log if it wasn't done on time.
- Principal/coordinator `profile.branch_id` must be set — if null, the page will attempt to submit with an empty branchId and the Edge Function will fail.
