-- Migration: fix chat_members column name bug in 3 functions
-- The chat_members table uses 'profile_id', not 'user_id'.
-- manage_chat_member, add_student_to_class_chat, and update_class all used the
-- wrong column name, causing runtime errors on every call.

-- ─── 1. manage_chat_member ────────────────────────────────────────────────────
create or replace function public.manage_chat_member(p_chat_id uuid, p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $fn$
declare
  v_caller_role    text;
  v_user_role      text;
  v_user_branch_id uuid;
  v_chat_school_id uuid;
  v_chat_branch_id uuid;
begin
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role not in ('owner', 'principal', 'coordinator') then
    return jsonb_build_object('error', 'You are not allowed to manage chat members');
  end if;

  if p_action = 'add' then
    select role, branch_id into v_user_role, v_user_branch_id
    from public.profiles
    where id = p_user_id;

    if v_user_role != 'teacher' then
      return jsonb_build_object('error', 'Only teachers can be added to a class chat');
    end if;

    -- get school_id and branch_id from chats + classes
    select ch.school_id, cl.branch_id
      into v_chat_school_id, v_chat_branch_id
    from public.chats ch
    join public.classes cl on cl.id = ch.class_id
    where ch.id = p_chat_id;

    if v_user_branch_id is distinct from v_chat_branch_id then
      return jsonb_build_object('error', 'Teacher must be from the same branch as the class');
    end if;

    insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
    values (p_chat_id, p_user_id, v_chat_school_id, v_chat_branch_id, true)
    on conflict (chat_id, profile_id) do nothing;

  elsif p_action = 'remove' then
    delete from public.chat_members
    where chat_id  = p_chat_id
      and profile_id = p_user_id;

  else
    return jsonb_build_object('error', 'Invalid action — use add or remove');
  end if;

  return jsonb_build_object('success', true);

exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$fn$;

-- ─── 2. add_student_to_class_chat ─────────────────────────────────────────────
create or replace function public.add_student_to_class_chat(p_student_id uuid, p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $fn$
declare
  v_chat_id     uuid;
  v_school_id   uuid;
  v_branch_id   uuid;
  v_caller_role text;
begin
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role not in ('owner', 'principal', 'coordinator') then
    return jsonb_build_object('error', 'You are not allowed to add students to chat');
  end if;

  -- get chat id, school_id and branch_id for this class
  select ch.id, ch.school_id, ch.branch_id
    into v_chat_id, v_school_id, v_branch_id
  from public.chats ch
  where ch.class_id = p_class_id;

  if v_chat_id is null then
    return jsonb_build_object('error', 'No chat found for this class');
  end if;

  insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
  values (v_chat_id, p_student_id, v_school_id, v_branch_id, true)
  on conflict (chat_id, profile_id) do nothing;

  return jsonb_build_object('success', true);

exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$fn$;

-- ─── 3. update_class ──────────────────────────────────────────────────────────
create or replace function public.update_class(
  p_class_id       uuid,
  p_name           text    default null,
  p_new_teacher_id uuid    default null,
  p_remove_teacher boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $fn$
declare
  v_caller_role          text;
  v_old_teacher_id       uuid;
  v_new_teacher_class_id uuid;
  v_chat_id              uuid;
  v_school_id            uuid;
  v_branch_id            uuid;
begin
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role not in ('owner', 'principal', 'coordinator') then
    return jsonb_build_object('error', 'You are not allowed to update this class');
  end if;

  -- fetch teacher, school_id and branch_id from classes
  select teacher_id, school_id, branch_id
    into v_old_teacher_id, v_school_id, v_branch_id
  from public.classes
  where id = p_class_id;

  select id into v_chat_id
  from public.chats
  where class_id = p_class_id;

  -- validate new teacher is not already incharge of a different class
  if p_new_teacher_id is not null then
    select class_id into v_new_teacher_class_id
    from public.profiles
    where id = p_new_teacher_id;

    if v_new_teacher_class_id is not null
      and v_new_teacher_class_id is distinct from p_class_id then
      return jsonb_build_object('error', 'This teacher is already assigned to another class');
    end if;
  end if;

  -- Step 1: rename class if requested (column is class_name, not name)
  if p_name is not null then
    update public.classes
    set class_name = p_name
    where id = p_class_id;
  end if;

  -- Step 2: teacher change
  if p_new_teacher_id is not null
    and p_new_teacher_id is distinct from v_old_teacher_id then

    if v_old_teacher_id is not null then
      update public.profiles set class_id = null where id = v_old_teacher_id;
      delete from public.chat_members
      where chat_id = v_chat_id and profile_id = v_old_teacher_id;
    end if;

    update public.profiles set class_id = p_class_id where id = p_new_teacher_id;
    update public.classes  set teacher_id = p_new_teacher_id where id = p_class_id;

    insert into public.chat_members (chat_id, profile_id, school_id, branch_id, can_send_message)
    values (v_chat_id, p_new_teacher_id, v_school_id, v_branch_id, true)
    on conflict (chat_id, profile_id) do nothing;

  -- Step 3: remove teacher completely
  elsif p_remove_teacher = true then
    if v_old_teacher_id is not null then
      update public.profiles set class_id = null where id = v_old_teacher_id;
      delete from public.chat_members
      where chat_id = v_chat_id and profile_id = v_old_teacher_id;
    end if;
    update public.classes set teacher_id = null where id = p_class_id;
  end if;

  return jsonb_build_object('success', true);

exception
  when unique_violation then
    return jsonb_build_object('error', 'A class with this name already exists in this session');
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$fn$;
