// Edge Function: create-user
// Creates a new auth user for any role and inserts their profile row.
// Caller must be authenticated. Role-based creation rules:
//   - admin       → can create: owner
//   - owner       → can create: principal
//   - principal   → can create: coordinator, teacher, student
//   - coordinator → can create: student
//
// Deploy: supabase functions deploy create-user
//
// Request body:
//   {
//     name:         string  (required)
//     email:        string  (required)
//     password:     string  (required, min 6 chars)
//     role:         string  (required) one of: owner | principal | coordinator | teacher | student
//     school_id?:   string  (uuid, optional — inherits from caller if not provided)
//     branch_id?:   string  (uuid, optional — inherits from caller if not provided)
//     class_id?:    string  (uuid, optional — for student role)
//     student_fee?: number  (optional — for student role, defaults to 0)
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CREATION_RULES: Record<string, string[]> = {
  admin:       ['owner'],
  owner:       ['principal', 'coordinator', 'teacher', 'student'],
  principal:   ['coordinator', 'teacher', 'student'],
  coordinator: ['teacher', 'student'],
};

const VALID_ROLES = ['owner', 'principal', 'coordinator', 'teacher', 'student'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Get caller's profile + role ─────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, school_id, branch_id')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile) {
      return json({ error: 'Could not verify caller role' }, 403);
    }

    // ── 3. Parse and validate body ─────────────────────────────────────────
    const body = await req.json();
    const { name, email, password, role, school_id, branch_id, class_id, student_fee } = body;

    if (!name || !email || !password || !role) {
      return json({ error: 'name, email, password, and role are required' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);
    }

    // ── 4. Check caller is allowed to create this role ─────────────────────
    const allowedToCreate = CREATION_RULES[callerProfile.role] ?? [];
    if (!allowedToCreate.includes(role)) {
      return json({ error: `Forbidden: ${callerProfile.role} cannot create ${role}` }, 403);
    }

    // ── 5. Create auth user ────────────────────────────────────────────────
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email:         email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role },
    });

    if (createError) {
      return json({ error: createError.message }, 400);
    }

    // ── 6. Upsert profile (trigger may have already inserted a partial row) ─
    const profilePayload: Record<string, unknown> = {
      id:         newUser.user.id,
      role,
      name:       name.trim(),
      email:      email.trim(),
      is_active:  true,
      updated_at: new Date().toISOString(),
    };

    // Inherit school/branch from caller if not explicitly provided
    profilePayload.school_id = school_id ?? callerProfile.school_id ?? null;
    profilePayload.branch_id = branch_id ?? callerProfile.branch_id ?? null;

    // Student-specific fields (always set for student role so upsert overwrites trigger defaults)
    if (role === 'student') {
      profilePayload.class_id    = class_id    || null;
      profilePayload.student_fee = student_fee ?? 0;
    }

    const { data: profile, error: upsertError } = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      return json({ error: upsertError.message }, 400);
    }

    // ── 7. Auto-add student to their class chat ────────────────────────────
    if (role === 'student' && class_id) {
      // Find the chat for this class
      const { data: chat } = await adminClient
        .from('chats')
        .select('id')
        .eq('class_id', class_id)
        .maybeSingle();

      if (chat) {
        await adminClient.rpc('add_chat_member', {
          p_chat_id:          chat.id,
          p_profile_id:       newUser.user.id,
          p_school_id:        profilePayload.school_id,
          p_can_send_message: false,   // students default to read-only
        });
      }
    }

    return json({ success: true, profile }, 200);

  } catch (err) {
    console.error('create-user error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
