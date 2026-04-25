import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 20;

// Cache keyed by "branchId|query"
const cache = makeListCache('session');

export function invalidateSessionCache(branchId) {
  cache.invalidate(branchId);
}

export function useSessionList(branchId) {
  return useBaseList({
    cache,
    scope:    branchId,
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('sessions')
        .select('id, branch_id, school_id, session_name, session_start, session_end, is_active, created_at')
        .eq('branch_id', scope)
        .order('session_start', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('session_name', `%${query.trim()}%`);
      return q;
    },
  });
}
