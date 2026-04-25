-- View: schools_with_details
-- Schools joined with their owner's name/email/avatar, active branch count,
-- and total subscription fee across active branches only.

create or replace view public.schools_with_details as
select
  s.id,
  s.name,
  s.logo_url,
  s.school_address,
  s.school_contact,
  s.is_active,
  s.owner_id,
  s.created_at,
  s.updated_at,
  p.name        as owner_name,
  p.email       as owner_email,
  p.avatar_url  as owner_avatar_url,
  coalesce(
    sum(b.branch_subscription_fee) filter (where b.is_active = true),
    0
  )::numeric(10,2)              as total_subscription_fee,
  count(b.id) filter (where b.is_active = true) as active_branch_count
from public.schools s
left join public.profiles p  on p.id = s.owner_id
left join public.branches b  on b.school_id = s.id
group by s.id, p.id, p.name, p.email, p.avatar_url;

grant select on public.schools_with_details to authenticated;
