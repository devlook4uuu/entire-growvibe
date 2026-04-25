/**
 * useStaffList(role, branchId)
 *
 * Branch-scoped staff list hook for principal, coordinator, teacher.
 * Cache key: `${role}|${branchId}|${query}`
 *
 * Teacher rows also join class_name (null until class feature is built).
 */

import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 10;

// Module-level cache (survives unmount/remount), keyed by role|branchId|query
const cache = makeListCache(
  'staff',
  (scope, q) => `${scope}|${q}`,
);

export function invalidateStaffCache(role, branchId) {
  // Invalidate all entries for this role+branch combo
  const prefix = `${role}|${branchId}|`;
  Object.keys(cache.store).forEach((k) => {
    if (k.startsWith(prefix)) delete cache.store[k];
  });
}

export function invalidateAllStaffCache() {
  cache.invalidateAll();
}

export function useStaffList(role, branchId) {
  return useBaseList({
    cache,
    scope: `${role}|${branchId ?? ''}`,
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      // Teachers: include class name via FK join to classes table.
      // Other roles: plain profiles query.
      const isTeacher = role === 'teacher';
      let q = isTeacher
        ? supabase
            .from('teachers_with_class')
            .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, class_name, created_at')
            .eq('branch_id', branchId ?? '')
            .order('created_at', { ascending: false })
            .range(from, to)
        : supabase
            .from('profiles')
            .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, created_at')
            .eq('role', role)
            .eq('branch_id', branchId ?? '')
            .order('created_at', { ascending: false })
            .range(from, to);

      if (query.trim()) {
        q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      }
      return q;
    },
  });
}
