-- View: available_owners
-- Owners (role = 'owner') who are not yet assigned to any school.
-- Used by schoolForm to populate the owner picker.

create or replace view public.available_owners as
select
  id,
  name,
  email,
  avatar_url
from public.profiles
where role = 'owner'
  and school_id is null;

grant select on public.available_owners to authenticated;
