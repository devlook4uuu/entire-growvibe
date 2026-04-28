-- Migration: allow admin role to read all grow_tasks and update coins_reward
-- The existing "grow_tasks: read active" policy only returns is_active=true rows.
-- Admin needs to see all rows (including inactive) and update coins_reward.

-- Admin: full read (all rows, including inactive)
create policy "grow_tasks: admin select"
  on public.grow_tasks for select
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- Admin: update (coins_reward, name, is_active)
create policy "grow_tasks: admin update"
  on public.grow_tasks for update
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );
