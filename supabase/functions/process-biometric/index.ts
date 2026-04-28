// Edge Function: process-biometric
// Parses a ZK Teco K40 attlog.dat file and inserts attendance records.
//
// Request body (multipart/form-data OR JSON):
//   branch_id   — uuid of the target branch
//   date        — ISO date string (YYYY-MM-DD) selected by the user
//   file_text   — raw text content of the .dat file
//
// Returns:
//   { processed, present, late, skipped_manual, unknown_ids }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_ROLES = ['owner', 'principal', 'coordinator'];
const CHUNK_SIZE    = 20;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, school_id, branch_id')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || !ALLOWED_ROLES.includes(callerProfile.role)) {
      return json({ error: 'Forbidden: insufficient role' }, 403);
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────
    const body = await req.json();
    const { branch_id, date, file_text } = body as {
      branch_id: string;
      date:      string;
      file_text: string;
    };

    if (!branch_id || !date || !file_text) {
      return json({ error: 'branch_id, date, and file_text are required' }, 400);
    }

    // Scope check: branch must belong to caller's school
    const { data: branch } = await adminClient
      .from('branches')
      .select('id, school_id, late_threshold')
      .eq('id', branch_id)
      .single();

    if (!branch) return json({ error: 'Branch not found' }, 404);
    if (branch.school_id !== callerProfile.school_id) {
      return json({ error: 'Forbidden: branch not in your school' }, 403);
    }

    const lateThreshold = (branch.late_threshold as string | null) ?? '08:00:00';

    // ── 3. Parse the .dat file ─────────────────────────────────────────────
    // ZK Teco K40 actual format (leading spaces + tab-separated):
    //   "             1\t2026-04-26 19:41:38\t1\t0\t1\t0"
    // After trimming leading spaces and splitting by whitespace:
    //   col[0] = user_id, col[1] = date, col[2] = time, col[3]+ = other fields
    const lines = file_text.split('\n');
    // First punch only per device_user_id
    const firstPunch: Record<string, { time: string }> = {};

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const cols = line.split(/\s+/);
      if (cols.length < 3) continue;

      const deviceUserId = cols[0]?.trim();
      const punchTime    = cols[2]?.trim(); // HH:MM:SS

      if (!deviceUserId || !punchTime) continue;
      if (firstPunch[deviceUserId]) continue; // keep only first punch

      firstPunch[deviceUserId] = { time: punchTime };
    }

    const deviceIds = Object.keys(firstPunch);
    if (deviceIds.length === 0) {
      return json({ error: 'No valid records found in file' }, 422);
    }

    // ── 4. Match device_user_id → profiles ────────────────────────────────
    const { data: matchedProfiles } = await adminClient
      .from('profiles')
      .select('id, biometric_id, class_id, session_id, school_id')
      .eq('branch_id', branch_id)
      .eq('is_active', true)
      .not('biometric_id', 'is', null);

    const profilesByBiometric: Record<string, typeof matchedProfiles[0]> = {};
    for (const p of (matchedProfiles ?? [])) {
      if (p.biometric_id) profilesByBiometric[p.biometric_id.trim()] = p;
    }

    // ── 5. Fetch active session for this branch ────────────────────────────
    const { data: activeSession } = await adminClient
      .from('sessions')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!activeSession) {
      return json({ error: 'No active session found for this branch' }, 422);
    }
    const sessionId = activeSession.id;

    // ── 6. Fetch existing attendance for this date + session ───────────────
    const personIds = Object.values(profilesByBiometric).map((p) => p.id);
    let existingAttMap: Record<string, { source: string }> = {};

    if (personIds.length > 0) {
      const { data: existing } = await adminClient
        .from('attendance')
        .select('person_id, source')
        .eq('session_id', sessionId)
        .eq('date', date)
        .in('person_id', personIds);

      for (const r of (existing ?? [])) {
        existingAttMap[r.person_id] = { source: r.source };
      }
    }

    // ── 7. Build insert records ────────────────────────────────────────────
    const toInsert: Record<string, unknown>[] = [];
    const unknownIds: string[] = [];
    let skippedManual = 0;

    for (const deviceUserId of deviceIds) {
      const profile = profilesByBiometric[deviceUserId];
      if (!profile) {
        unknownIds.push(deviceUserId);
        continue;
      }

      const existing = existingAttMap[profile.id];
      if (existing?.source === 'manual') {
        skippedManual++;
        continue;
      }
      // If biometric already exists — will be overwritten via upsert

      const punchTime = firstPunch[deviceUserId].time; // HH:MM:SS
      const status    = punchTime <= lateThreshold ? 'present' : 'late';

      toInsert.push({
        school_id:  branch.school_id,
        branch_id:  branch_id,
        session_id: sessionId,
        person_id:  profile.id,
        role:       'student',
        class_id:   profile.class_id,
        date:       date,
        status,
        source:     'biometric',
        marked_by:  caller.id,
        updated_at: new Date().toISOString(),
      });
    }

    // ── 8. Insert in chunks of 20 ──────────────────────────────────────────
    let presentCount = 0;
    let lateCount    = 0;

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const { error: insertErr } = await adminClient
        .from('attendance')
        .upsert(chunk, { onConflict: 'person_id,session_id,date' });

      if (insertErr) {
        console.error('Chunk insert error:', insertErr);
        return json({ error: insertErr.message }, 500);
      }

      for (const r of chunk) {
        if (r.status === 'present') presentCount++;
        else if (r.status === 'late') lateCount++;
      }
    }

    // ── 9. Push notifications — absent students ────────────────────────────
    // Find all students in the branch who have NO attendance record for this date
    const { data: allBranchStudents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('role', 'student')
      .eq('is_active', true);

    const insertedPersonIds = new Set(toInsert.map((r) => r.person_id as string));
    const manualPresentIds  = Object.entries(existingAttMap)
      .filter(([_, v]) => v.source === 'manual')
      .map(([k]) => k);

    const absentIds: string[] = [];
    for (const s of (allBranchStudents ?? [])) {
      const hasAtt = insertedPersonIds.has(s.id) || manualPresentIds.includes(s.id);
      if (!hasAtt) absentIds.push(s.id);
    }

    // Push to absent
    if (absentIds.length > 0) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey':        Deno.env.get('SUPABASE_ANON_KEY')!,
        },
        body: JSON.stringify({
          userIds: absentIds,
          title:   'Attendance',
          body:    'Your attendance has been marked: Absent',
        }),
      }).catch(() => {});
    }

    // Push to late
    const latePersonIds = toInsert.filter((r) => r.status === 'late').map((r) => r.person_id as string);
    if (latePersonIds.length > 0) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey':        Deno.env.get('SUPABASE_ANON_KEY')!,
        },
        body: JSON.stringify({
          userIds: latePersonIds,
          title:   'Attendance',
          body:    'Your attendance has been marked: Late',
        }),
      }).catch(() => {});
    }

    // ── 10. Return summary ─────────────────────────────────────────────────
    return json({
      processed:      toInsert.length,
      present:        presentCount,
      late:           lateCount,
      skipped_manual: skippedManual,
      unknown_ids:    unknownIds,
    });

  } catch (err) {
    console.error('process-biometric error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
