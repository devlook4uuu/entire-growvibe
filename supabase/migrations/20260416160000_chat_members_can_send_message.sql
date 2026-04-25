-- ============================================================
-- Migration: Add can_send_message to chat_members
-- Tracks per-membership send permission (not global on profiles).
-- Default true — set to false when adding students.
-- Also updates create_class RPC to set can_send_message explicitly.
-- ============================================================

alter table public.chat_members
  add column can_send_message boolean not null default true;


-- ─── Update create_class RPC ──────────────────────────────────────────────────
-- Teacher is always can_send_message = true.

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
  -- 1. Create the class
  insert into public.classes (school_id, branch_id, session_id, class_name, teacher_id)
  values (p_school_id, p_branch_id, p_session_id, p_class_name, p_teacher_id)
  returning id into v_class_id;

  -- 2. Create the group chat
  insert into public.chats (school_id, branch_id, session_id, class_id, name)
  values (p_school_id, p_branch_id, p_session_id, v_class_id, p_class_name || ' Chat')
  returning id into v_chat_id;

  -- 3. If teacher assigned: add to chat (can_send_message = true) + set class_id on profile
  if p_teacher_id is not null then
    insert into public.chat_members (chat_id, profile_id, school_id, can_send_message)
    values (v_chat_id, p_teacher_id, p_school_id, true);

    update public.profiles
    set class_id = v_class_id, updated_at = now()
    where id = p_teacher_id;
  end if;
end;
$$;

grant execute on function public.create_class(uuid, uuid, uuid, text, uuid) to authenticated;


-- ─── RPC: add_chat_member ─────────────────────────────────────────────────────
-- Adds a profile to a chat with explicit can_send_message value.
-- Idempotent: ON CONFLICT DO NOTHING.

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
begin
  insert into public.chat_members (chat_id, profile_id, school_id, can_send_message)
  values (p_chat_id, p_profile_id, p_school_id, p_can_send_message)
  on conflict (chat_id, profile_id) do nothing;
end;
$$;

grant execute on function public.add_chat_member(uuid, uuid, uuid, boolean) to authenticated;


-- ─── RPC: set_chat_member_send_permission ─────────────────────────────────────
-- Toggles can_send_message for a specific chat membership.

drop function if exists public.set_chat_member_send_permission(uuid, uuid, boolean);

create or replace function public.set_chat_member_send_permission(
  p_chat_id      uuid,
  p_profile_id   uuid,
  p_can_send     boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_members
  set can_send_message = p_can_send
  where chat_id = p_chat_id and profile_id = p_profile_id;
end;
$$;

grant execute on function public.set_chat_member_send_permission(uuid, uuid, boolean) to authenticated;
