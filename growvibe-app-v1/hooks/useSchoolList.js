import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 20;

const cache = makeListCache('school');

export function invalidateSchoolCache() {
  cache.invalidateAll();
}

export function useSchoolList() {
  return useBaseList({
    cache,
    scope:    '',
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, _scope, query, from, to) => {
      let q = supabase
        .from('schools_with_details')
        .select(
          'id, name, logo_url, school_address, school_contact, is_active, owner_id, created_at, ' +
          'owner_name, owner_email, owner_avatar_url, total_subscription_fee, active_branch_count'
        )
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,owner_name.ilike.%${query.trim()}%`);
      return q;
    },
  });
}
