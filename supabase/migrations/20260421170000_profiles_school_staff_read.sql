-- Allow principals and coordinators to read all profiles in their school
-- (needed for group chat management — e.g. viewing owners to add to chats)
create policy "profiles: school staff read school"
  on public.profiles
  for select
  using (
    exists (
      select 1 from get_my_profile() p
      where p.role in ('principal', 'coordinator')
        and p.school_id = profiles.school_id
    )
  );
