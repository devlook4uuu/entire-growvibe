-- Migration: fix switch_session function
-- 'is_current' column does not exist in sessions table — the correct column is 'is_active'.
-- Also note: activate_session already handles this correctly with is_active.

create or replace function public.switch_session(p_branch_id uuid, p_new_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $fn$
declare
  v_session     public.sessions%rowtype;
  v_caller_id   uuid;
  v_caller_role text;
begin
  v_caller_id := auth.uid();

  select role into v_caller_role
  from public.profiles
  where id = v_caller_id;

  if v_caller_role != 'owner' then
    return jsonb_build_object('error', 'Sirf owner session switch kar sakta hai');
  end if;

  -- verify session belongs to this branch
  select * into v_session
  from public.sessions
  where id = p_new_session_id
    and branch_id = p_branch_id;

  if not found then
    return jsonb_build_object('error', 'Session is branch ka nahi hai');
  end if;

  -- already the active session
  if v_session.is_active then
    return jsonb_build_object('error', 'Ye session pehle se active hai');
  end if;

  -- atomic switch: deactivate current, activate target
  update public.sessions
  set is_active = false
  where branch_id = p_branch_id
    and is_active = true;

  update public.sessions
  set is_active = true
  where id = p_new_session_id;

  return jsonb_build_object('success', true);
end;
$fn$;
