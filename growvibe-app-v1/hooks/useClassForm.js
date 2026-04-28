/**
 * useClassForm(sessionId, schoolId, branchId, classId)
 *
 * Handles create / edit for a single class.
 *
 * Create path: calls create_class RPC (atomic: class + chat + chat_member + profile update).
 * Edit path  : fetches existing class; on save calls update_class_teacher RPC if teacher changed,
 *              then updates class_name if changed.
 *
 * Teacher picker: queries `available_teachers` view filtered by branchId.
 * In edit mode the current teacher is prepended so they remain selectable
 * even though they already have class_id set.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateClassCache } from './useClassList';

export function useClassForm(sessionId, schoolId, branchId, classId) {
  const isEdit = !!classId;

  const [cls,           setCls]           = useState(null);   // existing class record (edit)
  const [fetching,      setFetching]      = useState(isEdit);
  const [fetchError,    setFetchError]    = useState(null);

  // Teacher picker state
  const [teachers,      setTeachers]      = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);

  // ── Load existing class (edit mode) ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('classes_with_teacher')
        .select('id, school_id, branch_id, session_id, class_name, teacher_id, teacher_name, teacher_avatar, chat_id')
        .eq('id', classId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setFetchError(error?.message || 'Class not found.');
      } else {
        setCls(data);
      }
      setFetching(false);
    })();

    return () => { cancelled = true; };
  }, [classId, isEdit]);

  // ── Load available teachers ────────────────────────────────────────────────
  // Queries available_teachers view (unassigned + active teachers in branch).
  // In edit mode: fetches available list first, then prepends the current
  // teacher if they have a class assigned (so they remain selectable).
  const loadTeachers = useCallback(async (currentTeacherId) => {
    setTeachersLoading(true);
    try {
      const { data: available, error } = await supabase
        .from('available_teachers')
        .select('id, name, email, avatar_url, class_id')
        .eq('branch_id', branchId)
        .order('name', { ascending: true });

      if (error) throw error;

      let list = available ?? [];

      // In edit mode: if current teacher is already assigned (class_id != null),
      // they won't appear in available_teachers — prepend them manually.
      if (currentTeacherId) {
        const alreadyInList = list.some((t) => t.id === currentTeacherId);
        if (!alreadyInList) {
          const { data: currentTeacher } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, class_id')
            .eq('id', currentTeacherId)
            .single();
          if (currentTeacher) {
            list = [currentTeacher, ...list];
          }
        }
      }

      setTeachers(list);
    } catch (err) {
      // Non-fatal — teacher picker will just be empty
      setTeachers([]);
    } finally {
      setTeachersLoading(false);
    }
  }, [branchId]);

  // ── Save ────────────────────────────────────────────────────────────────────
  // values: { class_name: string, teacher_id: string | null }
  async function save(values) {
    const { class_name, teacher_id } = values;

    try {
      if (!isEdit) {
        // ── Create (atomic RPC) ───────────────────────────────────────────────
        const { error } = await supabase.rpc('create_class', {
          p_school_id:  schoolId,
          p_branch_id:  branchId,
          p_session_id: sessionId,
          p_class_name: class_name.trim(),
          p_teacher_id: teacher_id || null,
        });
        if (error) throw new Error(error.message);

      } else {
        // ── Edit ──────────────────────────────────────────────────────────────
        const oldTeacherId = cls?.teacher_id ?? null;
        const newTeacherId = teacher_id || null;
        const teacherChanged = oldTeacherId !== newTeacherId;
        const nameChanged    = class_name.trim() !== (cls?.class_name ?? '');

        // Swap teacher atomically if changed (handles chat_members + profile updates)
        if (teacherChanged) {
          const { error } = await supabase.rpc('update_class_teacher', {
            p_class_id:       classId,
            p_new_teacher_id: newTeacherId,
            p_old_teacher_id: oldTeacherId,
          });
          if (error) throw new Error(error.message);
        }

        // Update class_name if changed (teacher swap RPC already updates updated_at)
        if (nameChanged) {
          // Also patch class_name when teacherChanged — the RPC only touches teacher_id
          const { error } = await supabase
            .from('classes')
            .update({ class_name: class_name.trim() })
            .eq('id', classId);
          if (error) throw new Error(error.message);
        }
      }

      invalidateClassCache(sessionId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return { isEdit, cls, fetching, fetchError, teachers, teachersLoading, loadTeachers, save };
}
