-- ============================================================
-- Migration 1: Create schools and branches tables
-- No FKs to profiles yet — profiles doesn't exist yet.
-- owner_id FK added in migration 3 after profiles is created.
-- ============================================================

create extension if not exists "uuid-ossp";

-- schools
create table public.schools (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  owner_id   uuid,           -- FK added later in migration 3
  is_active  boolean not null default true,
  logo_url   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;

-- branches
create table public.branches (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references public.schools(id) on delete restrict,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index branches_school_id_idx on public.branches(school_id);

alter table public.branches enable row level security;
