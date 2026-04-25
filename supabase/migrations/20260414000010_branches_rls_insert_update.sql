-- Add admin insert + update policies to branches table.
-- The select policy already exists from migration 2 (create_profiles).

create policy "branches: admin insert"
  on public.branches for insert
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

create policy "branches: admin update"
  on public.branches for update
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

-- Also fix the existing select policy to also allow admin to see all branches
-- (original policy only allows members to see their own school's branches).
drop policy if exists "branches: read own school" on public.branches;

create policy "branches: admin select"
  on public.branches for select
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

create policy "branches: member select"
  on public.branches for select
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );
