# Context: Authentication

## What Was Built
Full authentication system for GrowVibe web app — Supabase Auth integration, login page, protected routes, auth Redux slice, and database foundation (profiles, schools, branches tables + trigger + JWT hook).

## Feature Scope
- Phase 1 (Foundation) — Auth piece
- No self-service registration — accounts created by superior role via Edge Function
- No forgot password — superior role resets credentials
- Max 2 devices per user (enforced at login, tracked in `profiles.device_tokens` jsonb)
- Custom JWT Hook embeds `role + school_id + branch_id + class_id` into every token
- isActive checks: user → school → branch (all three must be active)

## Files Changed / Created

### New Files
| File | Purpose |
|---|---|
| `growvibe-v1/CLAUDE.md` | Project-wide rules (migration rule, frontend rules) |
| `growvibe-v1/supabase/migrations/20260411000001_create_schools_branches.sql` | schools + branches tables (no owner_id FK yet) |
| `growvibe-v1/supabase/migrations/20260411000002_create_profiles.sql` | profiles table + RLS + adds owner_id FK back to schools |
| `growvibe-v1/supabase/migrations/20260411000003_profiles_trigger.sql` | Auto-create profile on auth.users insert |
| `growvibe-v1/supabase/migrations/20260411000004_custom_jwt_hook.sql` | JWT hook: embeds role/school_id/branch_id/class_id |
| `growvibe-web-v1/src/lib/supabase.js` | Supabase JS client (anon key) |
| `growvibe-web-v1/.env.local` | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY |
| `growvibe-web-v1/src/store/authSlice.js` | Auth state, loginThunk, logoutThunk, initAuthThunk |
| `growvibe-web-v1/src/styles/colors.js` | Shared color tokens (C), FONT, RADIUS constants |
| `growvibe-web-v1/src/pages/auth/LoginPage.jsx` | Split-screen login — thin page, imports all sub-components |
| `growvibe-web-v1/src/components/auth/BrandingPanel.jsx` | Left blue branding panel |
| `growvibe-web-v1/src/components/auth/ProtectedRoute.jsx` | Route guard (redirects to /login if no session) |
| `growvibe-web-v1/src/components/ui/Spinner.jsx` | Reusable spinner + ButtonSpinner |
| `growvibe-web-v1/src/components/ui/FormInput.jsx` | Formik-connected labeled input with password toggle + field error |
| `growvibe-web-v1/src/components/ui/ErrorBanner.jsx` | Redux-level error alert box |

### Modified Files
| File | Change |
|---|---|
| `growvibe-web-v1/src/store/index.js` | Added authReducer |
| `growvibe-web-v1/src/store/roleSlice.js` | Removed hardcoded mock userData; currentRole set by auth |
| `growvibe-web-v1/src/App.jsx` | Added /login route (public), wrapped all other routes in ProtectedRoute, dispatch initAuthThunk on mount |
| `growvibe-web-v1/src/components/layout/Sidebar.jsx` | Removed role picker dropdown, added logout button |
| `growvibe-web-v1/src/components/layout/Header.jsx` | Reads user name from auth.profile instead of mock userData |

## SQL Applied (Order Matters)
Run in this exact order in Supabase Dashboard → SQL Editor:

1. `20260411000001_create_schools_branches.sql` — schools + branches, no profiles FK yet
2. `20260411000002_create_profiles.sql` — profiles + adds owner_id FK back onto schools + RLS for all 3 tables
3. `20260411000003_profiles_trigger.sql` — trigger on auth.users
4. `20260411000004_custom_jwt_hook.sql` — JWT hook function

**After SQL #4:** Register JWT hook in Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook → select `public.custom_access_token_hook`.

## Key Decisions
- **Circular FK (profiles ↔ schools):** schools created first without owner_id FK. FK added at end of migration 2 after profiles exists.
- **authSlice separate from roleSlice:** authSlice holds session + profile; roleSlice holds only `currentRole` string.
- **isActive check on frontend:** UX-only for fast error messages. Real enforcement is RLS on backend.
- **Formik + Yup:** All form validation via Formik Field component + Yup schema. No manual onChange/state for inputs.
- **colors.js:** All color tokens in one file. Import `C` everywhere — no hardcoded hex values in components.

## Error Messages
- Wrong credentials: `"Invalid email or password."`
- Account inactive: `"Your account is inactive. Please contact your school."`
- School inactive: `"Your school is currently inactive. Please contact the administrator."`
- Branch inactive: `"Your branch is currently inactive. Please contact your school."`
- Network error: `"Connection error. Please try again."`

## Gotchas
- JWT hook must be registered manually in Supabase Dashboard after SQL is applied
- `supabase_auth_admin` role must be granted EXECUTE on the hook function (done in migration 4)
- `.env.local` is gitignored — never commit keys
- Circular FK was the cause of migration errors — always apply schools/branches before profiles

---

## Pending / To Do Later

- [ ] **`create-user` Edge Function** — Currently no way to create users. Admin needs an Edge Function (`create-user`) that calls `auth.admin.createUser()` with role + name in `raw_user_meta_data`. Without this, no users can be created except manually via Supabase Dashboard. *(Phase 1 — before any role can onboard)*

- [ ] **`update-credentials` Edge Function** — Password/email reset by superior role. Currently no self-service or admin reset flow exists. *(Phase 1)*

- [ ] **Device limit enforcement (2 devices)** — Currently frontend UX only (no check implemented yet). Needs to be enforced in the `create-user` or a dedicated login Edge Function that checks `device_tokens` array length and blocks a 3rd login. *(Phase 1 security item #16)*

- [ ] **Force logout on role/credential change** — When a superior role changes another user's role or credentials, `auth.admin.signOut(userId)` must be called immediately. Currently not wired up anywhere. *(Security item #1)*

- [ ] **`profiles.class_id` FK** — Currently `class_id` is a plain `uuid` column with no FK. FK to `classes` table must be added in Phase 2 when the `classes` table is created.

- [ ] **RLS policies incomplete** — Only `select` and `update own` policies exist on profiles. Admin/Owner/Principal write policies not yet defined. Will expand per-table as each feature is built.

- [ ] **`initAuthThunk` does not re-check isActive** — On session restore (page refresh), `is_active` is not re-validated. If an account is deactivated while logged in, user stays logged in until next explicit login. Consider adding isActive check in `initAuthThunk` or via a Supabase Realtime listener. *(Security hardening)*
