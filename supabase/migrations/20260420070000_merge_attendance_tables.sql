-- ============================================================
-- Migration: merge teacher_attendance + student_attendance
--            into a single  public.attendance  table.
--
-- Strategy
-- ────────
-- 1. Create the new table (person_id + role distinguish records).
-- 2. Migrate existing data from both old tables.
-- 3. Drop old tables (cascades views, triggers, policies).
-- 4. Re-create RPCs with identical signatures so all app code
--    continues to work without changes.
-- 5. Re-create RLS policies.
-- 6. Re-create the _with_name views (now both point at attendance).
-- ============================================================

-- ─── 1. New unified table ────────────────────────────────────────────────────

create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  branch_id   uuid not null references public.branches(id)  on delete cascade,
  session_id  uuid not null references public.sessions(id)  on delete cascade,

  -- Who the record is for
  person_id   uuid not null references public.profiles(id)  on delete cascade,
  role        text not null check (role in ('teacher', 'student')),

  -- Only populated for student records
  class_id    uuid references public.classes(id) on delete cascade,

  date        date    not null,
  status      public.attendance_status not null,
  marked_by   uuid references public.profiles(id),
  note        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (person_id, session_id, date)
);

create index att_school_id_idx   on public.attendance (school_id);
create index att_branch_id_idx   on public.attendance (branch_id);
create index att_session_id_idx  on public.attendance (session_id);
create index att_person_id_idx   on public.attendance (person_id);
create index att_class_id_idx    on public.attendance (class_id);
create index att_date_idx        on public.attendance (date);
create index att_role_idx        on public.attendance (role);

-- updated_at trigger
create or replace function public.set_attendance_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger attendance_updated_at_trigger
  before update on public.attendance
  for each row execute function public.set_attendance_updated_at();

-- ─── 2. Migrate existing data ────────────────────────────────────────────────

insert into public.attendance
  (id, school_id, branch_id, session_id, person_id, role, class_id, date, status, marked_by, note, created_at, updated_at)
select
  id, school_id, branch_id, session_id, teacher_id, 'teacher', null, date, status, marked_by, note, created_at, updated_at
from public.teacher_attendance;

insert into public.attendance
  (id, school_id, branch_id, session_id, person_id, role, class_id, date, status, marked_by, note, created_at, updated_at)
select
  id, school_id, branch_id, session_id, student_id, 'student', class_id, date, status, marked_by, note, created_at, updated_at
from public.student_attendance;

-- ─── 3. Drop old tables (views, triggers, policies cascade) ─────────────────

drop view  if exists public.teacher_attendance_with_name;
drop view  if exists public.student_attendance_with_name;
drop table if exists public.teacher_attendance cascade;
drop table if exists public.student_attendance cascade;

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

alter table public.attendance enable row level security;

-- Admin: full access
create policy "att: admin all"
  on public.attendance for all
  to authenticated
  using  (exists (select 1 from public.get_my_profile() p where p.role = 'admin'))
  with check (exists (select 1 from public.get_my_profile() p where p.role = 'admin'));

-- Owner: full access within their school
create policy "att: owner all"
  on public.attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = attendance.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = attendance.school_id)
  );

-- Principal / Coordinator: full access within their branch
create policy "att: branch staff all"
  on public.attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = attendance.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = attendance.branch_id)
  );

-- Teacher: INSERT own self-attendance record (role='teacher'), SELECT own records.
-- Also: SELECT student attendance for their assigned class.
create policy "att: teacher insert own"
  on public.attendance for insert
  with check (
    exists (select 1 from public.get_my_profile() p where p.role = 'teacher')
    and person_id = auth.uid()
    and role = 'teacher'
  );

create policy "att: teacher select own"
  on public.attendance for select
  using (
    attendance.role = 'teacher' and person_id = auth.uid()
  );

create policy "att: teacher select class students"
  on public.attendance for select
  using (
    attendance.role = 'student'
    and exists (
      select 1 from public.classes c
      where c.teacher_id = auth.uid()
        and c.id = attendance.class_id
    )
  );

-- Student: SELECT their own attendance records only
create policy "att: student self select"
  on public.attendance for select
  using (
    attendance.role = 'student' and person_id = auth.uid()
  );

-- ─── 5. RPCs (identical signatures — no app code changes needed) ─────────────

-- 5a. upsert_teacher_attendance
create or replace function public.upsert_teacher_attendance(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_teacher_id uuid,
  p_date       date,
  p_status     public.attendance_status,
  p_note       text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.attendance;
begin
  insert into public.attendance
    (school_id, branch_id, session_id, person_id, role, class_id, date, status, marked_by, note)
  values
    (p_school_id, p_branch_id, p_session_id, p_teacher_id, 'teacher', null, p_date, p_status, auth.uid(), p_note)
  on conflict (person_id, session_id, date) do update
    set status     = excluded.status,
        marked_by  = auth.uid(),
        note       = excluded.note,
        updated_at = now()
  returning * into v_record;

  return v_record;
end;
$$;

grant execute on function public.upsert_teacher_attendance(
  uuid, uuid, uuid, uuid, date, public.attendance_status, text
) to authenticated;

-- 5b. upsert_class_attendance (bulk, security definer to bypass RLS for upsert path)
create or replace function public.upsert_class_attendance(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_class_id   uuid,
  p_date       date,
  p_records    jsonb   -- [{ student_id, status, note? }, ...]
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
    insert into public.attendance
      (school_id, branch_id, session_id, person_id, role, class_id, date, status, marked_by, note)
    values (
      p_school_id,
      p_branch_id,
      p_session_id,
      (r->>'student_id')::uuid,
      'student',
      p_class_id,
      p_date,
      (r->>'status')::public.attendance_status,
      auth.uid(),
      r->>'note'
    )
    on conflict (person_id, session_id, date) do update
      set status     = excluded.status,
          marked_by  = auth.uid(),
          note       = excluded.note,
          updated_at = now();
  end loop;
end;
$$;

grant execute on function public.upsert_class_attendance(
  uuid, uuid, uuid, uuid, date, jsonb
) to authenticated;

-- ─── 6. Recreate views ───────────────────────────────────────────────────────

-- Teacher attendance view (backwards-compatible column names)
create or replace view public.teacher_attendance_with_name as
select
  a.id,
  a.school_id,
  a.branch_id,
  a.session_id,
  a.person_id   as teacher_id,
  a.date,
  a.status,
  a.marked_by,
  a.note,
  a.created_at,
  a.updated_at,
  p.name        as teacher_name,
  p.avatar_url  as teacher_avatar,
  mb.name       as marked_by_name
from public.attendance a
join  public.profiles p  on p.id  = a.person_id
left join public.profiles mb on mb.id = a.marked_by
where a.role = 'teacher';

grant select on public.teacher_attendance_with_name to authenticated;

-- Student attendance view (backwards-compatible column names)
create or replace view public.student_attendance_with_name as
select
  a.id,
  a.school_id,
  a.branch_id,
  a.session_id,
  a.class_id,
  a.person_id   as student_id,
  a.date,
  a.status,
  a.marked_by,
  a.note,
  a.created_at,
  a.updated_at,
  p.name        as student_name,
  p.avatar_url  as student_avatar,
  mb.name       as marked_by_name
from public.attendance a
join  public.profiles p  on p.id  = a.person_id
left join public.profiles mb on mb.id = a.marked_by
where a.role = 'student';

grant select on public.student_attendance_with_name to authenticated;
