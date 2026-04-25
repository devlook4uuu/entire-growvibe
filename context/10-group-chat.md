# 10 — Group Chat Feature

## What Was Built

Full real-time group chat system for school classes — web (GroupChatManager) and mobile (chatRoom + chat tab).

---

## Database (Migrations Applied)

### `20260424120000_create_chat_tables.sql` (earlier session)
- Tables: `chats`, `chat_members`, `chat_messages`, `message_reactions`
- `chats`: `id, school_id, branch_id, class_id, name, created_by, created_at`
- `chat_members`: `id, chat_id, school_id, profile_id, can_send_message, last_read_at, joined_at`
- `chat_messages`: `id, chat_id, school_id, sender_id, type (text|image|document|voice), content, file_name, file_size, file_path, bucket, duration_ms, reply_to_id, is_edited, is_deleted, created_at`
- `message_reactions`: `id, message_id, profile_id, emoji, created_at` — unique `(message_id, profile_id)`

### `20260424130000_get_last_messages_for_chats.sql`
- RPC `get_last_messages_for_chats(uuid[])` — `DISTINCT ON (chat_id)` ordered by `created_at desc`
- Returns: `chat_id, type, content, file_name, is_deleted, created_at`

### `20260424140000_fix_chat_members_rls_recursion.sql`
- SECURITY DEFINER function `is_chat_member(p_chat_id uuid)` breaks RLS self-referential recursion on `chat_members`
- Policy: `chat_members: chat member select all` uses this function

### `20260424150000_enable_realtime_chat_tables.sql`
- `alter publication supabase_realtime add table public.chat_messages`
- `alter publication supabase_realtime add table public.message_reactions`

### `20260424160000_profiles_chat_member_read.sql`
- Policy `profiles: chat member read` — any user can read profiles of people who share a chat with them (fixes "?" names in bubbles for teacher role)

### `20260424170000_chat_members_last_read_unread_rpc.sql`
- `chat_members.last_read_at timestamptz not null default now()`
- Policy `chat_members: self update last_read`
- RPC `get_unread_counts_for_chats(uuid[])` — counts messages after `last_read_at` from other senders

---

## Storage Buckets
- `chat-images` — images uploaded in chat
- `chat-documents` — documents/files uploaded in chat
- `chat-voices` — voice messages (recorded in-app)

---

## App Files

### `app/(tabs)/chat.jsx`
- Chat list tab for student/teacher roles
- Fetches: `chat_members → chats`, then parallel `get_last_messages_for_chats` + `get_unread_counts_for_chats` + `branches`
- `formatLastMessage()` + `lastMsgIcon()` — plain text + Ionicons for image/document/voice (no emojis)
- `handleChatPress`: optimistic unread badge clear + `last_read_at` update
- Focus effect: always invalidates cache and re-fetches on return (keeps unread counts fresh)
- `ChatRow` shows: name, branch (owner only), last message icon+text, unread badge, time

### `app/screens/chat/chatRoom.jsx`
- Full-featured real-time chat room
- Message types: text, image, document, voice
- Features: reply-to, edit, soft-delete, copy, emoji reactions (long-press), attachment preview, typing indicator
- `VoicePlayer`: `useAudioPlayer(null)` + `player.replace({ uri })` on first play
- `TypingDots`: 3 animated dots via Presence (Supabase Realtime)
- Optimistic send: temp ID inserted → replaced by real DB ID on response; Realtime deduplicates by ID
- Members: embedded in messages via `sender:sender_id(id,name,avatar_url)` — no separate members query on mount. `membersRef` mirrors state for Realtime callbacks. Realtime INSERT fetches sender profile if not cached.
- `AttachLabel` component: uses Ionicons for image/document/voice labels (no emojis)
- `AttachmentPreview`: uses `ScreenWrapper` + `previewHeaderBtn` style
- `ReactionSummary`: horizontal ScrollView, sorted by count desc, own chip tap removes reaction

### `app/screens/chat/chatInfo.jsx`
- Group info screen (tap header)
- Shows: large avatar (initials), chat name, member count, created date
- Member list: `CachedAvatar`, name, role badge (colour-coded), can_send_message label
- 30s module-level cache keyed by `chatId`

---

## Web Files

### `src/components/shared/GroupChatManager.jsx`
- Owner/principal/coordinator: create/delete group chats for a class
- Lists existing chats for selected class, shows member count, last message
- Create form: name, select class, toggle can_send_message per role
- Adds all class students + incharge teacher as members automatically

---

## Key Decisions

- **No hard deletes** for messages — `is_deleted = true` soft delete, bubble shows "Message deleted"
- **one reaction per user** — unique `(message_id, profile_id)`; tap own chip again to remove
- **Realtime dedup**: optimistic insert uses `temp_${Date.now()}` ID; Realtime INSERT handler skips if ID already present
- **Cache invalidation on focus return**: always delete cache entry and re-fetch so unread counts are fresh when user returns to chat list
- **Members map**: built lazily from embedded `sender` join in message queries — zero extra requests on mount
- **Voice recording**: `setAudioModeAsync({ allowsRecordingIOS: true })` on mount; `expo-audio` hooks; `expo-file-system/legacy` for base64 read; `base64-arraybuffer` decode for Supabase Storage upload
- **Clipboard**: `expo-clipboard` (`setStringAsync`) — not `@react-native-clipboard/clipboard` (requires native build)

---

## Gotchas

- `expo-av` is deprecated in SDK 54 — use `expo-audio`
- `FileSystem.EncodingType.Base64` is undefined in new API — use `'expo-file-system/legacy'` + string `'base64'`
- Realtime requires tables to be in `supabase_realtime` publication — must run the migration
- `is_chat_member()` SECURITY DEFINER is required to break RLS recursion on `chat_members` self-join policies
- Presence key must not be `undefined` — use `myId ?? 'anon'`; call `channel.track()` only after `SUBSCRIBED`
