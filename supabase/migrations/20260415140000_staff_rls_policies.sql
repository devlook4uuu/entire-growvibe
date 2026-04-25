-- ============================================================
-- Migration: Staff RLS policies for profiles
-- Covers: principal, coordinator, teacher reads/updates
-- scoped to school_id + branch_id.
-- Owners read all staff in their school.
-- Principal/coordinator read staff in their branch.
-- ============================================================

-- ── Profiles: owner can read all profiles in their school ─────────────────────
create policy "profiles: owner read school"
  on public.profiles for select
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
    and (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
  );

-- ── Profiles: principal/coordinator can read profiles in their branch ─────────
create policy "profiles: branch staff read"
  on public.profiles for select
  using (
    branch_id = (select branch_id from public.profiles where id = auth.uid() limit 1)
    and (select role from public.profiles where id = auth.uid() limit 1) in ('principal', 'coordinator')
  );

-- ── Profiles: owner can update staff profiles in their school ─────────────────
create policy "profiles: owner update school staff"
  on public.profiles for update
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
    and (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
    and role in ('principal', 'coordinator', 'teacher', 'student')
  );

-- ── Profiles: principal can update coordinator/teacher in their branch ────────
create policy "profiles: principal update branch staff"
  on public.profiles for update
  using (
    branch_id = (select branch_id from public.profiles where id = auth.uid() limit 1)
    and (select role from public.profiles where id = auth.uid() limit 1) = 'principal'
    and role in ('coordinator', 'teacher', 'student')
  );

-- ── Profiles: coordinator can update teacher/student in their branch ──────────
create policy "profiles: coordinator update branch staff"
  on public.profiles for update
  using (
    branch_id = (select branch_id from public.profiles where id = auth.uid() limit 1)
    and (select role from public.profiles where id = auth.uid() limit 1) = 'coordinator'
    and role in ('teacher', 'student')
  );
