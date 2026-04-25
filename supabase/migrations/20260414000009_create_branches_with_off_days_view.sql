-- View: branches_with_off_days
-- Branches joined with their aggregated off-day list.
-- off_days is a JSON array of day strings, e.g. ["friday","saturday"]
-- sorted by day order (monday=1 … sunday=7).

create or replace view public.branches_with_off_days as
select
  b.id,
  b.school_id,
  b.name,
  b.branch_address,
  b.branch_contact,
  b.branch_subscription_fee,
  b.is_active,
  b.created_at,
  b.updated_at,
  coalesce(
    json_agg(
      od.day_of_week
      order by
        case od.day_of_week
          when 'monday'    then 1
          when 'tuesday'   then 2
          when 'wednesday' then 3
          when 'thursday'  then 4
          when 'friday'    then 5
          when 'saturday'  then 6
          when 'sunday'    then 7
        end
    ) filter (where od.day_of_week is not null),
    '[]'::json
  ) as off_days
from public.branches b
left join public.branch_off_days od on od.branch_id = b.id
group by b.id;

grant select on public.branches_with_off_days to authenticated;
