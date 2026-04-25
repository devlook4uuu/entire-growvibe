-- ============================================================
-- Migration: class_diary table
-- 20260424180000_create_class_diary.sql
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────
create table public.class_diary (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)  on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete cascade,
  class_id    uuid not null references public.classes(id)  on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete restrict,

  title       text not null,
  description text,

  -- subjects is an array of {subject_name, todo} objects stored as jsonb
  subjects    jsonb not null default '[]'::jsonb,

  expire_date date not null,   -- diary is hidden / hard-deleted after this date
  is_deleted  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
create index class_diary_school_id_idx   on public.class_diary (school_id);
create index class_diary_class_id_idx    on public.class_diary (class_id);
create index class_diary_expire_date_idx on public.class_diary (expire_date);

-- ── Updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only create trigger if it does not already exist (function is shared)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_at_class_diary'
      and tgrelid = 'public.class_diary'::regclass
  ) then
    create trigger set_updated_at_class_diary
      before update on public.class_diary
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.class_diary enable row level security;

-- Admin: full access
create policy "class_diary: admin all"
  on public.class_diary for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Owner: school-scoped full access
create policy "class_diary: owner all"
  on public.class_diary for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and school_id = class_diary.school_id))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and school_id = class_diary.school_id));

-- Principal / Coordinator: school-scoped read + write
create policy "class_diary: principal coordinator all"
  on public.class_diary for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role in ('principal','coordinator') and school_id = class_diary.school_id))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('principal','coordinator') and school_id = class_diary.school_id));

-- Teacher (incharge): insert into own class, update/delete own diaries, read own class
create policy "class_diary: teacher insert"
  on public.class_diary for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher' and class_id = class_diary.class_id
    )
  );

create policy "class_diary: teacher update own"
  on public.class_diary for update
  using  (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "class_diary: teacher delete own"
  on public.class_diary for delete
  using  (auth.uid() = created_by);

create policy "class_diary: teacher read own class"
  on public.class_diary for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher' and class_id = class_diary.class_id
    )
  );

-- Student: read diaries for own class (non-deleted, non-expired)
create policy "class_diary: student read"
  on public.class_diary for select
  using (
    is_deleted = false
    and expire_date >= current_date
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'student' and class_id = class_diary.class_id
    )
  );
