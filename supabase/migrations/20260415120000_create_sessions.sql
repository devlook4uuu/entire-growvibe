-- ─── Sessions ─────────────────────────────────────────────────────────────────
-- One session per branch at a time (is_active = true).
-- school_id is denormalised directly (per project CLAUDE.md rule) so RLS and
-- queries never need a join through branches.

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id)   on delete cascade,
  branch_id     uuid not null references public.branches(id)  on delete cascade,
  session_name  text not null,
  session_start date not null,
  session_end   date not null,
  is_active     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint sessions_end_after_start check (session_end > session_start)
);

-- Only one active session per branch at a time
create unique index sessions_one_active_per_branch
  on public.sessions (branch_id)
  where (is_active = true);

-- Fast lookups by branch and school
create index sessions_branch_id_idx  on public.sessions (branch_id);
create index sessions_school_id_idx  on public.sessions (school_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.sessions enable row level security;

-- Admin: full access to all sessions
create policy "admin_sessions_all"
  on public.sessions
  for all
  to authenticated
  using  ( (auth.jwt() ->> 'role') = 'admin' )
  with check ( (auth.jwt() ->> 'role') = 'admin' );

-- Owner: select sessions for their own school
create policy "owner_sessions_select"
  on public.sessions
  for select
  to authenticated
  using (
    (auth.jwt() ->> 'role') = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );

-- Owner: insert sessions for their own school
create policy "owner_sessions_insert"
  on public.sessions
  for insert
  to authenticated
  with check (
    (auth.jwt() ->> 'role') = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );

-- Owner: update sessions for their own school
create policy "owner_sessions_update"
  on public.sessions
  for update
  to authenticated
  using (
    (auth.jwt() ->> 'role') = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  )
  with check (
    (auth.jwt() ->> 'role') = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );
