-- ============================================================
-- Fix: infinite recursion in chat_members RLS
--
-- Root cause: "chat_members: branch staff manage" joins public.chats,
-- but chats has a policy "chats: member select" that queries chat_members
-- → cycle: chat_members → chats → chat_members.
--
-- Fix: add branch_id directly to chat_members (per CLAUDE.md denorm rule),
-- then the branch staff policy can use chat_members.branch_id directly
-- with no join — breaking the cycle entirely.
-- ============================================================

-- ─── 1. Add branch_id to chat_members ────────────────────────────────────────
alter table public.chat_members
  add column branch_id uuid references public.branches(id) on delete cascade;

-- Back-fill from chats table
update public.chat_members cm
set branch_id = ch.branch_id
from public.chats ch
where ch.id = cm.chat_id;

-- Make it not null now that it's filled
alter table public.chat_members
  alter column branch_id set not null;

create index chat_members_branch_id_idx on public.chat_members (branch_id);


-- ─── 2. Drop all existing chat_members policies ───────────────────────────────
drop policy if exists "chat_members: admin all"          on public.chat_members;
drop policy if exists "chat_members: owner all"          on public.chat_members;
drop policy if exists "chat_members: self select"        on public.chat_members;
drop policy if exists "chat_members: branch staff manage" on public.chat_members;


-- ─── 3. Recreate policies — no joins, no recursion ───────────────────────────

create policy "chat_members: admin all"
  on public.chat_members for all
  to authenticated
  using (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  )
  with check (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  );

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

-- branch_id is now on chat_members directly — no join to chats needed
create policy "chat_members: branch staff manage"
  on public.chat_members for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = chat_members.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = chat_members.branch_id)
  );

create policy "chat_members: self select"
  on public.chat_members for select
  using (profile_id = auth.uid());


-- ─── 4. Update add_chat_member RPC to pass branch_id ─────────────────────────
drop function if exists public.add_chat_member(uuid, uuid, uuid, boolean);

create or replace function public.add_chat_member(
  p_chat_id           uuid,
  p_profile_id        uuid,
  p_school_id         uuid,
  p_can_send_message  boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select branch_id into v_branch_id from public.chats where id = p_chat_id;

  insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
  values (p_chat_id, p_profile_id, p_school_id, v_branch_id, p_can_send_message)
  on conflict (chat_id, profile_id) do nothing;
end;
$$;

grant execute on function public.add_chat_member(uuid, uuid, uuid, boolean) to authenticated;


-- ─── 5. Update create_class RPC to pass branch_id on chat_members insert ──────
drop function if exists public.create_class(uuid, uuid, uuid, text, uuid);

create or replace function public.create_class(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_class_name text,
  p_teacher_id uuid default null
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
  insert into public.classes (school_id, branch_id, session_id, class_name, teacher_id)
  values (p_school_id, p_branch_id, p_session_id, p_class_name, p_teacher_id)
  returning id into v_class_id;

  insert into public.chats (school_id, branch_id, session_id, class_id, name)
  values (p_school_id, p_branch_id, p_session_id, v_class_id, p_class_name || ' Chat')
  returning id into v_chat_id;

  if p_teacher_id is not null then
    insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
    values (v_chat_id, p_teacher_id, p_school_id, p_branch_id, true);

    update public.profiles
    set class_id = v_class_id, updated_at = now()
    where id = p_teacher_id;
  end if;
end;
$$;

grant execute on function public.create_class(uuid, uuid, uuid, text, uuid) to authenticated;


-- ─── 6. Update update_class_teacher RPC to pass branch_id ────────────────────
drop function if exists public.update_class_teacher(uuid, uuid, uuid);

create or replace function public.update_class_teacher(
  p_class_id       uuid,
  p_new_teacher_id uuid default null,
  p_old_teacher_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id   uuid;
  v_school_id uuid;
  v_branch_id uuid;
begin
  select ch.id, c.school_id, c.branch_id
  into v_chat_id, v_school_id, v_branch_id
  from public.classes c
  join public.chats ch on ch.class_id = c.id
  where c.id = p_class_id;

  if p_old_teacher_id is not null then
    update public.profiles
    set class_id = null, updated_at = now()
    where id = p_old_teacher_id;

    delete from public.chat_members
    where chat_id = v_chat_id and profile_id = p_old_teacher_id;
  end if;

  if p_new_teacher_id is not null then
    update public.profiles
    set class_id = p_class_id, updated_at = now()
    where id = p_new_teacher_id;

    insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
    values (v_chat_id, p_new_teacher_id, v_school_id, v_branch_id, true)
    on conflict (chat_id, profile_id) do nothing;
  end if;

  update public.classes
  set teacher_id = p_new_teacher_id, updated_at = now()
  where id = p_class_id;
end;
$$;

grant execute on function public.update_class_teacher(uuid, uuid, uuid) to authenticated;
