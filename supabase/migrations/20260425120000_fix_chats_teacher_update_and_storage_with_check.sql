-- Migration: Fix RLS for chat settings + storage upsert policies

-- 1. Allow teachers to update their own class chat (name + image_url)
create policy "chats: teacher update own class"
  on public.chats for update
  using (
    exists (
      select 1 from public.classes c
      where c.id = chats.class_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = chats.class_id
        and c.teacher_id = auth.uid()
    )
  );

-- 2. Fix chat-images UPDATE policy — add with_check (required for upsert)
drop policy if exists "chat-images: member update" on storage.objects;
create policy "chat-images: member update"
  on storage.objects for update
  to authenticated
  using   (bucket_id = 'chat-images' and auth.uid() is not null)
  with check (bucket_id = 'chat-images' and auth.uid() is not null);

-- 3. Fix avatars UPDATE policy — add with_check (required for upsert)
drop policy if exists "avatars: authenticated update" on storage.objects;
create policy "avatars: authenticated update"
  on storage.objects for update
  to authenticated
  using   (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');
