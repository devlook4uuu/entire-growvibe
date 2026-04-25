# Session Management

## Overview
Academic sessions (e.g. "2025-2026") are managed at the branch level. Only one session can be "current" per branch at any time, enforced by a UNIQUE constraint. Switching sessions is an atomic transaction to prevent race conditions. Inactive sessions are read-only, with the one exception that fee payments can still be marked on inactive sessions. Student promotion happens at the end of a session — same account, coins carry forward.

## User Roles & Access
- **Owner:** Full access — create sessions, switch current session, manage promotions
- **Principal:** View sessions, view promotion screen
- **Coordinator:** View sessions, view promotion screen
- **Others:** No access to session management

## Core Functionality
- Create academic session (name + start date + end date)
- Set a session as "current" (one per branch — atomic switch)
- View all sessions for a branch with status (CURRENT / INACTIVE)
- Promote students at end of session (same account — new class, new session)
- Session switch forces page reload for all connected users
- Inactive session: read-only (exception: fees can still be marked paid)
- If no current session: auto-show latest by `end_date`
- If no session at all: show "Pehle session banao" message

## UI Screens & Components

### Screen: Sessions List
**Visible To:** Owner, Principal (view), Coordinator (view)

**Data Displayed:**
- All sessions for the branch: name, `start_date`, `end_date`, status badge
- "CURRENT" green badge on active session
- "INACTIVE" gray badge on old sessions

**User Actions:**
- "+ Create Session" button (Owner only)
- Click session → Session Detail
- "Make Current" button on inactive sessions (Owner only)

**UX Flow:**
Owner opens Sessions → sees list → clicks "+ Create Session" → form modal → fills name + dates → submit → session created

**Empty State:** "No sessions yet. Create your first session to get started." + Create button (Owner only)

**Error States:**
- Duplicate session name same branch → "Ye session naam already exist karta hai"
- Start date after end date → "Start date end date se pehle honi chahiye"

**Edge Cases:**
- "Make Current" click → confirm dialog "Purani session inactive ho jaayegi. Sure?" → atomic transaction → force reload

---

### Screen: Student Promotion
**Visible To:** Owner, Principal, Coordinator

**Data Displayed:**
- Current session's all classes list
- Per class: students list
- Each student: Promote / Fail / Leave radio buttons
- Destination class dropdown (from new session's classes)

**User Actions:**
- Select action for each student → Submit Promotions

**UX Flow:**
Session end approaches → Owner opens Promotion screen → selects action per student → selects destination class for promoted students → Submit → atomic transaction:
1. `class_id` update
2. `session_id` update
3. Chat group update (remove from old class chat, add to new class chat)

**Error States:**
- Destination class not selected for promoted student → "Promoted students ke liye destination class select karo"
- New session has no classes yet → "Pehle nayi session mein classes banao"

**Edge Cases:**
- Same account preserved: coins, orders, attendance history all carry forward
- Promoted student: removed from old class chat, added to new class chat automatically

## Data & Fields
| Field | Description |
|---|---|
| session name | Text — e.g. "2025-2026", UNIQUE per branch |
| start_date | Date |
| end_date | Date |
| is_current | Boolean — only one true per branch (UNIQUE enforced) |
| branch_id | FK to branches |

**Key Constraint:** `(branch_id, name) UNIQUE` — same session name cannot exist twice in same branch  
**Key Index:** `(branch_id, is_current)` — fast lookup for current session

## Business Rules & Logic
- Creator: Owner only (per branch)
- One current session per branch — UNIQUE constraint enforced at DB level
- Inactive session: READ ONLY — only exception is marking fees as paid
- Session switch: atomic transaction — old session `is_current = false` + new session `is_current = true` + force page reload (race condition prevented)
- If no current session: display latest by `end_date` automatically
- If no session exists at all: show creation prompt
- Student promotion: atomic — class_id + session_id update + chat membership update in one transaction
- Promoted student coins carry forward to new session
- Failed/Leave students: their action noted — class assignment handled accordingly (not fully specified)

## API / Integrations
- Atomic DB transaction for session switch (PostgreSQL transaction)
- Atomic DB transaction for student promotion batch
- Supabase Realtime may need to handle forced reload signal

## Open Questions / Missing Info
- What happens to "Failed" students at promotion — do they stay in the same class for the new session?
- What happens to "Leave" students — `is_active = false` on their profile?
- Can a session's start/end dates be edited after creation? No edit screen is described
- Is there a "close session" step separate from "make another current"? Not specified
- Promotion screen — can it be run partially (some classes promoted, others later)?
- What happens to students with no action selected (not Promote/Fail/Leave) — blocked from submitting, or skipped?
- The `session_id` on student profile — is this updated on promotion or inferred from `class_id`?
