/**
 * useBannerList.js — Admin banner management list
 *
 * - Admin only: fetches ALL banners (not filtered by is_active or schedule)
 * - Ordered by sort_order asc, created_at desc
 */

import { makeListCache, useBaseList } from './useBaseList';

const PAGE_SIZE = 10;

const cache = makeListCache('banner');

export function invalidateBannerListCache() {
  cache.invalidateAll();
}

export function useBannerList() {
  return useBaseList({
    cache,
    scope:    '',
    pageSize: PAGE_SIZE,
    buildQuery: (supabase, _scope, query, from, to) => {
      let q = supabase
        .from('banners')
        .select('id, banner_type, title, body_text, cta_label, cta_type, bg_image_path, overlay_color, overlay_opacity, text_color, is_active, start_date, end_date, sort_order, school_id, branch_id, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('title', `%${query.trim()}%`);
      return q;
    },
  });
}
