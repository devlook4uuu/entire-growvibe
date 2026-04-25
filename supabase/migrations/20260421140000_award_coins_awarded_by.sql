-- ============================================================
-- Migration: add awarded_by param to award_student_coins
-- 20260421140000_award_coins_awarded_by.sql
-- ============================================================

create or replace function public.award_student_coins(
  p_student_id   uuid,
  p_grow_task_id uuid,
  p_cycle_label  text,
  p_coins        integer,
  p_source       text,
  p_school_id    uuid,
  p_awarded_by   uuid default null   -- null for cron, teacher uuid for manual awards
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn_award$
declare
  v_submission_id uuid;
  v_balance_after integer;
begin
  if exists (
    select 1 from public.grow_task_submissions
    where student_id   = p_student_id
      and grow_task_id = p_grow_task_id
      and cycle_label  = p_cycle_label
  ) then
    return false;
  end if;

  insert into public.grow_task_submissions
    (student_id, grow_task_id, awarded_by, cycle_label, coins_awarded, school_id)
  values
    (p_student_id, p_grow_task_id, p_awarded_by, p_cycle_label, p_coins, p_school_id)
  returning id into v_submission_id;

  update public.profiles
  set grow_coins = grow_coins + p_coins
  where id = p_student_id
  returning grow_coins into v_balance_after;

  insert into public.coin_transactions
    (student_id, type, amount, source, reference_id, balance_after, school_id)
  values
    (p_student_id, 'earn', p_coins, p_source, v_submission_id, v_balance_after, p_school_id);

  return true;
end;
$fn_award$;

grant execute on function public.award_student_coins(uuid, uuid, text, integer, text, uuid, uuid)
  to service_role;
