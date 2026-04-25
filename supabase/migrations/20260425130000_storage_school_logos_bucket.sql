-- Migration: Create school-logos bucket + RLS policies

-- Public bucket — logo URLs are embedded in app UIs without auth
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'school-logos',
  'school-logos',
  true,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Anyone can read logos (public bucket, belt-and-suspenders)
create policy "school-logos: public read"
  on storage.objects for select
  using (bucket_id = 'school-logos');

-- Only admin can upload school logos
create policy "school-logos: admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'school-logos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admin can update school logos
create policy "school-logos: admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'school-logos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    bucket_id = 'school-logos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admin can delete school logos
create policy "school-logos: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'school-logos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
