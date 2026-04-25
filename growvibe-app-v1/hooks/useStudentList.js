/**
 * useStudentList(classId)
 *
 * Class-scoped student list hook.
 * Cache key: `${classId}|${query}`
 */

import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 10;

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

export function useStudentList(classId) {
  return useBaseList({
    cache,
    scope: classId ?? '',
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('profiles')
        .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, student_fee, created_at')
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
