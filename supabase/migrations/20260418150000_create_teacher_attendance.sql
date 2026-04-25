-- ============================================================
-- Migration: teacher_attendance
-- One record per teacher per date per session.
-- school_id denormalised per CLAUDE.md rule.
-- Teachers can only INSERT their own record (no UPDATE/DELETE).
-- Owners/principals/coordinators can INSERT and UPDATE.
-- ============================================================

create table public.teacher_attendance (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  branch_id   uuid not null references public.branches(id)  on delete cascade,
  session_id  uuid not null references public.sessions(id)  on delete cascade,
  teacher_id  uuid not null references public.profiles(id)  on delete cascade,

  date        date not null,
  status      public.attendance_status not null,
  marked_by   uuid references public.profiles(id),   -- who last created/edited this record
  note        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (teacher_id, session_id, date)
);

create index ta_school_id_idx  on public.teacher_attendance (school_id);
create index ta_branch_id_idx  on public.teacher_attendance (branch_id);
create index ta_session_id_idx on public.teacher_attendance (session_id);
create index ta_teacher_id_idx on public.teacher_attendance (teacher_id);
create index ta_date_idx       on public.teacher_attendance (date);

alter table public.teacher_attendance enable row level security;

-- updated_at trigger
create or replace function public.set_ta_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ta_updated_at_trigger
  before update on public.teacher_attendance
  for each row execute function public.set_ta_updated_at();

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Admin: full access
create policy "ta: admin all"
  on public.teacher_attendance for all
  to authenticated
  using  (exists (select 1 from public.get_my_profile() p where p.role = 'admin'))
  with check (exists (select 1 from public.get_my_profile() p where p.role = 'admin'));

-- Owner: full access within their school
create policy "ta: owner all"
  on public.teacher_attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = teacher_attendance.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = teacher_attendance.school_id)
  );

-- Principal / Coordinator: full access within their branch
create policy "ta: branch staff all"
  on public.teacher_attendance for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = teacher_attendance.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = teacher_attendance.branch_id)
  );

-- Teacher: INSERT only their own record (upsert via RPC), SELECT their own records.
-- No UPDATE or DELETE policy — teacher cannot edit after submission.
create policy "ta: teacher insert own"
  on public.teacher_attendance for insert
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.get_my_profile() p where p.role = 'teacher')
  );

create policy "ta: teacher select own"
  on public.teacher_attendance for select
  using (teacher_id = auth.uid());

-- ─── RPC: upsert_teacher_attendance ──────────────────────────────────────────
-- Managers can call this to mark/edit any teacher's attendance.
-- Teachers can call this only for their own record; RLS blocks anything else.
-- The ON CONFLICT upsert means the first call inserts; subsequent calls by
-- managers update. Teachers have no UPDATE policy so RLS rejects their second call.

create or replace function public.upsert_teacher_attendance(
  p_school_id  uuid,
  p_branch_id  uuid,
  p_session_id uuid,
  p_teacher_id uuid,
  p_date       date,
  p_status     public.attendance_status,
  p_note       text default null
)
returns public.teacher_attendance
language plpgsql
set search_path = public
as $$
declare
  v_record public.teacher_attendance;
begin
  insert into public.teacher_attendance
    (school_id, branch_id, session_id, teacher_id, date, status, marked_by, note)
  values
    (p_school_id, p_branch_id, p_session_id, p_teacher_id, p_date, p_status, auth.uid(), p_note)
  on conflict (teacher_id, session_id, date) do update
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
