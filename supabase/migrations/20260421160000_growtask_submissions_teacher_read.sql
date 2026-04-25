-- Allow teachers to read their own submitted rows
create policy "grow_task_submissions: teacher read own"
  on public.grow_task_submissions
  for select
  using (awarded_by = auth.uid());
