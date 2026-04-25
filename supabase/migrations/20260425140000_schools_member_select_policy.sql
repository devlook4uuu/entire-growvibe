-- Allow any authenticated user who belongs to a school to read their own school row.
-- Needed by TopBar (and any screen) fetching school name/logo for non-admin roles
-- (owner, principal, coordinator, teacher, student).
create policy "schools: member select"
  on public.schools for select
  using (
    id = (
      select school_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );
