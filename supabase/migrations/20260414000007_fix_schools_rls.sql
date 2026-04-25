-- Drop all existing schools policies and rebuild them properly.
-- Admin needs full access (select/insert/update).
-- Non-admin users can only read their own school.

drop policy if exists "schools: read own"     on public.schools;
drop policy if exists "schools: admin insert" on public.schools;
drop policy if exists "schools: admin update" on public.schools;

-- Admin: full read
create policy "schools: admin select"
  on public.schools for select
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

-- Non-admin: read only own school
create policy "schools: member select"
  on public.schools for select
  using (
    id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );

-- Admin: insert
create policy "schools: admin insert"
  on public.schools for insert
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

-- Admin: update
create policy "schools: admin update"
  on public.schools for update
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );
