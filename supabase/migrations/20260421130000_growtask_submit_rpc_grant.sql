-- ============================================================
-- Migration: grant Edge Function service role access to
-- award_student_coins and grow_task_submissions
-- 20260421130000_growtask_submit_rpc_grant.sql
-- ============================================================

-- Service role already bypasses RLS, but explicitly grant
-- execute on the helper so it can be called from Edge Functions.
grant execute on function public.award_student_coins(uuid, uuid, text, integer, text, uuid)
  to service_role;
