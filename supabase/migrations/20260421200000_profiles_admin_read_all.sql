-- ============================================================
-- Migration: allow admin to read all profiles
-- Needed so PostgREST can resolve profiles(...) joins when
-- admin queries support_tickets, support_ticket_replies, etc.
-- ============================================================

create policy "profiles: admin read all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.get_my_profile() p
      where p.role = 'admin'
    )
  );
