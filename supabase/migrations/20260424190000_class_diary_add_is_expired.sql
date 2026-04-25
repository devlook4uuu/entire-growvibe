-- ============================================================
-- Migration: class_diary — replace is_deleted with is_expired
-- 20260424190000_class_diary_add_is_expired.sql
-- ============================================================

-- Add is_expired column (manual override by teacher)
alter table public.class_diary
  add column if not exists is_expired boolean not null default false;

-- Drop the old is_deleted column (no longer used)
alter table public.class_diary
  drop column if exists is_deleted;

-- Drop old student RLS policy and recreate with is_expired check
drop policy if exists "class_diary: student read" on public.class_diary;

create policy "class_diary: student read"
  on public.class_diary for select
  using (
    is_expired = false
    and expire_date >= current_date
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'student' and class_id = class_diary.class_id
    )
  );

-- Allow teacher to update is_expired on own diaries (already covered by teacher update own policy)
-- No additional policy needed.
