-- Allow all school staff (principal, coordinator, teacher, student) to read
-- sessions that belong to their school
create policy "sessions: school staff read"
  on public.sessions
  for select
  using (
    exists (
      select 1 from get_my_profile() p
      where p.role in ('principal', 'coordinator', 'teacher', 'student')
        and p.school_id = sessions.school_id
    )
  );
