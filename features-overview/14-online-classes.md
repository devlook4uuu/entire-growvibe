# Online Classes

## Overview

Teachers schedule Google Meet classes by pasting the meeting link into GrowVibe. No API integration with Google Meet — it's a simple link management system. The Join button state is calculated entirely on the frontend based on `scheduled_at` and `ends_at` timestamps — no backend status updates needed for live/ended states. After class ends, attachments remain accessible.

## User Roles & Access

- **Incharge Teacher:** Schedule, edit (before start), end class, cancel class, add post-class notes/attachments
- **All class members (Owner/Principal/Coordinator/Teacher/Student):** View class list, join when live, view attachments after class

## Core Functionality

- Schedule online class with Google Meet link
- Push notification to all class students on scheduling
- Countdown timer on scheduled classes
- Live "pulsing green" badge when class is active (frontend-calculated)
- Join button: time-based show/hide (frontend only — no backend status update)
- Teacher: end class early → `status = ended` → join button hides immediately → students notified
- Teacher: cancel class → `status = cancelled` → cancelled badge shown
- Edit class before it starts
- Add notes/attachments after class ends
- Past classes remain visible for attachment access
- `pg_cron` sends 30-minute reminder notification before class

## UI Screens & Components

### Screen: Online Classes List

**Visible To:** Incharge Teacher (create/manage), All class members (view/join)

**Data Displayed:**

- Classes list: title, date, time, status badge (Scheduled / Live / Ended / Cancelled)
- "LIVE" pulsing green badge when active
- Countdown timer on scheduled classes
- Past classes: still visible for attachment access

**User Actions:**

- Teacher: Schedule new class (+ button)
- All: Join (when live) — opens Google Meet link
- Teacher: Edit (before start)
- Teacher: End class
- Teacher: Cancel class
- All: View attachments after class

**UX Flow:**
Teacher opens Online Classes → Schedule → fills form → submit → students get push notification → students see card with countdown → class starts → JOIN button activates → students join → teacher ends → button hides

**Empty State:** "Koi online classes scheduled nahi hain."

**Error States:**

- Meet link invalid (not `meet.google.com`) → "Valid Google Meet link paste karo"
- End time before start time → "End time start time ke baad honi chahiye"

**Edge Cases:**

- Student app closed, opens 30 min late → `ends_at` check → if still valid → JOIN shown
- Teacher ends before `ends_at` → `status = ended` → button hides immediately → students notified
- After class ends: attachments still accessible — teacher can add notes even post-ended
- "Live" status: frontend calculates from `scheduled_at + ends_at` — no backend update needed

---

### Screen: Schedule Online Class (Teacher)

**Visible To:** Incharge Teacher only

**Data Displayed:**

- Form: Title, Date, Start Time, End Time, Google Meet Link, Description (optional), Attachments (optional)

**User Actions:**

- Fill form → Schedule → students notified

**UX Flow:**
Teacher taps "+ Schedule Class" → fills form → pastes meet link → submit → card created → push notification sent to all class students

**Error States:**

- Meet link not `meet.google.com` → inline validation error
- Past date → "Past date pe class schedule nahi ho sakti"
- End time before start time → inline error

## Data & Fields


| Field        | Description                                               |
| ------------ | --------------------------------------------------------- |
| title        | Text — required                                           |
| class_id     | FK to classes                                             |
| scheduled_at | Timestamp — class start                                   |
| ends_at      | Timestamp — class end                                     |
| meet_link    | URL — must be `meet.google.com` domain                    |
| description  | Text — optional                                           |
| attachments  | Supabase Storage URLs — optional, can be added post-class |
| status       | Enum: scheduled / ended / cancelled                       |
| notes        | Text — added by teacher after class                       |


**Key Indexes:** `(class_id, scheduled_at)`, `status`

## Business Rules & Logic

### Join Button States


| Condition                                              | Button State    | Display                                |
| ------------------------------------------------------ | --------------- | -------------------------------------- |
| Current time < `scheduled_at`                          | Disabled        | "Starts at 10:00 AM" + countdown timer |
| `scheduled_at` <= now <= `ends_at` AND status != ended | ENABLED         | "Join Class" → opens Google Meet       |
| Current time > `ends_at`                               | Hidden          | Card remains — join button gone        |
| Teacher manually ended                                 | Hidden          | `status = ended`                       |
| Teacher cancelled                                      | Cancelled badge | `status = cancelled` — no join         |


- All join button state calculations happen on frontend — no polling needed
- Google Meet link validation: must contain `meet.google.com`
- Past date scheduling: blocked at form validation
- `pg_cron`: 30-minute reminder notifications before class start
- Teacher ending early: immediate `status = ended` update → Realtime pushes to all connected clients
- Attachments: accessible after class ends, teacher can add new attachments post-class
- No limit mentioned on number of attachments per class

## API / Integrations

- **Google Meet:** No API — paste link only. Validation: domain check (`meet.google.com`)
- **Expo Push Notifications:**
  - On class scheduled: "Class scheduled" notification to all class students
  - 30 minutes before: reminder notification (via `pg_cron`)
  - On cancel: "Class cancelled" notification
  - On end: "Class ended — check notes" notification
- **Supabase Realtime:** For immediate status update propagation when teacher ends class
- **pg_cron:** 30-minute pre-class reminder job

## Open Questions / Missing Info

- Can other Google Meet links (e.g. Zoom, Teams) be used? Doc specifically says "meet.google.com" — so no
- Can students start a class or only teachers?
- Is the countdown timer based on `scheduled_at` only, or does it account for timezone?
- What timezone is used for class scheduling? (Pakistan Standard Time assumed but not stated)
- Attachments: what file types are allowed?
- Can a class be rescheduled (change date/time after creation)? "Edit before start" is mentioned but rescheduling implications for notifications not described
- Maximum number of simultaneous scheduled classes per class — not specified
- "Past classes still visible" — forever, or is there an archive period?
- Can Coordinator/Principal end a class, or only the incharge teacher?

