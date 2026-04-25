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
        // If activating: deactivate any existing active session for this branch first
        if (is_active) {
          await supabase
            .from('sessions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('branch_id', branchId)
            .eq('is_active', true);
        }

        const { error } = await supabase
          .from('sessions')
          .insert({
            school_id:     schoolId,
            branch_id:     branchId,
            session_name:  session_name.trim(),
            session_start,
            session_end,
            is_active,
          });

        if (error) throw new Error(error.message);

      } else {
        // ── Update ────────────────────────────────────────────────────────────
        // If activating this session: deactivate any other active session for the branch
        if (is_active && !session?.is_active) {
          await supabase
            .from('sessions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('branch_id', session.branch_id)
            .eq('is_active', true)
            .neq('id', sessionId);
        }

        const { error } = await supabase
          .from('sessions')
          .update({
            session_name:  session_name.trim(),
            session_start,
            session_end,
            is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        if (error) throw new Error(error.message);
      }

      invalidateSessionCache(branchId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return { isEdit, session, fetching, fetchError, save };
}
