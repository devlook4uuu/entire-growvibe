# GrowVibe — Product Features Overview

GrowVibe is a multi-tenant, multi-branch SaaS school management platform with an integrated student motivation ecosystem. Students earn GrowCoins through attendance and teacher recognition, then redeem them in an integrated ecommerce store for discounted or free products.

**Version:** v1.0  
**Author:** Abdullah — Lahore, Pakistan — 2026  
**Stack:** Supabase + PostgreSQL + Vite + React + Expo React Native  
**Design:** Poppins + Navy + White + Gray + shadcn/ui

---

## Overall Architecture Notes

- **Multi-tenant:** Each school is a tenant. Data is isolated via RLS (Row Level Security) on every table.
- **Multi-branch:** A school can have multiple branches. Each branch is independent in sessions, classes, attendance, and staff.
- **Dual platform:** Web app (Vite + React) for Admin/Owner/Principal/Coordinator/Teacher. Mobile app (Expo RN) for Students (and mobile-optimized teacher views).
- **Auth:** Supabase Auth + JWT + Custom JWT Hook that embeds `role`, `school_id`, `branch_id`, `class_id` in every token.
- **Realtime:** Supabase Realtime for group chat.
- **Push Notifications:** Expo Push Notifications — chunked at 20 tokens per send.
- **Background Jobs:** `pg_cron` handles weekly/monthly coin awards and biometric retry.
- **Edge Functions:** All privileged operations (create user, credentials change, PDF generation, close delivery week, award coins) run server-side via Supabase Edge Functions with Service Role Key — never exposed to frontend.
- **No hard deletes:** Users, schools, branches, fees — nothing is ever deleted. Only `is_active = false`.
- **Core Differentiator:** GrowCoins + Ecommerce loop — students earn coins via attendance and teacher recognition, spend them in an integrated store for discounts or free products.

---

## Revenue Model

| Stream | How | Rate | 20 Schools Estimate |
|---|---|---|---|
| SaaS | Per school monthly subscription | PKR 3,500/month | PKR 70,000/month |
| Ecommerce Margin | Products sold in store | PKR 150–250/item | PKR 80,000–130,000/month |
| Free Delivery | Bulk school delivery | Zero logistics cost | Full margin protected |

---

## Features Index

| # | Feature | File | Status in Doc |
|---|---|---|---|
| 01 | Product Overview & Tech Stack | [01-product-overview.md](01-product-overview.md) | Defined |
| 02 | Roles & Permissions | [02-roles-permissions.md](02-roles-permissions.md) | Defined |
| 03 | Authentication & Authorization | [03-authentication.md](03-authentication.md) | Defined |
| 04 | School & Branch Management | [04-school-branch-management.md](04-school-branch-management.md) | Defined |
| 05 | Session Management | [05-session-management.md](05-session-management.md) | Defined |
| 06 | Staff & Student Management | [06-staff-student-management.md](06-staff-student-management.md) | Defined |
| 07 | Attendance Management | [07-attendance.md](07-attendance.md) | Defined |
| 08 | Group Chat | [08-group-chat.md](08-group-chat.md) | Defined |
| 09 | Fee Management | [09-fee-management.md](09-fee-management.md) | Defined |
| 10 | GrowCoins & GrowTasks System | [10-growcoins-growtasks.md](10-growcoins-growtasks.md) | Defined |
| 11 | E-Commerce Store | [11-ecommerce-store.md](11-ecommerce-store.md) | Defined |
| 12 | Timetable Management | [12-timetable.md](12-timetable.md) | Defined |
| 13 | Academic Features (Results, Exams, Diary, Leaderboard) | [13-academic-features.md](13-academic-features.md) | Defined |
| 14 | Online Classes | [14-online-classes.md](14-online-classes.md) | Defined |
| 15 | Applications (Leave) | [15-applications.md](15-applications.md) | Defined |
| 16 | Notes & Announcements | [16-notes-announcements.md](16-notes-announcements.md) | Defined |
| 17 | Support Tickets | [17-support-tickets.md](17-support-tickets.md) | Defined |
| 18 | Push Notifications | [18-push-notifications.md](18-push-notifications.md) | Defined |
| 19 | Security Checklist | [19-security.md](19-security.md) | Defined |
| 20 | Database Schema Reference | [20-database-schema.md](20-database-schema.md) | Defined |
| 21 | Build Order & Phases | [21-build-order.md](21-build-order.md) | Defined |
