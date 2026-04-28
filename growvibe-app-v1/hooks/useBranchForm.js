import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateBranchCache } from './useBranchList';
import { invalidateSchoolCache } from './useSchoolList';

// Ordered list used for the off-days picker UI
export const ALL_DAYS = [
  { key: 'monday',    label: 'Mon' },
  { key: 'tuesday',   label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday',  label: 'Thu' },
  { key: 'friday',    label: 'Fri' },
  { key: 'saturday',  label: 'Sat' },
  { key: 'sunday',    label: 'Sun' },
];

// Pre-built presets shown as quick-select buttons
export const OFF_DAY_PRESETS = [
  { label: 'Fri – Sun', days: ['friday', 'saturday', 'sunday'] },
  { label: 'Sat – Sun', days: ['saturday', 'sunday'] },
  { label: 'Sun only',  days: ['sunday'] },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBranchForm(schoolId, branchId) {
  const isEdit = !!branchId;

  const [branch, setBranch]         = useState(null);
  const [fetching, setFetching]     = useState(isEdit);
  const [fetchError, setFetchError] = useState(null);

  // ── Load branch (edit only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('branches_with_off_days')
        .select(
          'id, school_id, name, branch_address, branch_contact, ' +
          'branch_subscription_fee, is_active, off_days'
        )
        .eq('id', branchId)
        .single();

      if (cancelled) return;
      if (error || !data) setFetchError(error?.message || 'Branch not found.');
      else setBranch(data);
      setFetching(false);
    })();

    return () => { cancelled = true; };
  }, [branchId, isEdit]);

  // ── Save ──────────────────────────────────────────────────────────────────
  // values: { name, branch_address, branch_contact, branch_subscription_fee, is_active, offDays: string[] }
  async function save(values) {
    const {
      name, branch_address, branch_contact,
      branch_subscription_fee, is_active, offDays,
    } = values;

    try {
      if (!isEdit) {
        // ── Create branch ──────────────────────────────────────────────────
        const { data: newBranch, error: insertError } = await supabase
          .from('branches')
          .insert({
            school_id: schoolId,
            name: name.trim(),
            branch_address:          branch_address || null,
            branch_contact:          branch_contact || null,
            branch_subscription_fee: Number(branch_subscription_fee) || 0,
            is_active,
          })
          .select('id')
          .single();

        if (insertError) throw new Error(insertError.message);

        // Insert off days
        if (offDays.length > 0) {
          const { error: offError } = await supabase
            .from('branch_off_days')
            .insert(offDays.map((day) => ({ branch_id: newBranch.id, school_id: schoolId, day_of_week: day })));
          if (offError) throw new Error(offError.message);
        }

      } else {
        // ── Update branch ──────────────────────────────────────────────────
        const { error: updateError } = await supabase
          .from('branches')
          .update({
            name: name.trim(),
            branch_address:          branch_address || null,
            branch_contact:          branch_contact || null,
            branch_subscription_fee: Number(branch_subscription_fee) || 0,
            is_active,
          })
          .eq('id', branchId);

        if (updateError) throw new Error(updateError.message);

        // Replace off days: delete all then re-insert
        const { error: delError } = await supabase
          .from('branch_off_days')
          .delete()
          .eq('branch_id', branchId);
        if (delError) throw new Error(delError.message);

        if (offDays.length > 0) {
          const { error: offError } = await supabase
            .from('branch_off_days')
            .insert(offDays.map((day) => ({ branch_id: branchId, school_id: schoolId, day_of_week: day })));
          if (offError) throw new Error(offError.message);
        }
      }

      // Invalidate caches — branch list + school list (total_subscription_fee changes)
      invalidateBranchCache(schoolId);
      invalidateSchoolCache();

      return { success: true };

    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return { isEdit, branch, fetching, fetchError, save };
}
