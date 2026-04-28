-- Drop legacy push notification columns from profiles.
-- These were replaced by the push_tokens table (see 20260425150000_create_push_tokens.sql).
-- device_tokens (jsonb array) and expo_push_token (text) are no longer written or read anywhere.

alter table public.profiles
  drop column if exists device_tokens,
  drop column if exists expo_push_token;
