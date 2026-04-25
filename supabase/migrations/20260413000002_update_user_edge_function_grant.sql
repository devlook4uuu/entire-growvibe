-- ============================================================
-- Migration 6: Grants for update-user Edge Function
-- The Edge Function uses the service_role key so it bypasses RLS.
-- This migration documents the intent — no SQL objects needed.
-- ============================================================

-- The update-user function is deployed via:
--   supabase functions deploy update-user
--
-- It requires the following environment variables set in Supabase dashboard
-- (Project → Edge Functions → update-user → Secrets):
--   SUPABASE_URL             (auto-injected by Supabase runtime)
--   SUPABASE_ANON_KEY        (auto-injected by Supabase runtime)
--   SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase runtime)
--
-- No additional SQL grants are required because the function uses
-- the service_role key which already has full access.
--
-- RLS note: The function enforces its own role check (admin/owner/principal only).
-- Future: add an audit log trigger on profiles for is_active changes.

select 1; -- no-op to satisfy migration runner
