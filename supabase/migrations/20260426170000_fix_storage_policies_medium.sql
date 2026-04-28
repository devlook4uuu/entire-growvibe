-- Migration: medium severity storage policy fixes
-- 1. Add avatars UPDATE policy (owner can replace their own avatar)
-- 2. Add chat-documents DELETE policy (chat members can delete files)
-- 3. Add chat-voice DELETE policy (chat members can delete files)
-- 4. Remove 3 duplicate banners storage policies (keep the non-duplicate set)

-- ─── 1. avatars: owner update ─────────────────────────────────────────────────
create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ─── 2. chat-documents: member delete ────────────────────────────────────────
-- Storage path: {school_id}/{chat_id}/{filename} — verify chat membership
create policy "chat-documents: member delete"
  on storage.objects for delete
  using (
    bucket_id = 'chat-documents'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.chat_members
      where chat_id::text = (string_to_array(name, '/'))[2]
        and profile_id = (select auth.uid())
    )
  );

-- ─── 3. chat-voice: member delete ────────────────────────────────────────────
create policy "chat-voice: member delete"
  on storage.objects for delete
  using (
    bucket_id = 'chat-voice'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.chat_members
      where chat_id::text = (string_to_array(name, '/'))[2]
        and profile_id = (select auth.uid())
    )
  );

-- ─── 4. Remove duplicate banners storage policies ────────────────────────────
-- Kept: "banners: admin delete", "banners: admin upload", "banners: authenticated read"
-- Dropped: the redundant "banners storage: *" copies
drop policy if exists "banners storage: admin delete" on storage.objects;
drop policy if exists "banners storage: admin insert" on storage.objects;
drop policy if exists "banners storage: public read"  on storage.objects;
