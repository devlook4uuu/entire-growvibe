# Product Overview & Tech Stack

## Overview
GrowVibe is a multi-tenant, multi-branch SaaS school management platform with an integrated student motivation ecosystem. Students earn GrowCoins through attendance and teacher recognition, then redeem them in an integrated ecommerce store for discounted or free products. This coin + ecommerce loop is the core differentiator — competitors do not have this.

## User Roles & Access
All roles — this document defines the platform as a whole.

## Core Functionality
- Multi-tenant SaaS: each school is a separate tenant
- Multi-branch: each school can have multiple branches
- Role-based access control across 6 roles
- Dual platform: Web (Admin/Staff) + Mobile App (Students/Teachers)
- GrowCoins motivation system integrated with ecommerce
- Bulk school delivery with zero logistics cost

## UI Screens & Components
- Web app: Sidebar + Content layout (Notion/Linear style)
- Mobile app: 5 bottom tabs — Home, Classes, Chat, Store, Profile
- Design system: shadcn/ui components

## Data & Fields
Not a feature itself — see individual feature files for data fields.

## Business Rules & Logic

### Revenue Model
| Stream | How | Rate | 20 Schools Estimate |
|---|---|---|---|
| SaaS | Per school monthly subscription | PKR 3,500/month | PKR 70,000/month |
| Ecommerce Margin | Products sold in store | PKR 150–250/item | PKR 80,000–130,000/month |
| Free Delivery | Bulk school delivery | Zero logistics cost | Full margin protected |

### Non-Negotiable Design Rules
| Rule | Value | Why |
|---|---|---|
| Font | Poppins | Friendly, rounded, popular in apps |
| Colors | Navy + White + Gray | Professional, school environment |
| Card Style | Flat — no shadows | Clean modern look |
| Web Layout | Sidebar + Content | Notion/Linear style |
| App Tabs | 5 bottom tabs | Home, Classes, Chat, Store, Profile |
| App Feel | Instagram/WhatsApp patterns | Familiar UX |
| Components | shadcn/ui | Pre-built accessible — fast dev |
| Language | English only (v1) | Urdu in v2 |
| Mode | Light mode only | Dark mode in v2 |

## API / Integrations

### Tech Stack
| Layer | Technology |
|---|---|
| Backend | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth + JWT + RLS |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Push Notifications | Expo Push Notifications |
| Web Frontend | Vite + React + shadcn/ui + Tailwind + Redux Toolkit |
| Mobile App | Expo React Native |

### Key Technical Patterns
- **Custom JWT Hook:** Embeds `role`, `school_id`, `branch_id`, `class_id` into every token
- **Edge Functions:** All privileged ops (create user, PDF gen, coins, order close) — Service Role Key never in frontend
- **RLS:** Enabled on every table — Anon Key enforces it on frontend
- **pg_cron:** Weekly (Saturday 6:59 PM UTC) + monthly coin awards, biometric retry, online class reminders
- **Expo Push:** Chunked at 20 tokens per send. Invalid token → set `expo_push_token = null`. Max 2 devices per user
- **No hard deletes:** Everything is `is_active = false` — data preserved always
- **Atomic transactions:** Session switch, coin deduction, order placement, voucher claim all atomic

## Open Questions / Missing Info
- What is the exact Supabase project structure (single project vs. per-school)?
- How are school admin credentials initially delivered? (mentioned: "manually" — email/WhatsApp?)
- Urdu support timeline for v2 not specified beyond "v2"
- Dark mode v2 — no timeline given
- Web app vs mobile app feature parity — some features appear web-only (Admin/Owner screens), some app-only (Student home). Full mapping not explicitly listed for every role
