# 16 — Support Tickets Feature

## What Was Built

A two-sided support ticket system. Non-admin roles submit tickets with title, description, and priority. Admin sees all tickets across all schools, can reply, and toggle open/closed status. All roles can view their own ticket thread and reply.

---

## Database (Migrations Applied)

### `20260421190000_create_support_tickets.sql`
- Table: `support_tickets`
  - Columns: `id, school_id, user_id, title, description, priority ('low'|'medium'|'high'), status ('open'|'closed'), created_at, updated_at`
- Table: `support_replies`
  - Columns: `id, ticket_id, user_id, body, created_at`
  - FK: `ticket_id → support_tickets(id) ON DELETE CASCADE`
- RLS:
  - Admin: full access on both tables (all schools)
  - Owner/Principal/Coordinator/Teacher/Student: INSERT own ticket, SELECT own tickets only, INSERT reply on own tickets, SELECT replies on own tickets
  - `school_id` on `support_tickets` enables scoped admin queries if needed

---

## Web

### `SupportPage.jsx` (Admin)
Route: `/support` — admin only

- Master-detail layout: ticket list (left panel) + thread view (right panel)
- Filter bar: All / Open / Closed
- Module-level cache: `ticketCache` keyed by filter, `repliesCache` keyed by ticketId, TTL 30s
- `TicketRow`: shows title, school name (via join), priority badge, date, open/closed status
- Clicking a row loads the reply thread on the right
- Admin can reply (textarea + Send) → inserts into `support_replies`, fires push to ticket owner
- Admin can toggle status open ↔ closed — fires push to ticket owner on close
- Priority colors: low=green, medium=yellow, high=red

### `MySupportPage.jsx` (All non-admin roles)
Route: `/support` — non-admin (routed via `SupportRoute` component in App.jsx)

- Same master-detail layout
- Left: user's own tickets only, + Create button
- Create ticket: title, description, priority dropdown
- Right: thread view with reply input
- User can reply to own tickets
- No status toggle (admin only)
- Push notification fired to admin on new ticket creation

---

## App

### `supportTicketList.jsx`
- Admin: lists all tickets across all schools, shows creator name; no create button
- Other roles: own tickets only + Create FAB
- Module-level cache keyed by `${uid}:${role}`, TTL 30s
- Pull-to-refresh, pagination with Load More button
- Priority badge, status badge (open/closed), date

### `supportTicketDetail.jsx`
- Full thread view for a ticket
- Loads all replies (`support_replies`) for the ticket
- Reply input at bottom (send button)
- Auto-scrolls to latest reply on load
- Fires push to other party (admin notifies user; user notifies admin) on reply

### `supportTicketForm.jsx`
- Create new ticket: title, description, priority picker (low/medium/high)
- Validates title required
- On submit: inserts ticket → fires push to admin

---

## Push Notification Triggers

| Event | Who notified | Title | Body |
|-------|-------------|-------|------|
| New ticket created (by user) | Admin | "Support Ticket" | "New {priority} priority ticket: {title}" |
| Admin replies | Ticket owner | "Support Reply" | "{admin name} replied to your ticket" |
| Admin closes ticket | Ticket owner | "Ticket Closed" | "Your ticket '{title}' has been closed" |
| User replies | Admin | "Support Reply" | "{user name} replied to a ticket" |

---

## Key Decisions

1. **Single route `/support`, two components** — `SupportRoute` in `App.jsx` checks `currentRole` and renders `SupportPage` (admin) or `MySupportPage` (others). Clean separation with zero shared state.
2. **Replies as a separate table** — enables thread-style UI and per-reply timestamps. Simple append-only structure.
3. **Admin sees all schools** — no `school_id` filter on admin RLS. Useful for platform-wide support triage.
4. **Priority is user-set** — no auto-priority. Users self-classify; admin can't change priority (no update policy for priority column).

---

## Gotchas

- `school_id` on `support_tickets` is nullable for admin-created tickets (admin has no school). Always use `maybeSingle()` when fetching school info via the ticket's `school_id`.
- Replies cache invalidation: `repliesCache[ticketId]` must be cleared after any reply is sent, otherwise the thread appears stale.
- App `supportTicketList` uses `invalidateSupportTicketCache(uid, role)` — must be called after creating a new ticket to refresh the list.
