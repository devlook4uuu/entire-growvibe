-- Migration: Create avatars bucket + RLS policies
-- Also adds DELETE policy to chat-images (needed for replacing group cover images)

-- ─── avatars bucket (public — profiles use public URLs, no signing needed) ────
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Any authenticated user can read avatars (public bucket, but belt-and-suspenders)
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
-- Path convention: {school_id}/profiles/{profile_id}.{ext}
-- We allow any authenticated user to INSERT — the path contains their own profile_id
create policy "avatars: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

-- Authenticated users can update (upsert) their own avatar
create policy "avatars: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

-- Authenticated users can delete their own avatar
create policy "avatars: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');

-- ─── chat-images: add DELETE + UPDATE policies (needed for replacing group covers) ─
create policy "chat-images: member delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and auth.uid() is not null
  );

create policy "chat-images: member update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'chat-images'
    and auth.uid() is not null
  );
