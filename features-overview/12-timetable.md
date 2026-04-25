# Timetable Management

## Overview
GrowVibe supports a 4-week rotating timetable per class. The system auto-detects which week of the month it is and shows the correct timetable. A teacher can only be in one class at a given time slot — clash detection is enforced in the UI. Timetable and class chat are independent systems; changing the incharge teacher does not affect the timetable.

## User Roles & Access
- **Owner / Principal / Coordinator:** Create and edit timetables for any class in scope
- **Teacher:** Create and edit timetable for own class (incharge only)
- **All roles:** View timetable for own class/branch scope

## Core Functionality
- Create timetable per class per week type (4 week types)
- Edit existing timetable
- Teacher clash detection — prevents same teacher in two classes at same time slot
- Auto-select current week on open
- Switch between week tabs (Week 1, 2, 3, 4)
- Fallback: if current week has no timetable, show most recent with notice
- View daily periods: time, subject, teacher name
- Today highlighted in view

## UI Screens & Components

### Screen: Timetable View
**Visible To:** All roles (scoped to own class/branch)

**Data Displayed:**
- Current week auto-selected (system calculates based on day of month)
- Week tabs: Week 1 / Week 2 / Week 3 / Week 4
- Daily schedule: periods grid — time, subject, teacher name
- Today highlighted

**User Actions:**
- Switch week tabs
- Edit timetable (Owner/Principal/Coordinator/Teacher — own class)

**UX Flow:**
Open Timetable → current week auto-shown → tap other week tabs to switch → tap Edit to modify

**Empty State:** "Is class ki timetable abhi nahi bani."

**Edge Cases:**
- No timetable for current week: show most recent one with notice "Week X ki timetable nahi — Week Y dikha raha hai"

---

### Screen: Create/Edit Timetable
**Visible To:** Owner, Principal, Coordinator, Teacher (own class)

**Data Displayed:**
- Week type selector (week1 / week2 / week3 / week4)
- Days columns: Mon-Fri (or Mon-Sat based on branch off_days setting)
- Per day: add periods — period number, subject (free text), teacher dropdown, start time, end time

**User Actions:**
- Add period per day
- Remove period
- Change teacher — clash check auto-happens
- Save timetable

**UX Flow:**
Select week type → add periods per day → select teacher (only available teachers shown — clash filtering) → save

**Error States:**
- Teacher clash: selected teacher already in another class at same time → "Ye teacher is waqt [Class Name] mein hai" → teacher not selectable (option disabled/greyed)

**Edge Cases:**
- Teacher dropdown: only shows teachers who are NOT already clashing in that time slot
- Schedule stored as jsonb: `[{day, periods: [{period_num, subject, teacher_id, start, end}]}]`

## Data & Fields

### Week Types
| Week | When | Purpose |
|---|---|---|
| week1 | Month's 1st week | Assembly, special schedule |
| week2 | Month's 2nd week | Regular schedule |
| week3 | Month's 3rd week | Regular schedule |
| week4 | Month's 4th+ week | Regular or special |

| Field | Description |
|---|---|
| class_id | FK to classes |
| week_type | Enum: week1 / week2 / week3 / week4 |
| schedule | jsonb — `[{day, periods: [{period_num, subject, teacher_id, start, end}]}]` |

**Key Constraint:** `(class_id, week_type) UNIQUE` — one timetable per class per week type

## Business Rules & Logic
- 4 week types per class — each stored independently
- `(class_id, week_type) UNIQUE` — no duplicate week types per class
- Current week auto-detection: based on day of month (week 1 = days 1-7, etc.)
- Teacher clash: one teacher can only appear in one class at any given time slot — enforced in teacher dropdown (disabled if clashing)
- Days in timetable: Mon-Fri or Mon-Sat — determined by branch `off_days` setting
- Subject: free text — no subject master list
- Timetable is independent of group chat — incharge teacher change does not affect timetable entries
- No timetable for current week: auto-fallback to most recent timetable with visible notice

## API / Integrations
- No external integrations — purely internal
- jsonb storage for schedule data (no separate periods table)

## Open Questions / Missing Info
- "Week 4" covers the 4th+ week — what about months with 5 weeks? Does week4 cover both 4th and 5th weeks?
- Teacher dropdown for clash check — does this query in real-time or is it a static list at screen load?
- Can two teachers have the same time slot in the same class (e.g. two teachers co-teaching)? Doc implies one teacher per period
- Is `period_num` sequential and auto-incremented, or can teachers set any number?
- Start/end time format — 12h or 24h? Stored as `time` type or text?
- Can the timetable be copied from one week type to another (template feature)?
- Can an Owner/Admin create timetables for other classes or only their own class? (Doc says "all classes in scope" for Owner/Principal/Coordinator)
- Is there a "no timetable" fallback for the Student view too, or just Teacher/Staff?
