# Group Chat

## Overview
Every class gets a group chat automatically created as an atomic transaction when the class is created. The incharge teacher is auto-added. Students are added when they are assigned to the class. Owner/Principal/Coordinator can manually join. Messages are never hard-deleted — only soft-deleted. Real-time is powered by Supabase Realtime. Reconnect logic uses `last_seen_at` to fetch missed messages.

## User Roles & Access
| Role | Send Message | React | Add Members | Delete |
|---|---|---|---|---|
| Owner / Principal / Coordinator | Yes (if member) | Yes | Yes — any school teacher | Own messages only |
| Teacher (incharge) | Yes | Yes | Yes — any school teacher | Own messages only |
| Student (can_message: true) | Yes | Yes | No | Own messages only |
| Student (can_message: false) | NO — read only | Yes (always) | No | No |

## Core Functionality
- Auto-create chat room when class is created (atomic)
- Auto-add incharge teacher as member
- Auto-add students when assigned to class
- Send text messages
- Send image messages
- Send document messages
- Send voice messages
- React to messages (emoji reactions)
- Soft-delete own messages (shows "Message deleted" placeholder)
- Add teacher members manually (Owner/Principal/Coordinator/Incharge Teacher)
- Remove members (Owner/Principal/Coordinator/Incharge Teacher)
- Toggle `can_message` per student
- Real-time message delivery (Supabase Realtime)
- Reconnect: fetch missed messages after `last_seen_at`
- Unread count badge on chat list
- Pagination — load older messages on scroll up (50 per page)
- File/image viewer and downloader

## UI Screens & Components

### Screen: Chat Room
**Visible To:** All class members

**Data Displayed:**
- Chat header: class name + member count
- Messages list: sender name + photo, message content, timestamp, reactions
- Message types: text, image, document, voice
- Online/offline indicator (Realtime)
- Unread count badge on chat list
- Deleted messages: "Message deleted" placeholder shown

**User Actions:**
- Type + send message (if `can_message = true`)
- Long press message → react / delete own message
- Tap image/document → open/download
- Pull to load older messages (pagination)

**UX Flow:**
Open chat → Supabase Realtime subscribe → load last 50 messages → load more on scroll up → on reconnect: fetch messages after `last_seen_at` timestamp

**Empty State:** "Abhi tak koi message nahi. Pehla message bhejo!"

**Error States:**
- Send fail → message shows red error indicator → retry option
- File upload fail → "File upload failed. Try again."
- Offline → banner "You are offline. Messages will send when connected."

**Edge Cases:**
- Reconnect: fetch all messages after `last_seen_at` — no missed messages
- `can_message = false` student: input bar hidden, but reactions always work
- Incharge change: old teacher auto-removed, new teacher auto-added

---

### Screen: Chat Members List
**Visible To:** Owner, Principal, Coordinator, Incharge Teacher

**Data Displayed:**
- Members list: name, role badge, profile photo
- `can_message` status for students
- "+ Add Member" button

**User Actions:**
- Add member → search any school teacher → add
- Remove member
- Toggle `can_message` for students (Owner/Principal/Coordinator only)

**UX Flow:**
Tap Members icon → list opens → tap "+ Add" → search teacher by name → select → add → member added immediately

**Empty State:** "No members yet." (shouldn't happen — incharge always added at class creation)

**Error States:**
- Teacher already a member → "Ye teacher already is chat mein hai"

**Edge Cases:**
- Any school teacher can be added — not restricted to period/timetable teachers only

## Data & Fields
| Field | Description |
|---|---|
| chat_id | FK to chats (1 chat per class — `class_id UNIQUE`) |
| sender_id | FK to profiles |
| message content | Text / file URL |
| message type | Enum: text / image / document / voice |
| reactions | jsonb — emoji reactions per message |
| is_deleted | Boolean — soft delete only |
| created_at | Timestamp — indexed with `(chat_id, created_at)` |
| last_seen_at | Per member — for reconnect missed messages logic |
| can_message | Boolean on `chat_members` or `profiles` — per student |

**Key Constraints:**  
- `chats.class_id UNIQUE` — one chat per class  
- `chat_members.(chat_id, user_id) UNIQUE`

## Business Rules & Logic
- Chat auto-created atomically with class creation — not a separate step
- Incharge teacher auto-added at chat creation
- Students auto-added to chat when assigned to class
- Messages never hard-deleted — `is_deleted = true` + "Message deleted" placeholder
- Reconnect: `last_seen_at` per member → fetch all messages after that timestamp on reconnect
- `can_message = false` (default for all students): hides input bar — reactions still work
- Incharge teacher change: old teacher removed from chat, new teacher added (atomic)
- Only school teachers can be added as extra members — not external people
- Student promotion to new class: removed from old class chat, added to new class chat

## API / Integrations
- **Supabase Realtime:** Subscribe to `messages` table inserts for real-time delivery
- **Supabase Storage:** File uploads (images, documents, voice)
- **Expo Push Notifications:** Sent to offline members on new message

## Open Questions / Missing Info
- How are voice messages recorded — in-app mic recording, or file upload? (Doc says "voice" as a message type but no recording UI described)
- Can Owner/Principal/Coordinator read all chats in their scope without being members? Or must they manually join?
- Is there a "mute" feature for notifications per chat?
- Message reactions — what is the emoji set? Free-form or preset list?
- `last_seen_at` — is this per chat-member pair or per user globally?
- When a student's `can_message` is toggled ON, are past messages they sent preserved?
- Is there any message moderation (reporting, flagging) capability?
- File size limits for uploads not specified
- Voice message: max duration not specified
