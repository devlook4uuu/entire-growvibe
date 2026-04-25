-- Add school_address and school_contact to schools table

alter table public.schools
  add column if not exists school_address text,
  add column if not exists school_contact text;
