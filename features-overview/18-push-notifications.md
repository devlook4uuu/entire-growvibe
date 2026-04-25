# Push Notifications

## Overview
GrowVibe uses Expo Push Notifications for all push notification delivery. Notifications are sent in chunks of 20 tokens. Invalid tokens (DeviceNotRegistered) are automatically nulled. All notifications work for both foreground and background app states. Max 2 devices per user — notifications go to both.

## User Roles & Access
All roles receive relevant notifications based on their role and class/branch scope.

## Core Functionality
- Send push notifications on all defined system events
- Chunked sending: 20 tokens per batch
- Invalid token auto-cleanup: `DeviceNotRegistered` → set `expo_push_token = null`
- Both foreground and background handling
- Max 2 devices per user — notifications to both devices

## Complete Notification Events

| Event | Recipient | Message | Trigger |
|---|---|---|---|
| Attendance: Absent | Student device | "Aaj ki attendance: Absent" | Mark pe + every status change |
| Attendance: Late | Student device | "Aaj ki attendance: Late" | Same as absent |
| Fee Submitted | Student device | "[Month] ki fee record ho gayi" | Fee record create pe |
| GrowCoins Received | Student device | "X GrowCoins mile!" | Every coin credit |
| Basic Voucher Unlock | Student device | "Basic Voucher unlock hua!" | 500 total coins spent threshold |
| Premium Voucher Unlock | Student device | "Premium Voucher unlock hua!" | 800 total coins spent threshold |
| Order Confirmed | Student device | "Aapka order confirm ho gaya" | Admin confirms order |
| Order In Process | Student device | "Is hafte ka order process ho raha hai" | Week close pe |
| Order Delivered | Student device | "Aapka order deliver ho gaya" | Delivered mark pe |
| Fee Receipt Ready | Branch Principal/Coordinator | "Is hafte ki orders receipt ready" | Week close pe |
| Support Reply | Ticket creator | "Support ticket pe reply aayi" | Admin reply pe |
| Application Status | Applicant | "Application approved/rejected" | Status change pe |
| Chat Message | Offline members | "Nayi message — [class name]" | Message insert pe |
| Online Class Scheduled | Class students | "[Title] kal [time] pe hai" | Class create pe |
| Online Class Reminder | Class students | "[Title] 30 minute mein shuru hogi" | pg_cron (30 min before) |
| Online Class Cancelled | Class students | "[Title] cancel ho gayi" | Cancel pe |
| Online Class Ended | Class students | "[Title] khatam — notes check karo" | Teacher ends class |

## Technical Implementation Notes

### Expo Push Setup
- Library: Expo Push Notifications
- Token storage: `expo_push_token` on `profiles` — set automatically on login
- Multi-device: `device_tokens` jsonb — max 2 entries — notifications sent to both
- Invalid token handling: `DeviceNotRegistered` error → immediately null `expo_push_token`

### Chunked Sending
- Max 20 tokens per API call to Expo
- All bulk notifications (e.g. fee created for whole class, week close) must chunk through 20 at a time

### Foreground vs Background
- Both states handled
- Foreground: in-app notification/toast behavior (not specified in detail)
- Background: standard push notification via OS

### pg_cron Jobs for Notifications
- Online Class Reminder: `pg_cron` job runs to send 30-minute pre-class reminders

## Data & Fields
| Field | Description |
|---|---|
| expo_push_token | Single token — latest device's token |
| device_tokens | jsonb — `[{token, device_name, last_login}]` — max 2 devices |

## Business Rules & Logic
- Attendance notification resent on every status change (no cooldown)
- GrowCoins notification on every individual credit
- Chunked at 20 tokens — any bulk send must batch
- Invalid token: immediately null on `DeviceNotRegistered` error
- Max 2 devices: both receive all notifications
- Chat: only offline members get push (online members see it via Realtime)

## API / Integrations
- **Expo Push Notifications API:** Primary delivery mechanism
- **Edge Function:** `send-push` — handles chunking + invalid token cleanup
- **pg_cron:** Online class 30-min reminder

## Open Questions / Missing Info
- Chat notification: "Offline members" — how is online/offline determined? Via Supabase Realtime presence?
- Notification for new diary entry: listed in Diary feature as "notified via chat or notification" — no entry in this push list. Is it intentional?
- Notes/Announcements: no push notification in this list — intentional omission or missing?
- GrowTask submission notification to teacher: not listed (teacher submits, students get notified — but what about confirming to teacher?)
- Notification sound/vibration customization: not specified
- Do notifications deep-link into the relevant screen? Not specified
- Notification history/inbox: no mention of in-app notification center
- Are notifications localized (Urdu) or always in Urdu Roman text like shown?
- "Attendance: Absent" notification — parent receives on same device as student (doc mentions this) — so no separate parent account?
