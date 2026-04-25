-- ============================================================
-- Migration: student_attendance
-- One record per student per date per session.
-- school_id denormalised per CLAUDE.md rule.
-- Only the class incharge teacher can INSERT records for their class.
-- Teachers cannot UPDATE or DELETE — only managers can.
-- ============================================================

create table public.student_attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  branch_id   uuid not null references public.branches(id)  on delete cascade,
  session_id  uuid not null references public.sessions(id)  on delete cascade,
  class_id    uuid not null references public.classes(id)   on delete cascade,
  student_id  uuid not null references public.profiles(id)  on delete cascade,

  date        date not null,
  status      public.attendance_status not null,
  marked_by   uuid references public.profiles(id),
  note        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (student_id, session_id, date)
);

create index sa_school_id_idx  on public.student_attendance (school_id);
create index sa_branch_id_idx  on public.student_attendance (branch_id);
create index sa_session_id_idx on public.student_attendance (session_id);
create index sa_class_id_idx   on public.student_attendance (class_id);
create index sa_student_id_idx on public.student_attendance (student_id);
create index sa_date_idx       on public.student_attendance (date);

alter table public.student_attendance enable row level security;

-- updated_at trigger
create or replace function public.set_sa_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sa_updated_at_trigger
  before update on public.student_attendance
  for each row execute function public.set_sa_updated_at();

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Admin: full access
create policy "sa: admin all"
  on public.student_attendance for all
  to authenticated
  using  (exists (select 1 from public.get_my_profile() p where p.role = 'admin'))
  with check (exists (select 1 from public.get_my_profile() p where p.role = 'admin'));

-- Owner: full access within their school
create policy "sa: owner all"
  on public.student_attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = student_attendance.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = student_attendance.school_id)
  );

-- Principal / Coordinator: full access within their branch
create policy "sa: branch staff all"
  on public.student_attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = student_attendance.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = student_attendance.branch_id)
  );

-- Teacher: INSERT records only for their assigned class, SELECT records for their class.
-- No UPDATE or DELETE — teacher cannot edit submitted attendance.
create policy "sa: teacher insert class"
  on public.student_attendance for insert
  with check (
    exists (
      select 1 from public.get_my_profile() p
      join public.classes c on c.id = student_attendance.class_id
      where p.role = 'teacher' and c.teacher_id = auth.uid()
    )
  );

create policy "sa: teacher select class"
  on public.student_attendance for select
  using (
    exists (
      select 1 from public.get_my_profile() p
      join public.classes c on c.id = student_attendance.class_id
      where p.role = 'teacher' and c.teacher_id = auth.uid()
    )
  );

-- Student: read their own attendance only
create policy "sa: student self select"
  on public.student_attendance for select
  using (student_id = auth.uid());

-- ─── RPC: upsert_class_attendance ────────────────────────────────────────────
-- Bulk upsert attendance for an entire class on one date.
-- Accepts a JSONB array of { student_id, status, note? }.
-- One network call replaces N individual calls for a full class.
-- RLS on the table governs who can call this effectively.

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

grant execute on function public.upsert_class_attendance(
  uuid, uuid, uuid, uuid, date, jsonb
) to authenticated;
