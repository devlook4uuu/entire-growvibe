import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 7;

// Module-level cache (survives unmount/remount)
const cache = makeListCache('owner');

export function invalidateOwnerCache() {
  cache.invalidateAll();
}

export function useOwnerList() {
  return useBaseList({
    cache,
    scope:    '',
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, _scope, query, from, to) => {
      let q = supabase
        .from('owners_with_school')
        .select('id, name, email, avatar_url, is_active, created_at, school_id, school_name')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      return q;
    },
  });
}
