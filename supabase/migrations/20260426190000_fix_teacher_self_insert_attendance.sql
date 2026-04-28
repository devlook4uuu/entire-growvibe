-- Migration: remove att: teacher insert own RLS policy
-- Teachers should NOT be able to insert their own attendance record.
-- Teacher attendance is marked by principal/coordinator via upsert_teacher_attendance RPC,
-- which runs as SECURITY DEFINER and is covered by att: branch staff all.
-- Dropping this policy entirely prevents any self-marking path.

drop policy if exists "att: teacher insert own" on public.attendance;
