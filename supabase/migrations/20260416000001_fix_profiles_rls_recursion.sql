-- ============================================================
-- Fix: infinite recursion in profiles RLS policies
--
-- Root cause: policies on `profiles` were doing subqueries
-- like `(select role from public.profiles where id = auth.uid())`
-- which re-triggers profiles RLS → infinite loop.
--
-- Fix: create a SECURITY DEFINER helper function that reads the
-- caller's own profile row bypassing RLS. Use this function in
-- all profiles policies instead of inline subqueries.
-- ============================================================

-- ── Drop the broken policies first ───────────────────────────────────────────
drop policy if exists "profiles: owner read school"         on public.profiles;
drop policy if exists "profiles: branch staff read"         on public.profiles;
drop policy if exists "profiles: owner update school staff" on public.profiles;
drop policy if exists "profiles: principal update branch staff" on public.profiles;
drop policy if exists "profiles: coordinator update branch staff" on public.profiles;

-- ── Helper function (SECURITY DEFINER bypasses RLS) ──────────────────────────
-- Returns the caller's own profile row. Marked STABLE so Postgres caches
-- the result within a single query — one lookup per statement, not per row.
create or replace function public.get_my_profile()
returns table (role text, school_id uuid, branch_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select role, school_id, branch_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- Grant execute to authenticated users
grant execute on function public.get_my_profile() to authenticated;

-- ── Recreate profiles policies using the helper ───────────────────────────────

-- Owner: read all profiles in their school
create policy "profiles: owner read school"
  on public.profiles for select
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role = 'owner'
        and p.school_id = profiles.school_id
    )
  );

-- Principal / coordinator: read profiles in their branch
create policy "profiles: branch staff read"
  on public.profiles for select
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role in ('principal', 'coordinator')
        and p.branch_id = profiles.branch_id
    )
  );

-- Owner: update staff profiles in their school
create policy "profiles: owner update school staff"
  on public.profiles for update
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role = 'owner'
        and p.school_id = profiles.school_id
        and profiles.role in ('principal', 'coordinator', 'teacher', 'student')
    )
  );

-- Principal: update coordinator/teacher/student in their branch
create policy "profiles: principal update branch staff"
  on public.profiles for update
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role = 'principal'
        and p.branch_id = profiles.branch_id
        and profiles.role in ('coordinator', 'teacher', 'student')
    )
  );

-- Coordinator: update teacher/student in their branch
create policy "profiles: coordinator update branch staff"
  on public.profiles for update
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role = 'coordinator'
        and p.branch_id = profiles.branch_id
        and profiles.role in ('teacher', 'student')
    )
  );
