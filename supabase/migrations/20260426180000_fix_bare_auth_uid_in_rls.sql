-- Migration: replace bare auth.uid() with (select auth.uid()) in all RLS policies
-- Using a subquery ensures auth.uid() is evaluated once per query, not per row.
-- Affects: banners, branch_off_days, branches, schools, sessions,
--          student_fee_records, subscription_payments,
--          support_ticket_replies, support_tickets

-- ─── banners ──────────────────────────────────────────────────────────────────
drop policy if exists "banners: admin all" on public.banners;
create policy "banners: admin all"
  on public.banners for all
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- ─── branch_off_days ──────────────────────────────────────────────────────────
drop policy if exists "branch_off_days: admin delete" on public.branch_off_days;
create policy "branch_off_days: admin delete"
  on public.branch_off_days for delete
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branch_off_days: admin insert" on public.branch_off_days;
create policy "branch_off_days: admin insert"
  on public.branch_off_days for insert
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branch_off_days: admin select" on public.branch_off_days;
create policy "branch_off_days: admin select"
  on public.branch_off_days for select
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branch_off_days: member select" on public.branch_off_days;
create policy "branch_off_days: member select"
  on public.branch_off_days for select
  using (
    school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

-- ─── branches ─────────────────────────────────────────────────────────────────
drop policy if exists "branches: admin insert" on public.branches;
create policy "branches: admin insert"
  on public.branches for insert
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branches: admin select" on public.branches;
create policy "branches: admin select"
  on public.branches for select
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branches: admin update" on public.branches;
create policy "branches: admin update"
  on public.branches for update
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "branches: member select" on public.branches;
create policy "branches: member select"
  on public.branches for select
  using (
    school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

-- ─── schools ──────────────────────────────────────────────────────────────────
drop policy if exists "schools: admin insert" on public.schools;
create policy "schools: admin insert"
  on public.schools for insert
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "schools: admin select" on public.schools;
create policy "schools: admin select"
  on public.schools for select
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "schools: admin update" on public.schools;
create policy "schools: admin update"
  on public.schools for update
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "schools: member select" on public.schools;
create policy "schools: member select"
  on public.schools for select
  using (
    id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

-- ─── sessions ─────────────────────────────────────────────────────────────────
drop policy if exists "sessions: admin all" on public.sessions;
create policy "sessions: admin all"
  on public.sessions for all
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  )
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'admin'
  );

drop policy if exists "sessions: owner insert" on public.sessions;
create policy "sessions: owner insert"
  on public.sessions for insert
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

drop policy if exists "sessions: owner select" on public.sessions;
create policy "sessions: owner select"
  on public.sessions for select
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

drop policy if exists "sessions: owner update" on public.sessions;
create policy "sessions: owner update"
  on public.sessions for update
  using (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  )
  with check (
    (select role from public.profiles
     where id = (select auth.uid()) limit 1) = 'owner'
    and school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

-- ─── student_fee_records ──────────────────────────────────────────────────────
drop policy if exists "sfr: student self select" on public.student_fee_records;
create policy "sfr: student self select"
  on public.student_fee_records for select
  using (student_id = (select auth.uid()));

-- ─── subscription_payments ────────────────────────────────────────────────────
drop policy if exists "subscription_payments: admin insert" on public.subscription_payments;
create policy "subscription_payments: admin insert"
  on public.subscription_payments for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

drop policy if exists "subscription_payments: admin select" on public.subscription_payments;
create policy "subscription_payments: admin select"
  on public.subscription_payments for select
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

drop policy if exists "subscription_payments: admin update" on public.subscription_payments;
create policy "subscription_payments: admin update"
  on public.subscription_payments for update
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

drop policy if exists "subscription_payments: owner select" on public.subscription_payments;
create policy "subscription_payments: owner select"
  on public.subscription_payments for select
  using (
    school_id = (
      select school_id from public.profiles
      where id = (select auth.uid()) limit 1
    )
  );

-- ─── support_ticket_replies ───────────────────────────────────────────────────
drop policy if exists "support_ticket_replies: creator insert if open" on public.support_ticket_replies;
create policy "support_ticket_replies: creator insert if open"
  on public.support_ticket_replies for insert
  with check (
    sent_by = (select auth.uid())
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.created_by = (select auth.uid())
        and t.status = 'open'
    )
  );

-- ─── support_tickets ──────────────────────────────────────────────────────────
drop policy if exists "support_tickets: creator insert" on public.support_tickets;
create policy "support_tickets: creator insert"
  on public.support_tickets for insert
  with check (created_by = (select auth.uid()));
