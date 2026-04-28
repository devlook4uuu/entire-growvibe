-- Migration: fix coin_transactions owner RLS
-- The existing 'coin_transactions: admin read all' policy included owner role
-- with no school_id scope — owner could read all schools' transactions.
-- Split into two separate policies: admin (global) and owner (school-scoped).

drop policy if exists "coin_transactions: admin read all" on public.coin_transactions;

-- Admin: read all coin_transactions across every school
create policy "coin_transactions: admin read all"
  on public.coin_transactions for select
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- Owner: read only transactions belonging to their own school
create policy "coin_transactions: owner read school"
  on public.coin_transactions for select
  using (
    school_id = (
      select school_id from public.profiles
      where id = (select auth.uid())
    )
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'owner'
    )
  );
