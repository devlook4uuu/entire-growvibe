import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateSchoolCache } from './useSchoolList';
import { invalidateOwnerCache } from './useOwnerList';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSchoolForm(schoolId) {
  const isEdit = !!schoolId;

  const [school, setSchool]           = useState(null);
  const [fetching, setFetching]       = useState(isEdit);
  const [fetchError, setFetchError]   = useState(null);

  // Available owners list (for picker)
  const [availableOwners, setAvailableOwners] = useState([]);
  const [ownersLoading, setOwnersLoading]     = useState(true);

  // ── Load school (edit only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('schools_with_details')
        .select(
          'id, name, logo_url, school_address, school_contact, is_active, owner_id, ' +
          'owner_name, owner_email, owner_avatar_url, total_subscription_fee, active_branch_count'
        )
        .eq('id', schoolId)
        .single();

      if (cancelled) return;
      if (error || !data) setFetchError(error?.message || 'School not found.');
      else setSchool(data);
      setFetching(false);
    })();

    return () => { cancelled = true; };
  }, [schoolId, isEdit]);

  // ── Load available owners ─────────────────────────────────────────────────
  // Always fetched: create mode needs the full list, edit mode needs it for the dropdown.
  // The current owner (if any) is fetched separately from schools_with_details above.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setOwnersLoading(true);
      const { data } = await supabase
        .from('available_owners')
        .select('id, name, email, avatar_url')
        .order('name');

      if (cancelled) return;
      setAvailableOwners(data ?? []);
      setOwnersLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Save (create or edit) ─────────────────────────────────────────────────
  // values: { name, school_address, school_contact, is_active, selectedOwnerId, logoUrl }
  // Returns { success: true } or { success: false, error: string }
  async function save(values) {
    const { name, school_address, school_contact, is_active, selectedOwnerId, logoUrl } = values;

    try {
      if (!isEdit) {
        // ── Create ──────────────────────────────────────────────────────────
        const { data: newSchool, error: insertError } = await supabase
          .from('schools')
          .insert({ name: name.trim(), school_address, school_contact, is_active, ...(logoUrl != null ? { logo_url: logoUrl } : {}) })
          .select('id')
          .single();

        if (insertError) throw new Error(insertError.message);

        // Assign owner if one was selected
        if (selectedOwnerId) {
          const { error: rpcError } = await supabase.rpc('assign_school_owner', {
            p_school_id:    newSchool.id,
            p_new_owner_id: selectedOwnerId,
            p_old_owner_id: null,
          });
          if (rpcError) throw new Error(rpcError.message);
        }

      } else {
        // ── Edit ────────────────────────────────────────────────────────────
        const { error: updateError } = await supabase
          .from('schools')
          .update({ name: name.trim(), school_address, school_contact, is_active, updated_at: new Date().toISOString(), ...(logoUrl != null ? { logo_url: logoUrl } : {}) })
          .eq('id', schoolId);

        if (updateError) throw new Error(updateError.message);

        // Handle owner change (includes: assign, re-assign, or remove)
        const oldOwnerId = school?.owner_id ?? null;
        const ownerChanged = selectedOwnerId !== oldOwnerId;

        if (ownerChanged) {
          const { error: rpcError } = await supabase.rpc('assign_school_owner', {
            p_school_id:    schoolId,
            p_new_owner_id: selectedOwnerId,  // null = remove owner
            p_old_owner_id: oldOwnerId,
          });
          if (rpcError) throw new Error(rpcError.message);
        }
      }

      // Invalidate both caches so lists reflect the change immediately
      invalidateSchoolCache();
      invalidateOwnerCache();

      return { success: true };

    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return {
    isEdit,
    school,
    fetching,
    fetchError,
    availableOwners,
    ownersLoading,
    save,
  };
}
