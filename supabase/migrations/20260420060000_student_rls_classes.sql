-- Allow students to SELECT their own class row.
-- Needed so the app can resolve session_id from class_id on the home screen widget.
--
-- We cannot query public.profiles inside this policy because:
--   profiles: teacher read own class students  →  queries classes
--   classes: student select own  →  queries profiles  →  infinite recursion
--
-- Solution: a SECURITY DEFINER helper that reads profiles bypassing RLS,
-- then use it in the policy instead of querying profiles directly.

-- 1. Helper: returns the class_id of the current user (bypasses RLS)
create or replace function public.get_my_class_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select class_id from public.profiles where id = auth.uid() limit 1;
$$;

-- 2. Drop old broken policy if it exists
drop policy if exists "classes: student select own" on public.classes;

-- 3. New policy: student can read the one class row they belong to
create policy "classes: student select own"
  on public.classes
  for select
  using (
    id = public.get_my_class_id()
  );
