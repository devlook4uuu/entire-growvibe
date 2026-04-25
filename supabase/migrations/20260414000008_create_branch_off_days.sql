-- Table: branch_off_days
-- Stores the fixed weekly off-day schedule for a branch.
-- Each row is one off day (e.g. 'friday', 'saturday', 'sunday').
-- A branch can have multiple rows (one per off day).
-- day_of_week is constrained to the 7 lowercase day names.

create table public.branch_off_days (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references public.branches(id) on delete cascade,
  day_of_week  text not null check (
                 day_of_week in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')
               ),
  created_at   timestamptz not null default now(),
  unique (branch_id, day_of_week)   -- one row per day per branch
);

create index branch_off_days_branch_id_idx on public.branch_off_days(branch_id);

alter table public.branch_off_days enable row level security;

create policy "branch_off_days: admin select"
  on public.branch_off_days for select
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

create policy "branch_off_days: member select"
  on public.branch_off_days for select
  using (
    branch_id in (
      select id from public.branches
      where school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
    )
  );

create policy "branch_off_days: admin insert"
  on public.branch_off_days for insert
  with check (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );

create policy "branch_off_days: admin delete"
  on public.branch_off_days for delete
  using (
    (select role from public.profiles where id = auth.uid() limit 1) = 'admin'
  );
