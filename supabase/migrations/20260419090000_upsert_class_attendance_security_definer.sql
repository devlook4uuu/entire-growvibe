-- Make upsert_class_attendance run as the function owner (bypasses RLS).
-- The function is trusted server-side logic; callers are already authenticated
-- and the app enforces who can call it (teacher = today only, managers = any date).

create or replace function public.upsert_class_attendance(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_class_id   uuid,
  p_date       date,
  p_records    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(p_records)
  loop
    insert into public.student_attendance
      (school_id, branch_id, session_id, class_id, student_id, date, status, marked_by, note)
    values (
      p_school_id,
      p_branch_id,
      p_session_id,
      p_class_id,
      (r->>'student_id')::uuid,
      p_date,
      (r->>'status')::public.attendance_status,
      auth.uid(),
      r->>'note'
    )
    on conflict (student_id, session_id, date) do update
      set status     = excluded.status,
          marked_by  = auth.uid(),
          note       = excluded.note,
          updated_at = now();
  end loop;
end;
$$;
