-- ============================================================
-- Migration: student_fee_records
-- Stores monthly fee payment records per student.
-- school_id denormalised per CLAUDE.md rule.
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.fee_payment_method as enum ('cash', 'bank_transfer', 'cheque', 'online');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fee_payment_status as enum ('paid', 'partial', 'unpaid');
exception when duplicate_object then null; end $$;

-- ─── Table ───────────────────────────────────────────────────────────────────

create table public.student_fee_records (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id)   on delete cascade,
  branch_id       uuid not null references public.branches(id)  on delete cascade,
  session_id      uuid not null references public.sessions(id)  on delete cascade,
  class_id        uuid not null references public.classes(id)   on delete cascade,
  student_id      uuid not null references public.profiles(id)  on delete cascade,

  -- Fee details
  month           text not null,   -- 'YYYY-MM', e.g. '2026-04'
  fee_amount      numeric(12, 2) not null default 0,
  amount_paid     numeric(12, 2) not null default 0,
  payment_method  public.fee_payment_method,
  payment_status  public.fee_payment_status not null default 'unpaid',
  description     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One record per student per month per session
  unique (student_id, session_id, month)
);

-- Indexes
create index sfr_school_id_idx   on public.student_fee_records (school_id);
create index sfr_branch_id_idx   on public.student_fee_records (branch_id);
create index sfr_session_id_idx  on public.student_fee_records (session_id);
create index sfr_class_id_idx    on public.student_fee_records (class_id);
create index sfr_student_id_idx  on public.student_fee_records (student_id);
create index sfr_month_idx       on public.student_fee_records (month);

alter table public.student_fee_records enable row level security;


-- ─── Computed column: remaining ───────────────────────────────────────────────
-- Not stored — always derived. Use: fee_amount - amount_paid in queries / app.


-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Admin: full access
create policy "sfr: admin all"
  on public.student_fee_records for all
  to authenticated
  using  (exists (select 1 from public.get_my_profile() p where p.role = 'admin'))
  with check (exists (select 1 from public.get_my_profile() p where p.role = 'admin'));

-- Owner: full access within their school
create policy "sfr: owner all"
  on public.student_fee_records for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = student_fee_records.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = student_fee_records.school_id)
  );

-- Principal / coordinator: full access within their branch
create policy "sfr: branch staff all"
  on public.student_fee_records for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = student_fee_records.branch_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role in ('principal', 'coordinator')
              and p.branch_id = student_fee_records.branch_id)
  );

-- Student: can only read their own records
create policy "sfr: student self select"
  on public.student_fee_records for select
  using (student_id = auth.uid());


-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.set_sfr_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sfr_updated_at_trigger
  before update on public.student_fee_records
  for each row execute function public.set_sfr_updated_at();


-- ─── RPC: upsert_fee_record ───────────────────────────────────────────────────
-- Atomically insert or update a fee record.
-- Also auto-computes payment_status from fee_amount vs amount_paid.

create or replace function public.upsert_fee_record(
  p_school_id      uuid,
  p_branch_id      uuid,
  p_session_id     uuid,
  p_class_id       uuid,
  p_student_id     uuid,
  p_month          text,
  p_fee_amount     numeric,
  p_amount_paid    numeric,
  p_payment_method public.fee_payment_method default null,
  p_description    text default null
)
returns public.student_fee_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.fee_payment_status;
  v_record public.student_fee_records;
begin
  -- Derive status
  if p_amount_paid >= p_fee_amount then
    v_status := 'paid';
  elsif p_amount_paid > 0 then
    v_status := 'partial';
  else
    v_status := 'unpaid';
  end if;

  insert into public.student_fee_records (
    school_id, branch_id, session_id, class_id, student_id,
    month, fee_amount, amount_paid, payment_method, payment_status, description
  ) values (
    p_school_id, p_branch_id, p_session_id, p_class_id, p_student_id,
    p_month, p_fee_amount, p_amount_paid, p_payment_method, v_status, p_description
  )
  on conflict (student_id, session_id, month) do update
    set fee_amount     = excluded.fee_amount,
        amount_paid    = excluded.amount_paid,
        payment_method = excluded.payment_method,
        payment_status = excluded.payment_status,
        description    = excluded.description,
        updated_at     = now()
  returning * into v_record;

  return v_record;
end;
$$;

grant execute on function public.upsert_fee_record(
  uuid, uuid, uuid, uuid, uuid, text, numeric, numeric,
  public.fee_payment_method, text
) to authenticated;
