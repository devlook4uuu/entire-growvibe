# Academic Features

## Overview
Four distinct academic features: Results (grade tracking), Exams (printable paper generation), Diary (daily homework), and Leaderboard (class ranking). These are all class-scoped features managed by teachers and viewed by students. All are per-session — new session resets leaderboard and diary history.

## User Roles & Access
- **Owner / Principal / Coordinator:** Full access — create, view, print (Results/Exams)
- **Teacher:** Create, view — cannot print Results PDF, cannot print Exam PDF
- **Student:** View own results, view diary, view leaderboard

---

## Sub-Feature: 13.1 Results

### Overview
Results are entered per student, per subject, per session. Grades are auto-calculated based on marks percentage. Teacher can create results but cannot generate/print PDFs. Student sees only current session's results.

### Core Functionality
- Create result entry: student, subject, marks, max marks
- Auto-calculate grade from marks percentage
- View/filter results: by student, subject, session
- Print/generate PDF report (Owner/Principal/Coordinator only)
- Edit results (if no receipt generated)

### Grade Scale
| Grade | Marks Range |
|---|---|
| A+ | 90% and above |
| A | 80–89% |
| B | 70–79% |
| C | 60–69% |
| D | 50–59% |
| F | Below 50% |

### Screen: Results List & Create
**Visible To:** Owner, Principal, Coordinator, Teacher (create + view) — Teacher cannot print

**Data Displayed:**
- Results list: student name, subject, marks, grade badge, session
- Filter: by student, subject, session
- "+ Add Result" button

**User Actions:**
- Create result entry
- Print PDF (Owner/Principal/Coordinator only)
- Edit result (if no receipt generated)

**UX Flow:**
Open Results → filter by class + session → click "+ Add Result" → enter student, subject, marks, max marks → grade auto-calculates → save

**Empty State:** "Koi results nahi. Pehla result add karo."

**Error States:**
- Duplicate student + subject + session: system allows it — staff must be trained not to duplicate (no block)

**Edge Cases:**
- Student sees only current session results
- Edit blocked after PDF/receipt generated

### Data & Fields
| Field | Description |
|---|---|
| student_id | FK to profiles |
| subject | Text |
| marks | Integer |
| max_marks | Integer |
| grade | Auto-calculated enum: A+/A/B/C/D/F |
| session_id | FK to sessions |
| class_id | FK to classes |

---

## Sub-Feature: 13.2 Exams (Datesheet & Paper Generator)

### Overview
Two parts: a datesheet (exam schedule) and actual exam paper generation with a flexible section builder. Exam papers are print-only — no online attempt by students. Teacher uses a page-builder-like interface to add section types.

### Core Functionality
- Create exam datesheet (schedule of exams)
- Create exam paper with flexible section builder
- 10 available section types
- Preview exam paper before printing
- Generate and print PDF (via Edge Function)
- Reorder/remove sections

### 10 Section Types
1. MCQs
2. Short Q&A
3. Long Q&A
4. Fill in the Blanks
5. True/False
6. Diagrams
7. Match the Column
8. Comprehension
9. Essay
10. Numerical Problems

### Screen: Create Exam
**Visible To:** Owner, Principal, Coordinator, Teacher

**Data Displayed:**
- Exam title, class, date, total marks, duration
- Section builder: "+ Add Section" button
- Each section: type dropdown (10 types), section title, instructions, marks
- Preview button
- Print/Generate PDF button

**User Actions:**
- Add sections → fill questions per section → preview → print PDF

**UX Flow:**
Create exam → add sections (like a page builder — add/remove/reorder) → each section has type + content → Preview → Print PDF via Edge Function

**Error States:**
- No sections added → "Exam mein kam az kam ek section chahiye"

**Edge Cases:**
- Sections stored as jsonb: `[{type, title, instructions, marks, content}]`
- Print only — no student-facing online exam system

### Data & Fields
| Field | Description |
|---|---|
| title | Text |
| class_id | FK |
| date | Date |
| total_marks | Integer |
| duration | Text/minutes |
| sections | jsonb — `[{type, title, instructions, marks, content}]` |

---

## Sub-Feature: 13.3 Diary

### Overview
The incharge teacher creates daily diary entries with homework for multiple subjects. One entry per date — multiple subjects per entry. Students view the diary in the app. Optional file attachments per subject.

### Core Functionality
- Create diary entry for a date (Teacher only)
- Add multiple subjects per entry (each with title, description, optional attachment)
- View diary entries (students and staff)
- Download attachments
- Students notified via chat or push notification on new entry

### Screen: Diary
**Visible To:** Incharge Teacher (create), Students (view), Owner/Principal/Coordinator (view)

**Data Displayed:**
- Calendar/date list view
- Each entry: date, subjects list — `[{title, description, attachment}]`
- Attachment: download button

**User Actions:**
- Create diary entry (Teacher only)
- View entries
- Download attachments

**UX Flow:**
Teacher opens Diary → selects date → "+ Add Entry" → adds subjects (multiple) → each subject has title + description + optional attachment → save → students notified

**Empty State:** "Koi diary entries nahi."

**Error States:**
- Attachment upload fail → "Attachment upload failed"

**Edge Cases:**
- One entry per date — multiple subjects in that single entry (not one entry per subject)
- Optional attachment per subject — stored in Supabase Storage
- Notification: via chat message or push notification (not fully specified which)

### Data & Fields
| Field | Description |
|---|---|
| class_id | FK |
| date | Date |
| entries | jsonb — `[{subject_title, description, attachment_url}]` |

**Key Index:** `(class_id, date)`

---

## Sub-Feature: 13.4 Leaderboard

### Overview
A simple class leaderboard managed by the teacher. Teacher manually adds/edits student scores. Rankings auto-sort. New session = fresh start (previous session archived). All class members can view each other's rankings.

### Core Functionality
- Teacher adds/edits student scores
- Leaderboard auto-sorts by score descending
- All class members (students + teacher) can view
- New session creates new leaderboard (old one archived)

### Screen: Leaderboard
**Visible To:** Teacher (create/manage), All class members (view)

**Data Displayed:**
- Students ranked list: rank number, name, photo, score/points

**User Actions:**
- Teacher: add/edit student scores
- View ranking (all class members)

**UX Flow:**
Teacher updates scores → save → rankings auto-sort → all class members can view

**Empty State:** "Is session ka leaderboard abhi nahi bana."

**Edge Cases:**
- Public within class — students see each other's rankings
- New session: fresh leaderboard — old one archived (not deleted)

### Data & Fields
| Field | Description |
|---|---|
| class_id | FK |
| session_id | FK |
| student_id | FK |
| score | Integer/numeric |

**Key Index:** `(class_id, session_id)`

---

## Business Rules & Logic (All Academic Features)
- All features are session-scoped — new session = new data for leaderboard and diary
- Diary: one entry per date per class — multiple subjects within one entry
- Results: duplicate student+subject+session allowed at DB level — staff must be trained
- Exams: print-only — no online student-facing component
- Leaderboard: teacher-managed scores, not coin-based
- Results edit blocked after PDF generated

## API / Integrations
- **Edge Function:** PDF generation for Results (using `pdf-lib` or similar)
- **Edge Function:** PDF generation for Exam papers
- **Supabase Storage:** Diary attachments

## Open Questions / Missing Info

### Results
- "Edit blocked if receipt generated" — is this a receipt PDF specifically, or any PDF?
- Max marks and obtained marks — is there validation that obtained ≤ max?
- Results PDF format — what data is included? Multiple subjects per student on one page?
- Can a teacher add results for a student not in their class?

### Exams
- Datesheet screen — not described in detail. What fields? How is it different from Exam paper?
- Can an exam paper be reused/duplicated for another date or class?
- Who can delete an exam paper?
- Section content format in jsonb — how are MCQ options structured? Not specified

### Diary
- "Notified via chat or notification" — which one? Both? Not fully specified
- Can a diary entry be edited after creation?
- Can a diary entry be deleted?
- Attachment types allowed: images, PDFs, both?

### Leaderboard
- What are "scores/points" based on? Teacher enters them manually — no formula specified
- Can leaderboard be hidden from students by teacher?
- "Archived" previous session leaderboard — where/how is it accessible?
