/**
 * useClassList(sessionId)
 *
 * Session-scoped class list hook.
 * Queries the `classes_with_teacher` view so teacher name is included.
 * Cache key: `${sessionId}|${query}`
 */

import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 10;

const cache = makeListCache(
  'class',
  (scope, q) => `${scope}|${q}`,
);

export function invalidateClassCache(sessionId) {
  const prefix = `${sessionId}|`;
  Object.keys(cache.store).forEach((k) => {
    if (k.startsWith(prefix)) delete cache.store[k];
  });
}

export function invalidateAllClassCache() {
  cache.invalidateAll();
}

export function useClassList(sessionId) {
  const safeId = sessionId && sessionId !== 'null' && sessionId !== 'undefined' ? sessionId : null;
  return useBaseList({
    cache,
    scope: safeId,
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('classes_with_teacher')
        .select('id, school_id, branch_id, session_id, class_name, teacher_id, teacher_name, teacher_avatar, chat_id, created_at, updated_at')
        .eq('session_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) {
        q = q.ilike('class_name', `%${query.trim()}%`);
      }
      return q;
    },
  });
}
