-- ============================================================
-- Migration: coin distribution cron jobs
-- 20260421110000_coin_cron_jobs.sql
--
-- Requires pg_cron extension enabled in Supabase dashboard.
-- Both functions run as SECURITY DEFINER so they bypass RLS
-- and can write to profiles / coin tables freely.
-- ============================================================

-- ── Helper: award coins to one student ───────────────────────
-- Inserts grow_task_submissions + coin_transactions + updates
-- profiles.grow_coins in one atomic block.
-- Returns true if awarded, false if already existed (idempotent).
create or replace function public.award_student_coins(
  p_student_id   uuid,
  p_grow_task_id uuid,
  p_cycle_label  text,
  p_coins        integer,
  p_source       text,
  p_school_id    uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn_award$
declare
  v_submission_id uuid;
  v_balance_after integer;
begin
  -- Idempotency: skip if already awarded for this cycle
  if exists (
    select 1 from public.grow_task_submissions
    where student_id = p_student_id
      and grow_task_id = p_grow_task_id
      and cycle_label  = p_cycle_label
  ) then
    return false;
  end if;

  -- Insert submission
  insert into public.grow_task_submissions
    (student_id, grow_task_id, awarded_by, cycle_label, coins_awarded, school_id)
  values
    (p_student_id, p_grow_task_id, null, p_cycle_label, p_coins, p_school_id)
  returning id into v_submission_id;

  -- Update profile balance
  update public.profiles
  set grow_coins = grow_coins + p_coins
  where id = p_student_id
  returning grow_coins into v_balance_after;

  -- Insert ledger entry
  insert into public.coin_transactions
    (student_id, type, amount, source, reference_id, balance_after, school_id)
  values
    (p_student_id, 'earn', p_coins, p_source, v_submission_id, v_balance_after, p_school_id);

  return true;
end;
$fn_award$;

-- ── Weekly job function ───────────────────────────────────────
-- Runs every Saturday at 18:00 UTC (11:00 PM PKT).
-- Awards 50 coins to students who were present/late on ALL
-- marked days of the Mon–Fri week that just ended.
-- cycle_label format: '2026-W16'  (ISO week of the week evaluated)
create or replace function public.run_weekly_attendance_coins()
returns void
language plpgsql
security definer
set search_path = public
as $fn_weekly$
declare
  v_task_id     uuid;
  v_week_start  date;   -- Monday of the week being evaluated
  v_week_end    date;   -- Friday of the week being evaluated
  v_cycle_label text;

  v_class       record;
  v_student     record;
  v_marked_days integer;
  v_present_days integer;
begin
  -- The week being evaluated: Monday to Friday of the current week
  -- (Saturday is just when the job runs)
  v_week_start  := date_trunc('week', current_date)::date;          -- Monday
  v_week_end    := v_week_start + interval '4 days';                 -- Friday
  v_cycle_label := to_char(current_date, 'IYYY') || '-W' || to_char(current_date, 'IW');

  -- Get the weekly attendance task id
  select id into v_task_id
  from public.grow_tasks
  where category = 'attendance_weekly' and is_active = true
  limit 1;

  if v_task_id is null then return; end if;

  -- Loop over every active class
  for v_class in
    select c.id as class_id, c.session_id, c.school_id
    from public.classes c
  loop
    -- How many distinct days were marked for this class this week?
    select count(distinct a.date) into v_marked_days
    from public.attendance a
    where a.class_id   = v_class.class_id
      and a.session_id = v_class.session_id
      and a.role       = 'student'
      and a.date between v_week_start and v_week_end;

    -- Skip class if no attendance was marked at all
    if v_marked_days = 0 then continue; end if;

    -- Loop over every student in this class
    for v_student in
      select p.id as student_id
      from public.profiles p
      where p.class_id  = v_class.class_id
        and p.role      = 'student'
        and p.is_active = true
    loop
      -- Count present + late days for this student this week
      select count(*) into v_present_days
      from public.attendance a
      where a.person_id  = v_student.student_id
        and a.session_id = v_class.session_id
        and a.role       = 'student'
        and a.date between v_week_start and v_week_end
        and a.status in ('present', 'late');

      -- Award only if present on ALL marked days (100%)
      if v_present_days = v_marked_days then
        perform public.award_student_coins(
          v_student.student_id,
          v_task_id,
          v_cycle_label,
          50,
          'attendance_weekly',
          v_class.school_id
        );
      end if;
    end loop;
  end loop;
end;
$fn_weekly$;

-- ── Monthly job function ──────────────────────────────────────
-- Runs at 19:00 UTC on the last day of every month
-- (12:00 AM PKT on the 1st of next month).
-- Awards 100 coins to students with 80%+ present/late of
-- marked days in the previous calendar month.
-- cycle_label format: '2026-04'
create or replace function public.run_monthly_attendance_coins()
returns void
language plpgsql
security definer
set search_path = public
as $fn_monthly$
declare
  v_task_id      uuid;
  v_month_start  date;
  v_month_end    date;
  v_cycle_label  text;

  v_class        record;
  v_student      record;
  v_marked_days  integer;
  v_present_days integer;
begin
  -- The month being evaluated is the current month
  -- (job runs on the last day of the month at 19:00 UTC)
  v_month_start := date_trunc('month', current_date)::date;
  v_month_end   := current_date;  -- last day of the month
  v_cycle_label := to_char(current_date, 'YYYY-MM');

  -- Get the monthly attendance task id
  select id into v_task_id
  from public.grow_tasks
  where category = 'attendance_monthly' and is_active = true
  limit 1;

  if v_task_id is null then return; end if;

  -- Loop over every active class
  for v_class in
    select c.id as class_id, c.session_id, c.school_id
    from public.classes c
  loop
    -- How many distinct days were marked for this class this month?
    select count(distinct a.date) into v_marked_days
    from public.attendance a
    where a.class_id   = v_class.class_id
      and a.session_id = v_class.session_id
      and a.role       = 'student'
      and a.date between v_month_start and v_month_end;

    if v_marked_days = 0 then continue; end if;

    -- Loop over every student in this class
    for v_student in
      select p.id as student_id
      from public.profiles p
      where p.class_id  = v_class.class_id
        and p.role      = 'student'
        and p.is_active = true
    loop
      -- Count present + late days for this student this month
      select count(*) into v_present_days
      from public.attendance a
      where a.person_id  = v_student.student_id
        and a.session_id = v_class.session_id
        and a.role       = 'student'
        and a.date between v_month_start and v_month_end
        and a.status in ('present', 'late');

      -- Award if present/late on 80%+ of marked days
      if v_marked_days > 0
        and (v_present_days::numeric / v_marked_days) >= 0.80
      then
        perform public.award_student_coins(
          v_student.student_id,
          v_task_id,
          v_cycle_label,
          100,
          'attendance_monthly',
          v_class.school_id
        );
      end if;
    end loop;
  end loop;
end;
$fn_monthly$;

-- Cron scheduling is in 20260421120000_coin_cron_schedule.sql
-- Run that file after enabling pg_cron in Supabase dashboard.
