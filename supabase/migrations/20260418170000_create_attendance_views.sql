-- ============================================================
-- Migration: attendance views
-- Join attendance records with profile names so screens
-- don't need separate profile fetches.
-- RLS is inherited from the underlying tables.
-- ============================================================

-- Teacher attendance with teacher name + who marked it
create or replace view public.teacher_attendance_with_name as
select
  ta.id,
  ta.school_id,
  ta.branch_id,
  ta.session_id,
  ta.teacher_id,
  ta.date,
  ta.status,
  ta.marked_by,
  ta.note,
  ta.created_at,
  ta.updated_at,
  p.name        as teacher_name,
  p.avatar_url  as teacher_avatar,
  mb.name       as marked_by_name
from public.teacher_attendance ta
join  public.profiles p  on p.id  = ta.teacher_id
left join public.profiles mb on mb.id = ta.marked_by;

grant select on public.teacher_attendance_with_name to authenticated;

-- Student attendance with student name + who marked it
create or replace view public.student_attendance_with_name as
select
  sa.id,
  sa.school_id,
  sa.branch_id,
  sa.session_id,
  sa.class_id,
  sa.student_id,
  sa.date,
  sa.status,
  sa.marked_by,
  sa.note,
  sa.created_at,
  sa.updated_at,
  p.name        as student_name,
  p.avatar_url  as student_avatar,
  mb.name       as marked_by_name
from public.student_attendance sa
join  public.profiles p  on p.id  = sa.student_id
left join public.profiles mb on mb.id = sa.marked_by;

grant select on public.student_attendance_with_name to authenticated;
