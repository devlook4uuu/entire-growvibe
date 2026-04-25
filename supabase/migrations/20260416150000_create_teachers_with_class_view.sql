-- ============================================================
-- Migration: teachers_with_class view
-- Teachers joined with their assigned class name (null if unassigned).
-- ============================================================

create or replace view public.teachers_with_class as
select
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.branch_id,
  p.school_id,
  p.class_id,
  p.created_at,
  p.updated_at,
  c.class_name
from public.profiles p
left join public.classes c on c.id = p.class_id
where p.role = 'teacher';
