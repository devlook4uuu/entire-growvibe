-- Add branch_address, branch_contact, branch_subscription_fee to branches table

alter table public.branches
  add column if not exists branch_address          text,
  add column if not exists branch_contact          text,
  add column if not exists branch_subscription_fee numeric(10, 2) not null default 0;
