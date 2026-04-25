-- ============================================================
-- Migration: Add student_fee column to profiles
-- ============================================================

alter table public.profiles
  add column student_fee numeric(10,2) not null default 0;
