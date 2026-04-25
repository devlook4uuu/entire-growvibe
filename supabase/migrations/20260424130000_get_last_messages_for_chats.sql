-- ============================================================
-- Migration: get_last_messages_for_chats RPC function
-- 20260424130000_get_last_messages_for_chats.sql
--
-- Returns the most recent non-deleted message for each chat_id
-- in the provided array. Used by the chat list tab to display
-- last message preview + timestamp.
-- ============================================================

create or replace function public.get_last_messages_for_chats(chat_ids uuid[])
returns table (
  chat_id    uuid,
  type       text,
  content    text,
  file_name  text,
  is_deleted boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.chat_id)
    m.chat_id,
    m.type::text,
    m.content,
    m.file_name,
    m.is_deleted,
    m.created_at
  from public.chat_messages m
  where m.chat_id = any(chat_ids)
  order by m.chat_id, m.created_at desc;
$$;

-- Grant execute to authenticated users
grant execute on function public.get_last_messages_for_chats(uuid[]) to authenticated;
