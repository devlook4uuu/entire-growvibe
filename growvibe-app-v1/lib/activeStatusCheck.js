/**
 * activeStatusCheck
 *
 * Runs a join query to check whether the current user's profile,
 * school, and branch are all still active. Returns an error string if any
 * check fails, or null if everything is fine.
 *
 * Admin role: only profile.is_active is checked (no school/branch).
 */

import { supabase } from './supabase';

export const INACTIVE_ERRORS = {
  USER:   'Your account has been deactivated. Contact your school.',
  SCHOOL: 'Your school has been deactivated. Contact admin.',
  BRANCH: 'Your branch has been deactivated. Contact your school.',
};

/**
 * @param {string} role — profile role string (e.g. 'admin', 'owner', 'teacher' …)
 * @returns {Promise<string|null>} error message or null
 */
export async function checkActiveStatus(role) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return INACTIVE_ERRORS.USER;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active, school_id, branch_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) return INACTIVE_ERRORS.USER;

    if (role !== 'admin' && profile.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('is_active')
        .eq('id', profile.school_id)
        .maybeSingle();
      if (school && !school.is_active) return INACTIVE_ERRORS.SCHOOL;
    }

    if (role !== 'admin' && profile.branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('is_active')
        .eq('id', profile.branch_id)
        .maybeSingle();
      if (branch && !branch.is_active) return INACTIVE_ERRORS.BRANCH;
    }

    return null;
  } catch {
    return null; // network error — don't log out on connectivity issues
  }
}
