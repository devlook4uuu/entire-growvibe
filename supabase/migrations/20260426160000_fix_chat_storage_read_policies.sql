-- Migration: restrict chat storage READ policies to chat members only
-- Old policies allowed any authenticated user to read any file.
-- Storage path format: {school_id}/{chat_id}/{filename}
-- chat_id is the 2nd path component — checked against chat_members.

-- ─── chat-images ─────────────────────────────────────────────────────────────
drop policy if exists "chat-images: member read" on storage.objects;
create policy "chat-images: member read"
  on storage.objects for select
  using (
    bucket_id = 'chat-images'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.chat_members
      where chat_id::text = (string_to_array(name, '/'))[2]
        and profile_id = (select auth.uid())
    )
  );

-- ─── chat-documents ──────────────────────────────────────────────────────────
drop policy if exists "chat-documents: member read" on storage.objects;
create policy "chat-documents: member read"
  on storage.objects for select
  using (
    bucket_id = 'chat-documents'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.chat_members
      where chat_id::text = (string_to_array(name, '/'))[2]
        and profile_id = (select auth.uid())
    )
  );

-- ─── chat-voice ──────────────────────────────────────────────────────────────
drop policy if exists "chat-voice: member read" on storage.objects;
create policy "chat-voice: member read"
  on storage.objects for select
  using (
    bucket_id = 'chat-voice'
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.chat_members
      where chat_id::text = (string_to_array(name, '/'))[2]
        and profile_id = (select auth.uid())
    )
  );
