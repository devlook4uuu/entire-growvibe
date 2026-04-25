-- ============================================================
-- Fix: chat_members RLS infinite recursion + add role to teachers_with_class view
-- ============================================================

-- ─── 1. Drop recursive chat_members policies ─────────────────────────────────
drop policy if exists "chat_members: branch staff manage" on public.chat_members;
drop policy if exists "chat_members: owner all"           on public.chat_members;
drop policy if exists "chat_members: self select"         on public.chat_members;

-- ─── 2. Recreate chat_members policies using get_my_profile() ────────────────

-- Admin: full access
create policy "chat_members: admin all"
  on public.chat_members for all
  to authenticated
  using (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  )
  with check (
    exists (select 1 from public.get_my_profile() p where p.role = 'admin')
  );

-- Owner: full access for their school
create policy "chat_members: owner all"
  on public.chat_members for all
  using (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chat_members.school_id)
  )
  with check (
    exists (select 1 from public.get_my_profile() p
            where p.role = 'owner' and p.school_id = chat_members.school_id)
  );

-- Principal / coordinator: full access for their branch
-- Use chat_id → chats.branch_id lookup but via a direct join, not a correlated subquery on chat_members
create policy "chat_members: branch staff manage"
  on public.chat_members for all
  using (
    exists (
      select 1 from public.get_my_profile() gp
      join public.chats ch on ch.id = chat_members.chat_id
      where gp.role in ('principal', 'coordinator')
        and gp.branch_id = ch.branch_id
    )
  )
  with check (
    exists (
      select 1 from public.get_my_profile() gp
      join public.chats ch on ch.id = chat_members.chat_id
      where gp.role in ('principal', 'coordinator')
        and gp.branch_id = ch.branch_id
    )
  );

-- Self: member can read their own rows
create policy "chat_members: self select"
  on public.chat_members for select
  using (profile_id = auth.uid());


-- ─── 3. Add role column to teachers_with_class view ──────────────────────────
-- Must drop and recreate since CREATE OR REPLACE cannot reorder/insert columns.
drop view if exists public.teachers_with_class;

create view public.teachers_with_class as
select
  p.id,
  p.role,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.branch_id,
  p.school_id,
  p.class_id,
  p.created_at,
  p.updated_at,
  c.class_name
from public.profiles p
left join public.classes c on c.id = p.class_id
where p.role = 'teacher';
