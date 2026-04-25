-- ============================================================
-- Migration: schedule coin distribution cron jobs
-- 20260421120000_coin_cron_schedule.sql
--
-- Run this AFTER enabling pg_cron in Supabase dashboard:
-- Dashboard → Database → Extensions → pg_cron → Enable
--
-- Functions (award_student_coins, run_weekly_attendance_coins,
-- run_monthly_attendance_coins) were created in 20260421110000.
-- ============================================================

-- Remove existing schedules if they exist (safe to re-run)
select cron.unschedule(jobid)
from cron.job
where jobname in ('weekly-attendance-coins', 'monthly-attendance-coins');

-- Every Saturday at 18:00 UTC (11:00 PM PKT)
select cron.schedule(
  'weekly-attendance-coins',
  '0 18 * * 6',
  'select public.run_weekly_attendance_coins();'
);

-- Days 28-31 at 19:00 UTC (12:00 AM PKT = 1st of next month)
-- Guard clause inside ensures it only fires on the true last day of the month
select cron.schedule(
  'monthly-attendance-coins',
  '0 19 28-31 * *',
  'select public.run_monthly_attendance_coins() where (current_date + interval ''1 day'')::date = date_trunc(''month'', current_date + interval ''1 day'')::date;'
);
