-- Teacher: read their own assigned class
create policy "classes: teacher select own"
  on public.classes for select
  using (teacher_id = auth.uid());

-- Teacher: read students in their own class
create policy "profiles: teacher read own class students"
  on public.profiles for select
  using (
    exists (
      select 1 from public.classes c
      where c.teacher_id = auth.uid()
        and c.id = profiles.class_id
    )
  );
