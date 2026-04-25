-- Migration: Add image_url to chats table
-- Allows group chats to have a cover image stored in Supabase Storage (bucket: chat-images)
-- Path convention: {school_id}/chat-covers/{chat_id}.{ext}

alter table public.chats
  add column if not exists image_url text;
