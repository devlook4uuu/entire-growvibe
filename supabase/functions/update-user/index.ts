// Edge Function: update-user
// Updates auth.users (email, password) AND profiles (name, is_active) for a given user.
// Must be called with the service_role key — only admins/owners should reach this.
//
// Deploy: supabase functions deploy update-user
//
// Request body:
//   {
//     user_id:      string   (required) uuid of the user to update
//     email?:       string   new email
//     password?:    string   new password (min 6 chars)
//     name?:        string   new display name
//     is_active?:   boolean  activate / deactivate the account
//     student_fee?: number   updated fee amount (for student role)
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    // Create a client scoped to the caller's JWT to verify identity + role
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Fetch caller's profile to check role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile) {
      return json({ error: 'Could not verify caller role' }, 403);
    }

    const allowedRoles = ['admin', 'owner', 'principal', 'coordinator'];
    if (!allowedRoles.includes(callerProfile.role)) {
      return json({ error: 'Forbidden: insufficient role' }, 403);
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────
    const body = await req.json();
    const { user_id, email, password, name, is_active, student_fee } = body;

    if (!user_id) {
      return json({ error: 'user_id is required' }, 400);
    }

    // ── 3. Update auth.users (email / password) ────────────────────────────
    const authUpdates: Record<string, unknown> = {};
    if (email)    authUpdates.email    = email;
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
        user_id,
        authUpdates
      );
      if (updateAuthError) {
        return json({ error: updateAuthError.message }, 400);
      }
    }

    // ── 4. Update profiles table (name / email / is_active) ───────────────
    const profileUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name        !== undefined) profileUpdates.name        = name;
    if (email       !== undefined) profileUpdates.email       = email;
    if (is_active   !== undefined) profileUpdates.is_active   = is_active;
    if (student_fee !== undefined) profileUpdates.student_fee = student_fee;

    const { data: updatedProfile, error: updateProfileError } = await adminClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user_id)
      .select()
      .single();

    if (updateProfileError) {
      return json({ error: updateProfileError.message }, 400);
    }

    return json({ success: true, profile: updatedProfile }, 200);

  } catch (err) {
    console.error('update-user error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
