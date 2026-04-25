-- ============================================================
-- Migration: chat_messages + message_reactions + storage
-- 20260424120000_create_chat_messages.sql
-- ============================================================

-- ── message_type enum ────────────────────────────────────────────────────────
create type public.chat_message_type as enum ('text', 'image', 'document', 'voice');

-- ── chat_messages ─────────────────────────────────────────────────────────────
create table public.chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  chat_id      uuid        not null references public.chats(id)    on delete cascade,
  school_id    uuid        not null references public.schools(id)  on delete cascade,
  sender_id    uuid        not null references public.profiles(id) on delete cascade,
  type         public.chat_message_type not null default 'text',
  content      text,                          -- text body or storage path
  file_name    text,                          -- original filename for docs
  file_size    bigint,                        -- bytes
  mime_type    text,                          -- e.g. image/jpeg, application/pdf
  duration_ms  integer,                       -- voice message duration
  reply_to_id  uuid        references public.chat_messages(id) on delete set null,
  is_edited    boolean     not null default false,
  is_deleted   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create index chat_messages_chat_id_idx    on public.chat_messages(chat_id, created_at desc);
create index chat_messages_sender_idx     on public.chat_messages(sender_id);
create index chat_messages_school_id_idx  on public.chat_messages(school_id);

-- Members of the chat can read messages
create policy "chat_messages: member select"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chat_messages.chat_id
        and cm.profile_id = auth.uid()
    )
  );

-- Only members with can_send_message = true can insert
create policy "chat_messages: member insert"
  on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chat_messages.chat_id
        and cm.profile_id = auth.uid()
        and cm.can_send_message = true
    )
  );

-- Sender can update (edit) their own non-deleted messages
create policy "chat_messages: sender update"
  on public.chat_messages for update
  using (sender_id = auth.uid() and is_deleted = false);

-- ── message_reactions ─────────────────────────────────────────────────────────
create table public.message_reactions (
  id         uuid        primary key default gen_random_uuid(),
  message_id uuid        not null references public.chat_messages(id) on delete cascade,
  profile_id uuid        not null references public.profiles(id)      on delete cascade,
  school_id  uuid        not null references public.schools(id)       on delete cascade,
  emoji      text        not null,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id)   -- one reaction per user per message
);

alter table public.message_reactions enable row level security;

create index message_reactions_message_idx on public.message_reactions(message_id);

-- Members can read reactions for messages in their chats
create policy "message_reactions: member select"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_reactions.message_id
        and cm.profile_id = auth.uid()
    )
  );

-- Anyone who can read the message can react
create policy "message_reactions: member insert"
  on public.message_reactions for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      join public.chat_members cm on cm.chat_id = m.chat_id
      where m.id = message_reactions.message_id
        and cm.profile_id = auth.uid()
    )
  );

-- Own reaction update (replace emoji via upsert)
create policy "message_reactions: own update"
  on public.message_reactions for update
  using (profile_id = auth.uid());

-- Own reaction delete (remove)
create policy "message_reactions: own delete"
  on public.message_reactions for delete
  using (profile_id = auth.uid());

-- ── updated_at trigger for chat_messages ─────────────────────────────────────
create trigger chat_messages_updated_at
  before update on public.chat_messages
  for each row execute function public.set_updated_at();

-- ── chat_members: also allow teacher/student to select all members in their chat ─
-- (needed to show member list in group info)
create policy "chat_members: chat member select all"
  on public.chat_members for select
  using (
    exists (
      select 1 from public.chat_members cm2
      where cm2.chat_id = chat_members.chat_id
        and cm2.profile_id = auth.uid()
    )
  );
