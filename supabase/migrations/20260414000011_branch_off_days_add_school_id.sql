-- Add school_id to branch_off_days for direct school-scoped queries and RLS.
-- Populated from the parent branch's school_id.

alter table public.branch_off_days
  add column school_id uuid references public.schools(id) on delete cascade;

-- Backfill from branches
update public.branch_off_days od
set school_id = b.school_id
from public.branches b
where b.id = od.branch_id;

-- Now enforce not null
alter table public.branch_off_days
  alter column school_id set not null;

create index branch_off_days_school_id_idx on public.branch_off_days(school_id);

-- Replace the member select policy to use school_id directly (no subquery join needed)
drop policy if exists "branch_off_days: member select" on public.branch_off_days;

create policy "branch_off_days: member select"
  on public.branch_off_days for select
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );
