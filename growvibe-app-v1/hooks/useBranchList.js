import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 20;

// Cache keyed by "schoolId|query"
const cache = makeListCache('branch');

export function invalidateBranchCache(schoolId) {
  cache.invalidate(schoolId);
}

export function useBranchList(schoolId) {
  return useBaseList({
    cache,
    scope:    schoolId,
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('branches_with_off_days')
        .select(
          'id, school_id, name, branch_address, branch_contact, branch_subscription_fee, ' +
          'is_active, created_at, off_days'
        )
        .eq('school_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      return q;
    },
  });
}
