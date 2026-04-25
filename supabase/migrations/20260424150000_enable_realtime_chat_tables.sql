-- ============================================================
-- Migration: enable Realtime for chat tables
-- 20260424150000_enable_realtime_chat_tables.sql
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.message_reactions;
