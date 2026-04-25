-- ============================================================
-- Migration: banners
-- 20260424200000_create_banners.sql
-- ============================================================

-- ─── Storage bucket ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,                          -- public read (images served directly)
  5242880,                       -- 5 MB max per file
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Storage RLS: anyone can read (bucket is public)
-- Only admin role can upload/delete
create policy "banners storage: public read"
  on storage.objects for select
  using ( bucket_id = 'banners' );

create policy "banners storage: admin insert"
  on storage.objects for insert
  with check (
    bucket_id = 'banners'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "banners storage: admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'banners'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.banners (
  id              uuid primary key default gen_random_uuid(),

  -- Targeting (both null = global; school_id set = school-wide; both set = branch-specific)
  school_id       uuid references public.schools(id)  on delete cascade,
  branch_id       uuid references public.branches(id) on delete cascade,

  -- Content
  banner_type     text not null default 'image_only'
                  check (banner_type in ('image_only','image_text','image_text_cta')),
  title           text,
  body_text       text,

  -- CTA
  cta_label       text,
  cta_type        text default 'url' check (cta_type in ('url','info')),
  cta_url         text,           -- external URL or deep link
  cta_info        text,           -- rich text shown in info sheet on tap

  -- Visuals
  bg_image_path   text,           -- storage path: banners/<filename>
  overlay_color   text default '#000000',   -- hex
  overlay_opacity numeric(4,3) not null default 0.0
                  check (overlay_opacity >= 0 and overlay_opacity <= 1),
  text_color      text default '#FFFFFF',   -- hex

  -- Scheduling & ordering
  start_date      date not null default current_date,
  end_date        date,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,

  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_banners_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger banners_updated_at
  before update on public.banners
  for each row execute procedure public.set_banners_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.banners enable row level security;

-- Admin: full access
create policy "banners: admin all"
  on public.banners for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- All authenticated users: read active banners within their scope
-- A banner is visible to a user if:
--   1. It is active, within start/end date window
--   2. AND one of:
--      a. global (school_id is null)
--      b. matches user's school_id (branch_id is null = school-wide)
--      c. matches both user's school_id and branch_id
create policy "banners: authenticated read"
  on public.banners for select
  using (
    auth.uid() is not null
    and is_active = true
    and start_date <= current_date
    and (end_date is null or end_date >= current_date)
    and (
      -- global
      school_id is null
      -- school-scoped
      or (
        branch_id is null
        and school_id = (select school_id from public.profiles where id = auth.uid())
      )
      -- branch-scoped
      or (
        school_id = (select school_id from public.profiles where id = auth.uid())
        and branch_id = (select branch_id from public.profiles where id = auth.uid())
      )
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists banners_active_idx
  on public.banners (is_active, start_date, end_date, sort_order);

create index if not exists banners_school_idx
  on public.banners (school_id, branch_id);
