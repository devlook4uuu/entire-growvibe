-- ============================================================
-- Migration: Custom JWT Hook
-- Embeds role + school_id + branch_id + class_id + is_active
-- into every Supabase access token
--
-- After applying this SQL:
-- 1. Go to Supabase Dashboard → Authentication → Hooks
-- 2. Enable "Custom Access Token Hook"
-- 3. Select function: public.custom_access_token_hook
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims    jsonb;
  prof      record;
begin
  select role, school_id, branch_id, class_id, is_active
  into prof
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if prof is not null then
    claims := jsonb_set(claims, '{role}',      to_jsonb(prof.role));
    claims := jsonb_set(claims, '{school_id}', to_jsonb(coalesce(prof.school_id::text, '')));
    claims := jsonb_set(claims, '{branch_id}', to_jsonb(coalesce(prof.branch_id::text, '')));
    claims := jsonb_set(claims, '{class_id}',  to_jsonb(coalesce(prof.class_id::text, '')));
    claims := jsonb_set(claims, '{is_active}', to_jsonb(prof.is_active));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant execute to supabase_auth_admin (required for hook to work)
grant execute
  on function public.custom_access_token_hook
  to supabase_auth_admin;

-- Revoke from public (security: only auth admin should call this)
revoke execute
  on function public.custom_access_token_hook
  from public;
