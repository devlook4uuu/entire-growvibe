// Edge Function: send-push
// Sends Expo push notifications to a list of users.
// Caller must be authenticated (service role or admin).
//
// Deploy: supabase functions deploy send-push
//
// Request body:
//   {
//     userIds: string[]   — array of profile UUIDs to notify
//     title:   string     — notification title
//     body:    string     — notification body text
//     data?:   object     — optional extra payload passed to the app
//   }
//
// Logic:
//   1. Fetch push tokens for the given userIds
//   2. Send to Expo Push API in chunks of 20
//   3. Delete tokens that come back as DeviceNotRegistered

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE    = 20;

Deno.serve(async (req) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // ── Auth guard ───────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let userIds: string[], title: string, body: string, data: Record<string, unknown> | undefined;
  try {
    const payload = await req.json();
    userIds = payload.userIds;
    title   = payload.title;
    body    = payload.body;
    data    = payload.data ?? {};

    if (!Array.isArray(userIds) || !userIds.length) throw new Error('userIds must be a non-empty array');
    if (!title || !body) throw new Error('title and body are required');
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }

  // ── Supabase client (uses caller's JWT) ──────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Fetch tokens for the requested users ─────────────────────────────────
  const { data: rows, error: fetchError } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);

  if (fetchError) {
    return json({ error: fetchError.message }, 500);
  }

  if (!rows || rows.length === 0) {
    return json({ sent: 0, skipped: userIds.length });
  }

  // ── Build Expo message objects ────────────────────────────────────────────
  const messages = rows.map((row) => ({
    to:    row.token,
    title,
    body,
    data,
    sound:    'default',
    priority: 'high',
  }));

  // ── Send in chunks of 20 ─────────────────────────────────────────────────
  const staleTokens: string[] = [];
  let sent = 0;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);

    try {
      const res  = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error('[send-push] Expo API error', res.status, await res.text());
        continue;
      }

      const result = await res.json();
      const tickets: { status: string; details?: { error?: string } }[] = result.data ?? [];

      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') {
          sent++;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          staleTokens.push(chunk[idx].to);
        }
      });
    } catch (err) {
      console.error('[send-push] fetch error:', err);
    }
  }

  // ── Clean up stale tokens ─────────────────────────────────────────────────
  if (staleTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', staleTokens);
  }

  return json({ sent, stale: staleTokens.length });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  '*',
    },
  });
}
