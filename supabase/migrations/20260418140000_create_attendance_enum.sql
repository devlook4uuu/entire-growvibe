-- ============================================================
-- Migration: attendance_status enum
-- Shared by both teacher_attendance and student_attendance.
-- ============================================================

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'late', 'leave');
exception when duplicate_object then null; end $$;
