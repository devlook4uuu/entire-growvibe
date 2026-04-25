-- ============================================================
-- Migration: fix infinite recursion in chat_members RLS
-- 20260424140000_fix_chat_members_rls_recursion.sql
--
-- The "chat_members: chat member select all" policy referenced
-- the chat_members table in its own USING clause, causing
-- infinite recursion at query time.
--
-- Fix: replace self-referencing subquery with a
-- SECURITY DEFINER function that bypasses RLS internally.
-- ============================================================

-- Drop the recursive policy
drop policy if exists "chat_members: chat member select all" on public.chat_members;

-- Security-definer helper — runs outside RLS so no recursion
create or replace function public.is_chat_member(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id
      and profile_id = auth.uid()
  );
$$;

-- Re-create the policy using the helper function
create policy "chat_members: chat member select all"
  on public.chat_members for select
  using (public.is_chat_member(chat_id));
