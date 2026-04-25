import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 20;

// Cache keyed by "schoolId|query"
const cache = makeListCache('payment');

export function invalidatePaymentCache(schoolId) {
  cache.invalidate(schoolId);
}

export function usePaymentList(schoolId) {
  return useBaseList({
    cache,
    scope:    schoolId,
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('subscription_payments')
        .select(
          'id, school_id, payment_month, fee, amount_paid, remaining_due, ' +
          'payment_method, payment_status, payment_description, created_at, updated_at'
        )
        .eq('school_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('payment_month', `%${query.trim()}%`);
      return q;
    },
  });
}
