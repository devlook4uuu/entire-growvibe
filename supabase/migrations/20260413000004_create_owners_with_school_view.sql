-- View: owners_with_school
-- Joins profiles (role = 'owner') with their assigned school name.
-- Uses the profiles_school_id_fkey relationship (profiles.school_id → schools.id).

create or replace view public.owners_with_school as
select
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.school_id,
  s.name as school_name
from public.profiles p
left join public.schools s on s.id = p.school_id
where p.role = 'owner';

-- Grant read access to authenticated users
grant select on public.owners_with_school to authenticated;
