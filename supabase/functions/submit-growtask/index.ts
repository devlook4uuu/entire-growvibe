// Edge Function: submit-growtask
// Called by the incharge teacher to award GrowCoins to selected students
// for Discipline, Cleanliness, or Study improvement in the current week.
//
// Deploy: supabase functions deploy submit-growtask
//
// Request body:
//   {
//     grow_task_id: string   — uuid of the grow_task row
//     student_ids:  string[] — array of student profile uuids (max 5)
//     cycle_label:  string   — ISO week label e.g. '2026-W16'
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: caller client (respects RLS) ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // ── Service client (bypasses RLS for writes) ────────────────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Get caller identity ─────────────────────────────────────────────────
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Parse body ──────────────────────────────────────────────────────────
    const { grow_task_id, student_ids, cycle_label } = await req.json();

    if (!grow_task_id || !Array.isArray(student_ids) || !cycle_label) {
      return json({ error: 'Missing required fields: grow_task_id, student_ids, cycle_label' }, 400);
    }
    if (student_ids.length === 0) {
      return json({ error: 'Select at least 1 student' }, 400);
    }
    if (student_ids.length > 5) {
      return json({ error: 'Maximum 5 students allowed per panel' }, 400);
    }

    // ── Verify teacher is incharge of a class ───────────────────────────────
    const { data: classRow, error: classErr } = await adminClient
      .from('classes')
      .select('id, school_id')
      .eq('teacher_id', user.id)
      .maybeSingle();

    if (classErr) return json({ error: classErr.message }, 500);
    if (!classRow) return json({ error: 'You are not assigned as incharge of any class' }, 403);

    // ── Verify grow_task exists and is weekly ───────────────────────────────
    const { data: task, error: taskErr } = await adminClient
      .from('grow_tasks')
      .select('id, category, coins_reward, cycle, is_active')
      .eq('id', grow_task_id)
      .maybeSingle();

    if (taskErr) return json({ error: taskErr.message }, 500);
    if (!task)   return json({ error: 'GrowTask not found' }, 404);
    if (!task.is_active) return json({ error: 'This task is not active' }, 400);
    if (task.cycle !== 'weekly') return json({ error: 'Only weekly tasks can be submitted here' }, 400);

    // ── Verify not already submitted this cycle ─────────────────────────────
    // Scoped by awarded_by = teacher so each teacher's panel is independent
    const { data: existingSubmissions, error: existErr } = await adminClient
      .from('grow_task_submissions')
      .select('id')
      .eq('grow_task_id', grow_task_id)
      .eq('cycle_label', cycle_label)
      .eq('awarded_by', user.id)
      .limit(1);

    if (existErr) return json({ error: existErr.message }, 500);
    if (existingSubmissions && existingSubmissions.length > 0) {
      return json({ error: 'This panel has already been submitted for the current week' }, 409);
    }

    // ── Verify all student_ids belong to teacher's class ───────────────────
    const { data: validStudents, error: studErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('class_id', classRow.id)
      .eq('role', 'student')
      .eq('is_active', true)
      .in('id', student_ids);

    if (studErr) return json({ error: studErr.message }, 500);
    if (!validStudents || validStudents.length !== student_ids.length) {
      return json({ error: 'One or more students do not belong to your class' }, 403);
    }

    // ── Award coins to each selected student ────────────────────────────────
    const awarded: string[] = [];
    const skipped: string[] = [];

    for (const studentId of student_ids) {
      const { data: result, error: awardErr } = await adminClient.rpc('award_student_coins', {
        p_student_id:   studentId,
        p_grow_task_id: grow_task_id,
        p_cycle_label:  cycle_label,
        p_coins:        task.coins_reward,
        p_source:       `growtask_${task.category}`,
        p_school_id:    classRow.school_id,
        p_awarded_by:   user.id,
      });

      if (awardErr) return json({ error: awardErr.message }, 500);
      if (result) awarded.push(studentId);
      else        skipped.push(studentId); // already awarded (idempotent)
    }

    return json({ success: true, awarded, skipped });

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
