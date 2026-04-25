-- Allow admin users to insert and update schools.
-- Admins are identified by role = 'admin' in their profile.

create policy "schools: admin insert"
  on public.schools for insert
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

create policy "schools: admin update"
  on public.schools for update
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );
