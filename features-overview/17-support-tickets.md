# Support Tickets

## Overview
Any user (student, teacher, or staff) can raise a support ticket. Admin is the sole responder. Replies trigger push notifications. Admin can mark tickets as resolved. Ticket thread is visible to creator and Admin.

## User Roles & Access
- **All roles:** Create tickets, view own tickets, reply to own tickets
- **Admin:** View all tickets (across all schools), reply, close/resolve

## Core Functionality
- Create support ticket with subject and message
- View own ticket thread
- Reply to own ticket
- Admin: view all tickets with filters (school, status)
- Admin: reply to any ticket
- Admin: mark ticket as resolved (Closed)
- Push notification on Admin reply

## UI Screens & Components

### Screen: Support Tickets (User)
**Visible To:** All roles

**Data Displayed:**
- My tickets list: subject, status (Open / Resolved), created date, last reply
- Ticket thread on tap

**User Actions:**
- "+ New Ticket" button
- View ticket thread
- Add reply to own ticket

**UX Flow:**
User opens Support → creates ticket → Admin replies → push notification to user → user sees reply in thread

**Empty State:** "Koi tickets nahi. Koi masla hai? Ticket banao."

---

### Screen: Admin — All Support Tickets
**Visible To:** Admin only

**Data Displayed:**
- All tickets: user name, school, branch, subject, status, created date
- Filter: Open / Resolved / All schools

**User Actions:**
- Click ticket → thread → reply → close ticket

**UX Flow:**
Admin opens tickets → sees all → clicks → replies → marks resolved → user notified

**Empty State:** "Koi support tickets nahi."

## Data & Fields
| Field | Description |
|---|---|
| created_by | FK to profiles |
| subject | Text |
| status | Enum: open / resolved |
| school_id | FK to schools (for Admin filtering) |
| messages | Thread of messages: `[{sender_id, content, created_at}]` |
| created_at | Timestamp |

**Key Index:** `(school_id, status)`

## Business Rules & Logic
- All logged-in users can create tickets — no restriction by role
- Admin is the only responder — users cannot reply to each other's tickets
- User can reply within their own ticket thread (to provide follow-up info to Admin)
- Status: Open → Resolved (Admin only sets Resolved)
- Push notification on every Admin reply
- Tickets are not hard-deleted

## API / Integrations
- **Expo Push Notifications:** Sent to ticket creator when Admin replies

## Open Questions / Missing Info
- Can a user reopen a resolved ticket, or must they create a new one?
- Is there a ticket priority or category field (e.g. billing, technical, attendance)?
- Can users attach files to tickets or replies?
- Is there an SLA or response time tracking?
- Can Owner/Principal see their school's tickets? Or only Admin has cross-school view?
- If a student submits a ticket, does their teacher or principal get notified? Or only Admin?
- Is there any ticket assignment feature (Admin to another Admin)?
- Maximum message length per reply not specified
