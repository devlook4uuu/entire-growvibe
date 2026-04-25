-- ============================================================
-- Migration 2: Create profiles table
-- schools and branches already exist (migration 1).
-- owner_id FK on schools is added at the end of this migration.
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete restrict,
  role            text not null check (role in ('admin', 'owner', 'principal', 'coordinator', 'teacher', 'student')),
  name            text not null default '',
  email           text not null default '',
  school_id       uuid references public.schools(id) on delete restrict,
  branch_id       uuid references public.branches(id) on delete restrict,
  class_id        uuid,
  is_active       boolean not null default true,
  device_tokens   jsonb not null default '[]'::jsonb,
  expo_push_token text,
  grow_coins      integer not null default 0,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_school_id_idx   on public.profiles(school_id);
create index profiles_branch_id_idx   on public.profiles(branch_id);
create index profiles_school_role_idx on public.profiles(school_id, role);

alter table public.profiles enable row level security;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Now that profiles exists, add the owner_id FK on schools
alter table public.schools
  add constraint schools_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete restrict;

create unique index schools_owner_id_unique on public.schools(owner_id)
  where owner_id is not null;

create index schools_owner_id_idx on public.schools(owner_id);

-- RLS for schools (needs profiles to exist for the subquery)
create policy "schools: read own"
  on public.schools for select
  using (
    id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );

-- RLS for branches (needs profiles to exist for the subquery)
create policy "branches: read own school"
  on public.branches for select
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );
