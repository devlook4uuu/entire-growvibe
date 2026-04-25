-- ============================================================
-- Migration: chat_members.last_read_at + unread count RPC
-- 20260424170000_chat_members_last_read_unread_rpc.sql
-- ============================================================

alter table public.chat_members
  add column if not exists last_read_at timestamptz not null default now();

create policy "chat_members: self update last_read"
  on public.chat_members for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function public.get_unread_counts_for_chats(chat_ids uuid[])
returns table (chat_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.chat_id, count(*)::bigint as unread_count
  from public.chat_messages m
  join public.chat_members cm
    on cm.chat_id = m.chat_id
   and cm.profile_id = auth.uid()
  where m.chat_id = any(chat_ids)
    and m.sender_id <> auth.uid()
    and m.is_deleted = false
    and m.created_at > cm.last_read_at
  group by m.chat_id;
$$;

grant execute on function public.get_unread_counts_for_chats(uuid[]) to authenticated;
