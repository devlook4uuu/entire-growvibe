# Notes & Announcements

## Overview
Owner or Principal creates notes/announcements with scope-based targeting. Owner can target the whole school, specific branches, or specific classes. Principal can target their own branch or specific classes within it. Only targeted users (incharge teachers and students of those classes) see the notes.

## User Roles & Access
- **Owner:** Create notes — scope: entire school, specific branches, or specific classes
- **Principal:** Create notes — scope: own branch or specific classes within own branch
- **Incharge Teacher:** View notes targeted at their class/branch
- **Student:** View notes targeted at their class/branch/school
- **Coordinator:** View notes targeted at their branch (not specified if they can create)

## Core Functionality
- Create announcement with title + content
- Select scope: school-wide / branch-specific / class-specific
- Targeted delivery: only relevant users see the note
- View notes list (scoped per role)
- Expand note to read full content

## UI Screens & Components

### Screen: Notes List
**Visible To:** Owner, Principal (create), All targeted users (view)

**Data Displayed:**
- Notes list: title, scope badge (School-wide / Branch / Class-specific), `created_by`, date
- Note content on expand/tap

**User Actions:**
- Owner/Principal: "+ Create Note" button
- All: view notes targeted to them

**UX Flow:**
Owner/Principal taps "+ Create Note" → fills title + content → selects scope → save → targeted users see it in their Notes section

**Empty State:** "Koi announcements nahi abhi tak."

**Edge Cases:**
- Student sees only notes for their class / branch / school scope
- Incharge teacher sees only notes for their class / branch scope
- Scope logic:
  - **Owner** → entire school, OR specific branches, OR specific classes
  - **Principal** → own branch, OR specific classes within own branch

## Data & Fields
| Field | Description |
|---|---|
| title | Text — required |
| content | Text / rich text |
| created_by | FK to profiles |
| scope | Enum: school / branch / class |
| target_ids | Array of branch_ids or class_ids (if scoped below school) |
| branch_id | FK to branches (for principal notes) |
| created_at | Timestamp |

**Key Index:** `(branch_id, target_roles)` — for filtering by recipient

## Business Rules & Logic
- Owner scope options: school-wide (all branches) / specific branches / specific classes
- Principal scope options: own branch / specific classes within own branch
- Coordinator cannot create notes (not mentioned in doc)
- Visibility rule: a note is visible if the user's class_id / branch_id / school_id matches the note's target
- No push notification mentioned for notes (only support ticket reply and other features have push) — this may be an omission
- Notes are not deleted — no delete action described

## API / Integrations
- Not specified in doc — no push notification explicitly mentioned for notes

## Open Questions / Missing Info
- Can notes be edited after creation?
- Can notes be deleted?
- Is there a push notification when a new note is posted? (Not mentioned in notifications list in section 18 — possible omission)
- Can Coordinator create notes? (Not mentioned — only Owner and Principal listed as creators)
- Is there a rich text editor for note content, or plain text only?
- Scope "class-specific" — can Owner select multiple specific classes in one note?
- Are notes visible indefinitely, or do they expire?
- Can notes have attachments (images, PDFs)?
- `target_roles` in DB index — what does this field contain? Not described in features section
