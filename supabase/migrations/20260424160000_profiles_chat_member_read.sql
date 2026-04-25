-- ============================================================
-- Migration: profiles — allow reading chat peers' profiles
-- 20260424160000_profiles_chat_member_read.sql
--
-- Teachers (and any role) can now read profiles of people
-- who share a chat with them, fixing "?" names in chat bubbles.
-- ============================================================
create policy "profiles: chat member read"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.chat_members cm_them
      join public.chat_members cm_me
        on cm_me.chat_id = cm_them.chat_id
       and cm_me.profile_id = auth.uid()
      where cm_them.profile_id = profiles.id
    )
  );
