import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateSessionCache } from './useSessionList';

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Handles create / edit for a single session.
// branchId and schoolId are required for create; sessionId is required for edit.
export function useSessionForm(branchId, schoolId, sessionId) {
  const isEdit = !!sessionId;

  const [session,    setSession]    = useState(null);
  const [fetching,   setFetching]   = useState(isEdit);
  const [fetchError, setFetchError] = useState(null);

  // ── Load session (edit only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('id, branch_id, school_id, session_name, session_start, session_end, is_active')
        .eq('id', sessionId)
        .single();

      if (cancelled) return;
      if (error || !data) setFetchError(error?.message || 'Session not found.');
      else setSession(data);
      setFetching(false);
    })();

    return () => { cancelled = true; };
  }, [sessionId, isEdit]);

  // ── Save ───────────────────────────────────────────────────────────────────
  // values: { session_name, session_start, session_end, is_active }
  async function save(values) {
    const { session_name, session_start, session_end, is_active } = values;

    try {
      if (!isEdit) {
        // ── Create ────────────────────────────────────────────────────────────
        // Insert with is_active=false first, then atomically activate via RPC if needed.
        const { data: inserted, error: insertError } = await supabase
          .from('sessions')
          .insert({
            school_id:     schoolId,
            branch_id:     branchId,
            session_name:  session_name.trim(),
            session_start,
            session_end,
            is_active:     false,
          })
          .select('id')
          .single();

        if (insertError) throw new Error(insertError.message);

        if (is_active) {
          const { error: rpcError } = await supabase.rpc('activate_session', {
            p_session_id: inserted.id,
          });
          if (rpcError) throw new Error(rpcError.message);
        }

      } else {
        // ── Update ────────────────────────────────────────────────────────────
        const { error } = await supabase
          .from('sessions')
          .update({
            session_name:  session_name.trim(),
            session_start,
            session_end,
            is_active,
          })
          .eq('id', sessionId);

        if (error) throw new Error(error.message);

        // If toggling to active, atomically deactivate sibling sessions via RPC
        if (is_active && !session?.is_active) {
          const { error: rpcError } = await supabase.rpc('activate_session', {
            p_session_id: sessionId,
          });
          if (rpcError) throw new Error(rpcError.message);
        }
      }

      invalidateSessionCache(branchId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return { isEdit, session, fetching, fetchError, save };
}
