-- ============================================================
-- Migration: coin tables + grow_tasks seed
-- 20260421100000_coin_tables.sql
-- ============================================================

-- ── 1. profiles: add total_coins_spent ───────────────────────
alter table public.profiles
  add column if not exists total_coins_spent integer not null default 0;

-- ── 2. grow_tasks ────────────────────────────────────────────
create table public.grow_tasks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,         -- e.g. 'attendance', 'discipline'
  coins_reward integer not null,
  cycle        text not null,         -- 'weekly' | 'monthly'
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.grow_tasks enable row level security;

-- Everyone can read active tasks; only service_role can write
create policy "grow_tasks: read active"
  on public.grow_tasks for select
  using (is_active = true);

-- ── 3. grow_task_submissions ─────────────────────────────────
create table public.grow_task_submissions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  grow_task_id uuid not null references public.grow_tasks(id) on delete cascade,
  awarded_by   uuid references public.profiles(id) on delete set null,  -- null for cron
  cycle_label  text not null,          -- e.g. '2026-W16' or '2026-04'
  coins_awarded integer not null,
  school_id    uuid not null references public.schools(id) on delete cascade,
  created_at   timestamptz not null default now(),

  unique (student_id, grow_task_id, cycle_label)
);

alter table public.grow_task_submissions enable row level security;

create policy "grow_task_submissions: student read own"
  on public.grow_task_submissions for select
  using (student_id = auth.uid());

create index on public.grow_task_submissions (student_id, cycle_label);
create index on public.grow_task_submissions (grow_task_id, cycle_label);

-- ── 4. coin_transactions ─────────────────────────────────────
create table public.coin_transactions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in ('earn', 'spend')),
  amount       integer not null,       -- always positive
  source       text not null,          -- 'attendance_weekly' | 'attendance_monthly' | 'growtask_discipline' | etc.
  reference_id uuid,                   -- grow_task_submissions.id that caused this
  balance_after integer not null,
  school_id    uuid not null references public.schools(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.coin_transactions enable row level security;

create policy "coin_transactions: student read own"
  on public.coin_transactions for select
  using (student_id = auth.uid());

create index on public.coin_transactions (student_id, created_at desc);

-- ── 5. Seed grow_tasks ────────────────────────────────────────
insert into public.grow_tasks (name, category, coins_reward, cycle) values
  ('Weekly 100% Attendance',   'attendance_weekly',   50,  'weekly'),
  ('Monthly 80%+ Attendance',  'attendance_monthly',  100, 'monthly'),
  ('Discipline Improved',      'discipline',          30,  'weekly'),
  ('Cleanliness Improved',     'cleanliness',         30,  'weekly'),
  ('Study Improved',           'study',               30,  'weekly');
