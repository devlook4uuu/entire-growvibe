/**
 * useStudentList(classId, viewerRole)
 *
 * Class-scoped student list hook.
 * Cache key: `${classId}|${query}`
 *
 * student_fee is only included for staff roles (owner, principal, coordinator, teacher).
 * Student role never receives fee data.
 */

import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 10;

const ROLES_WITH_FEE_ACCESS = ['owner', 'principal', 'coordinator', 'teacher'];

const cache = makeListCache(
  'student',
  (scope, q) => `${scope}|${q}`,
);

export function invalidateStudentCache(classId) {
  const prefix = `${classId}|`;
  Object.keys(cache.store).forEach((k) => {
    if (k.startsWith(prefix)) delete cache.store[k];
  });
}

export function invalidateAllStudentCache() {
  cache.invalidateAll();
}

export function useStudentList(classId, viewerRole) {
  const showFee = ROLES_WITH_FEE_ACCESS.includes(viewerRole);
  const selectFields = showFee
    ? 'id, name, email, avatar_url, is_active, branch_id, school_id, class_id, student_fee, created_at'
    : 'id, name, email, avatar_url, is_active, branch_id, school_id, class_id, created_at';

  return useBaseList({
    cache,
    scope: classId ?? '',
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('profiles')
        .select(selectFields)
        .eq('role', 'student')
        .eq('class_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) {
        q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      }
      return q;
    },
  });
}
