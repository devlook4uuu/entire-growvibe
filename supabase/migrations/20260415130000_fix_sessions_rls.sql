-- Fix sessions RLS policies: replace auth.jwt() ->> 'role' with the
-- profile-subquery pattern used consistently across all other tables.

drop policy if exists "admin_sessions_all"    on public.sessions;
drop policy if exists "owner_sessions_select" on public.sessions;
drop policy if exists "owner_sessions_insert" on public.sessions;
drop policy if exists "owner_sessions_update" on public.sessions;

-- Admin: full access to all sessions
create policy "sessions: admin all"
  on public.sessions for all
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  )
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

-- Owner: select sessions for their own school
create policy "sessions: owner select"
  on public.sessions for select
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
    and school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );

-- Owner: insert sessions for their own school
create policy "sessions: owner insert"
  on public.sessions for insert
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
    and school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );

-- Owner: update sessions for their own school
create policy "sessions: owner update"
  on public.sessions for update
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
    and school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  )
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'owner'
    and school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );
