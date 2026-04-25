-- ============================================================
-- Migration: Classes, Chats, Chat Members
-- + available_teachers view
-- + classes_with_teacher view
-- + create_class RPC (atomic: class + chat + member + profile update)
-- + update_class_teacher RPC (atomic teacher swap)
-- ============================================================

-- ─── Add FK constraint to profiles.class_id ───────────────────────────────────
-- profiles.class_id was created as a plain uuid in the initial profiles migration.
-- Now that the classes table exists we can add the FK + on delete set null.
alter table public.profiles
  add constraint profiles_class_id_fkey
  foreign key (class_id) references public.classes(id) on delete set null;


-- ─── classes ─────────────────────────────────────────────────────────────────
-- A class belongs to a session (and transitively to a branch and school).
-- school_id and branch_id are denormalised directly per CLAUDE.md rule.

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id)   on delete cascade,
  branch_id     uuid not null references public.branches(id)  on delete cascade,
  session_id    uuid not null references public.sessions(id)  on delete cascade,
  class_name    text not null,
  teacher_id    uuid references public.profiles(id)           on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Unique class name per session
create unique index classes_name_per_session
  on public.classes (session_id, lower(class_name));

create index classes_school_id_idx   on public.classes (school_id);
create index classes_branch_id_idx   on public.classes (branch_id);
create index classes_session_id_idx  on public.classes (session_id);
create index classes_teacher_id_idx  on public.classes (teacher_id);

alter table public.classes enable row level security;


-- ─── chats ───────────────────────────────────────────────────────────────────
-- One group chat per class, created atomically with the class.
-- school_id, branch_id, session_id denormalised for direct RLS + queries.

create table public.chats (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  branch_id   uuid not null references public.branches(id)  on delete cascade,
  session_id  uuid not null references public.sessions(id)  on delete cascade,
  class_id    uuid not null references public.classes(id)   on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create unique index chats_one_per_class on public.chats (class_id);

create index chats_school_id_idx  on public.chats (school_id);
create index chats_branch_id_idx  on public.chats (branch_id);
create index chats_session_id_idx on public.chats (session_id);

alter table public.chats enable row level security;


-- ─── chat_members ─────────────────────────────────────────────────────────────
-- Tracks who belongs to which group chat.
-- school_id denormalised per CLAUDE.md rule.

create table public.chat_members (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats(id)    on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  school_id   uuid not null references public.schools(id)  on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (chat_id, profile_id)
);

create index chat_members_chat_id_idx    on public.chat_members (chat_id);
create index chat_members_profile_id_idx on public.chat_members (profile_id);
create index chat_members_school_id_idx  on public.chat_members (school_id);

alter table public.chat_members enable row level security;


-- ─── RLS: classes ─────────────────────────────────────────────────────────────

-- Admin: full access
create policy "classes: admin all"
  on public.classes for all
  to authenticated
  using (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  )
  with check (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  );

-- Owner: select/insert/update for their school
create policy "classes: owner select"
  on public.classes for select
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = classes.school_id)
  );

create policy "classes: owner insert"
  on public.classes for insert
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = classes.school_id)
  );

create policy "classes: owner update"
  on public.classes for update
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = classes.school_id)
  );

-- Principal / coordinator: select classes in their branch
create policy "classes: branch staff select"
  on public.classes for select
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = classes.branch_id)
  );

-- Principal: insert/update classes in their branch
create policy "classes: principal insert"
  on public.classes for insert
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'principal' and p.branch_id = classes.branch_id)
  );

create policy "classes: principal update"
  on public.classes for update
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'principal' and p.branch_id = classes.branch_id)
  );

-- Coordinator: insert/update classes in their branch
create policy "classes: coordinator insert"
  on public.classes for insert
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'coordinator' and p.branch_id = classes.branch_id)
  );

create policy "classes: coordinator update"
  on public.classes for update
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'coordinator' and p.branch_id = classes.branch_id)
  );


-- ─── RLS: chats ───────────────────────────────────────────────────────────────

create policy "chats: owner all"
  on public.chats for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chats.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chats.school_id)
  );

create policy "chats: member select"
  on public.chats for select
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chats.id
        and cm.profile_id = auth.uid()
    )
  );

create policy "chats: branch staff manage"
  on public.chats for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = chats.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = chats.branch_id)
  );


-- ─── RLS: chat_members ────────────────────────────────────────────────────────

create policy "chat_members: owner all"
  on public.chat_members for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chat_members.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chat_members.school_id)
  );

create policy "chat_members: self select"
  on public.chat_members for select
  using (profile_id = auth.uid());

create policy "chat_members: branch staff manage"
  on public.chat_members for all
  using (
    exists (
      select 1 from public.get_my_profile() p
      join public.chats c on c.id = chat_members.chat_id
      where p.role in ('principal', 'coordinator')
        and p.branch_id = c.branch_id
    )
  )
  with check (
    exists (
      select 1 from public.get_my_profile() p
      join public.chats c on c.id = chat_members.chat_id
      where p.role in ('principal', 'coordinator')
        and p.branch_id = c.branch_id
    )
  );


-- ─── View: available_teachers ─────────────────────────────────────────────────
-- Teachers in a given branch who have no class assigned (class_id IS NULL).
-- Used by classForm teacher picker to show only unassigned teachers.
-- In edit mode, the current class's teacher is unioned in even if assigned.

create or replace view public.available_teachers as
select
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.branch_id,
  p.school_id,
  p.class_id,
  p.is_active
from public.profiles p
where p.role = 'teacher'
  and p.is_active = true
  and p.class_id is null;


-- ─── View: classes_with_teacher ───────────────────────────────────────────────
-- Classes joined with their incharge teacher name (null if unassigned).
-- Also includes the associated chat_id for easy lookup.

create or replace view public.classes_with_teacher as
select
  c.id,
  c.school_id,
  c.branch_id,
  c.session_id,
  c.class_name,
  c.teacher_id,
  p.name        as teacher_name,
  p.avatar_url  as teacher_avatar,
  ch.id         as chat_id,
  c.created_at,
  c.updated_at
from public.classes c
left join public.profiles p  on p.id  = c.teacher_id
left join public.chats    ch on ch.class_id = c.id;


-- ─── RPC: create_class ────────────────────────────────────────────────────────
-- Atomically:
--   1. Insert into classes
--   2. Insert into chats (group chat for this class)
--   3. If teacher_id given: insert into chat_members + set profiles.class_id

drop function if exists public.create_class(uuid, uuid, uuid, text, uuid);

create or replace function public.create_class(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_class_name text,
  p_teacher_id uuid default null   -- null = no incharge teacher yet
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_chat_id  uuid;
begin
  -- 1. Create the class
  insert into public.classes (school_id, branch_id, session_id, class_name, teacher_id)
  values (p_school_id, p_branch_id, p_session_id, p_class_name, p_teacher_id)
  returning id into v_class_id;

  -- 2. Create the group chat
  insert into public.chats (school_id, branch_id, session_id, class_id, name)
  values (p_school_id, p_branch_id, p_session_id, v_class_id, p_class_name || ' Chat')
  returning id into v_chat_id;

  -- 3. If teacher assigned: add to chat + set class_id on their profile
  if p_teacher_id is not null then
    insert into public.chat_members (chat_id, profile_id, school_id)
    values (v_chat_id, p_teacher_id, p_school_id);

    update public.profiles
    set class_id = v_class_id, updated_at = now()
    where id = p_teacher_id;
  end if;
end;
$$;

grant execute on function public.create_class(uuid, uuid, uuid, text, uuid) to authenticated;


drop function if exists public.update_class_teacher(uuid, uuid, uuid);

-- ─── RPC: update_class_teacher ────────────────────────────────────────────────
-- Atomically swaps the incharge teacher for an existing class.
-- Handles:
--   - old teacher → remove class_id from profile, remove from chat_members
--   - new teacher → set class_id on profile, add to chat_members
--   - new teacher = null → just remove old teacher (no new assignment)
-- Also updates classes.teacher_id and classes.updated_at.

create or replace function public.update_class_teacher(
  p_class_id      uuid,
  p_new_teacher_id uuid default null,   -- null = unassign (no teacher)
  p_old_teacher_id uuid default null    -- null = was unassigned before
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id   uuid;
  v_school_id uuid;
begin
  -- Look up chat and school for this class
  select ch.id, c.school_id
  into v_chat_id, v_school_id
  from public.classes c
  join public.chats ch on ch.class_id = c.id
  where c.id = p_class_id;

  -- Remove old teacher if there was one
  if p_old_teacher_id is not null then
    update public.profiles
    set class_id = null, updated_at = now()
    where id = p_old_teacher_id;

    delete from public.chat_members
    where chat_id = v_chat_id and profile_id = p_old_teacher_id;
  end if;

  -- Add new teacher if provided
  if p_new_teacher_id is not null then
    update public.profiles
    set class_id = p_class_id, updated_at = now()
    where id = p_new_teacher_id;

    insert into public.chat_members (chat_id, profile_id, school_id)
    values (v_chat_id, p_new_teacher_id, v_school_id)
    on conflict (chat_id, profile_id) do nothing;
  end if;

  -- Update the class record
  update public.classes
  set teacher_id = p_new_teacher_id, updated_at = now()
  where id = p_class_id;
end;
$$;

grant execute on function public.update_class_teacher(uuid, uuid, uuid) to authenticated;
