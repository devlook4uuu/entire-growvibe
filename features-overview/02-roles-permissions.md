# Roles & Permissions

## Overview
GrowVibe has 6 roles in a strict hierarchy. Each role has a defined scope (platform-wide, school, branch, or class). A user cannot edit their own role, school, or branch — only a superior role can do so. Role changes trigger an immediate force logout to prevent JWT staleness.

## User Roles & Access
All 6 roles are defined in this feature.

## Core Functionality

### Role Hierarchy
| Role | Scope | Created By | Key Powers |
|---|---|---|---|
| Admin (Abdullah) | Everything — God level | Self | Schools, owners, GrowTasks, products, billing, all orders |
| Owner | Own school | Admin | All staff, branches, sessions, classes, fees |
| Principal | Own branch | Owner | Branch ka sab — same as owner but branch-scoped |
| Coordinator | Own branch | Owner / Principal | Principal's right hand — almost same powers |
| Teacher | Own class | Owner / Principal / Coordinator | Attendance, diary, leaderboard, GrowTasks |
| Student | Own class | Owner / Principal / Coordinator | View, earn coins, buy from store |

### Who Can Create Whom
| Role Being Created | Who Can Create |
|---|---|
| Owner | Admin only |
| Principal | Owner only |
| Coordinator | Owner, Principal |
| Teacher | Owner, Principal, Coordinator |
| Student | Owner, Principal, Coordinator |

### Attendance Mark & Edit Permissions
| Role | Mark | Edit | Date Range | Special |
|---|---|---|---|---|
| Teacher | Own class only | Own class — today only | Today only | Cannot edit own attendance |
| Owner | Any branch | Any | Unlimited | Full override |
| Principal | Own branch | Own branch — any date | Unlimited | Branch level |
| Coordinator | Own branch | Own branch — any date | Unlimited | Same as Principal |

### Chat Permissions
| Role | Send Message | React | Add Members | Delete |
|---|---|---|---|---|
| Owner / Principal / Coordinator | Yes (if member) | Yes | Yes — any school teacher | Own messages only |
| Teacher (incharge) | Yes | Yes | Yes — any school teacher | Own messages only |
| Student (can_message: true) | Yes | Yes | No | Own messages only |
| Student (can_message: false) | NO — read only | Yes (always) | No | No |

## UI Screens & Components
- Role picker in sidebar (web app) — shows only for logged-in user's available roles
- Role badge on staff list
- Role-based sidebar navigation — different nav items per role
- Role-based dashboard per role (Admin, Owner, Principal, Coordinator, Teacher, Student)

## Data & Fields

### Profile Edit Rules
| Field | Self Edit | Who Can Edit |
|---|---|---|
| full_name, profile_image, about, interests, languages, social_links | YES | User themselves |
| email | NO | Superior role via Edge Function |
| password | NO | Superior role via Edge Function |
| role, school_id, branch_id, class_id | NO | System only |
| is_active | NO | Superior role |
| grow_coins, total_coins_spent | NO | System automatic |
| expo_push_token, device_tokens | NO | System — set on login |
| biometric_id, default_fee | NO | Owner / Principal / Coordinator |
| can_message | NO | Owner / Principal / Coordinator per student (default: false) |

## Business Rules & Logic
- `can_message` default: **false** for all students — must be explicitly enabled per student
- A user cannot edit their own role, `school_id`, `branch_id`, or `class_id`
- Superior role = role that can create the target role
- Role change must trigger immediate force logout (`auth.admin.signOut(userId)`) — CRITICAL
- Account `is_active = false` → 403 immediately — no grace period

## API / Integrations
- **Custom JWT Hook:** Injects `role`, `school_id`, `branch_id`, `class_id` into every JWT at login
- **isActive Middleware:** 3 checks on every request:
  - `profiles.is_active = false` → 403 — Account inactive
  - `schools.is_active = false` → 403 — School inactive
  - `branches.is_active = false` → 403 — Branch inactive
- **Edge Functions:** `update-credentials` for email/password changes (Service Role Key required)

## Open Questions / Missing Info
- How does the Coordinator role differ from Principal in practice beyond "same as Principal but right-hand"? Any explicit restrictions not listed?
- Can a Teacher be incharge of more than one class? (Doc implies one class per teacher — "Teacher already incharge of another class" error suggests UNIQUE on teacher + class)
- Can Owner be their own Principal or Coordinator? (Not specified)
- `can_message` — can a student toggle it themselves? (Doc says no, but student UX for this is not described)
