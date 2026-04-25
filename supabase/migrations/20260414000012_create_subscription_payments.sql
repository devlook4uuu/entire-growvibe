-- ─── subscription_payments ────────────────────────────────────────────────────
-- Tracks monthly subscription payments per school.
-- Follows the school_id column rule: every school-scoped table carries school_id directly.

create table public.subscription_payments (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  payment_month       text not null,                        -- e.g. "April 2026"
  fee                 numeric(10,2) not null default 0,     -- total amount due
  amount_paid         numeric(10,2) not null default 0,     -- amount actually paid
  remaining_due       numeric(10,2) not null default 0,     -- manual, suggested = fee - amount_paid
  payment_method      text check (payment_method in ('cash','bank_transfer','cheque','online')),
  payment_status      text not null default 'unpaid'
                        check (payment_status in ('paid','partial','unpaid')),
  payment_description text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Index for fast school-scoped queries
create index subscription_payments_school_id_idx on public.subscription_payments(school_id);
create index subscription_payments_status_idx    on public.subscription_payments(payment_status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.subscription_payments enable row level security;

-- Admin: full access to all payments
create policy "subscription_payments: admin select"
  on public.subscription_payments for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "subscription_payments: admin insert"
  on public.subscription_payments for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "subscription_payments: admin update"
  on public.subscription_payments for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Owner: can view payments for their own school
create policy "subscription_payments: owner select"
  on public.subscription_payments for select
  using (
    school_id = (select school_id from public.profiles where id = auth.uid() limit 1)
  );

-- ─── View: payments with school name ─────────────────────────────────────────
create or replace view public.subscription_payments_with_school as
select
  sp.id,
  sp.school_id,
  s.name  as school_name,
  sp.payment_month,
  sp.fee,
  sp.amount_paid,
  sp.remaining_due,
  sp.payment_method,
  sp.payment_status,
  sp.payment_description,
  sp.created_at,
  sp.updated_at
from public.subscription_payments sp
join public.schools s on s.id = sp.school_id;
