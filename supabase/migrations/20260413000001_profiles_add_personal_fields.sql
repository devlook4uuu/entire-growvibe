-- ============================================================
-- Migration 5: Add personal fields to profiles table
-- Adds: bio, interests, date_of_birth, facebook_url, instagram_url
-- ============================================================

alter table public.profiles
  add column if not exists bio            text,
  add column if not exists interests      text[],
  add column if not exists date_of_birth  date,
  add column if not exists facebook_url   text,
  add column if not exists instagram_url  text;
