import { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const CACHE_TTL_MS = 30_000;

/**
 * makeListCache(prefix)
 * Returns a module-level cache store + helpers for a specific entity.
 * Call this once at module level in each hook file.
 *
 * @param {string} prefix  e.g. 'owner', 'school', 'branch'
 * @param {(scope: string, q: string) => string} [keyFn]
 *   Override the default key builder. Receives (scope, normalisedQuery).
 *   scope is '' for global lists, schoolId for school-scoped lists.
 */
export function makeListCache(prefix, keyFn) {
  const store = {};
  const key   = keyFn
    ? (scope, q) => keyFn(scope, q.trim().toLowerCase() || '__all__')
    : (scope, q) => {
        const nq = q.trim().toLowerCase() || '__all__';
        return scope ? `${scope}|${nq}` : nq;
      };

  return {
    store,
    key,
    isFresh:    (scope, q) => { const e = store[key(scope, q)]; return !!(e && Date.now() - e.ts < CACHE_TTL_MS); },
    read:       (scope, q) => store[key(scope, q)],
    write:      (scope, q, data) => { store[key(scope, q)] = { ...data, ts: Date.now() }; },
    invalidate: (scope) => {
      Object.keys(store).forEach((k) => {
        if (!scope || k === k && k.startsWith(scope ? `${scope}|` : '')) delete store[k];
      });
    },
    invalidateAll: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

/**
 * useBaseList(config)
 *
 * config: {
 *   cache:       return value of makeListCache()
 *   scope:       string  — '' for global, schoolId for school-scoped
 *   pageSize:    number
 *   buildQuery:  (supabase, scope, query, from, to) => SupabaseQueryBuilder
 * }
 *
 * Returns: { items, loading, loadingMore, refreshing, error, hasMore, search,
 *            setSearch, loadMore, refresh, updateItem }
 */
export function useBaseList({ cache, scope = '', pageSize, buildQuery }) {
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [hasMore, setHasMore]         = useState(true);
  const [search, setSearchState]      = useState('');

  const searchRef     = useRef('');
  const pageRef       = useRef(0);
  const hasMoreRef    = useRef(true);
  const isFetching    = useRef(false);
  const fetchId       = useRef(0);
  const debounceTimer = useRef(null);
  const hasMounted    = useRef(false);
  const [dataReady, setDataReady] = useState(false);

  // ── Apply cached data to state ──────────────────────────────────────────────
  const applyCached = useCallback((q) => {
    const entry = cache.read(scope, q);
    if (!entry) return false;
    setItems(entry.items);
    setHasMore(entry.hasMore);
    hasMoreRef.current = entry.hasMore;
    pageRef.current    = entry.pages - 1;
    setError(null);
    setDataReady(true);
    return true;
  }, [cache, scope]);

  // ── Core fetch ───────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async ({ page, query, mode }) => {
    if (mode === 'initial' && cache.isFresh(scope, query)) {
      applyCached(query);
      hasMounted.current = true;
      return;
    }

    if (mode === 'more' && (isFetching.current || !hasMoreRef.current)) return;

    if (mode !== 'more') fetchId.current += 1;
    const myId = fetchId.current;
    isFetching.current = true;

    if (mode === 'initial' || mode === 'search') {
      setLoading(true);
      setError(null);
    } else if (mode === 'more') {
      setLoadingMore(true);
    }

    const from = page * pageSize;
    const to   = from + pageSize - 1;

    try {
      const q = buildQuery(supabase, scope, query, from, to);
      const { data, error: fetchError } = await q;

      if (myId !== fetchId.current) return;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const rows    = data ?? [];
      const more    = rows.length === pageSize;
      const newPage = page;

      setItems((prev) => {
        const merged = newPage === 0 ? rows : [...prev, ...rows];
        cache.write(scope, query, { items: merged, pages: newPage + 1, hasMore: more });
        return merged;
      });

      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current    = newPage;
      hasMounted.current = true;
      setDataReady(true);

    } catch {
      if (myId === fetchId.current) {
        setError('Connection error. Please try again.');
      }
    } finally {
      if (myId === fetchId.current) {
        isFetching.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [cache, scope, pageSize, buildQuery, applyCached]);

  // ── Focus effect ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (scope === null || scope === undefined || scope === 'null' || scope === 'undefined') return; // wait until scope is ready
      const q = searchRef.current;
      if (!hasMounted.current) {
        if (cache.isFresh(scope, q)) { applyCached(q); hasMounted.current = true; }
        else fetchPage({ page: 0, query: q, mode: 'initial' });
      } else {
        if (cache.isFresh(scope, q)) applyCached(q);
        else { pageRef.current = 0; fetchPage({ page: 0, query: q, mode: 'refresh' }); }
      }
    }, [cache, scope, fetchPage, applyCached])
  );

  // ── Search with debounce ─────────────────────────────────────────────────────
  const setSearch = useCallback((text) => {
    setSearchState(text);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchRef.current = text;
      pageRef.current   = 0;
      if (cache.isFresh(scope, text)) {
        applyCached(text);
        fetchId.current += 1;
        isFetching.current = false;
        setLoading(false);
      } else {
        fetchPage({ page: 0, query: text, mode: 'search' });
      }
    }, text === '' ? 0 : 400);
  }, [cache, scope, fetchPage, applyCached]);

  // ── Load more ────────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isFetching.current) return;
    fetchPage({ page: pageRef.current + 1, query: searchRef.current, mode: 'more' });
  }, [fetchPage]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    const q = searchRef.current;
    cache.invalidate(scope);
    pageRef.current = 0;
    setRefreshing(true);
    fetchPage({ page: 0, query: q, mode: 'refresh' });
  }, [cache, scope, fetchPage]);

  // ── Optimistic local update ──────────────────────────────────────────────────
  const updateItem = useCallback((id, updates) => {
    setItems((prev) => {
      const next  = prev.map((item) => item.id === id ? { ...item, ...updates } : item);
      const q     = searchRef.current;
      const entry = cache.read(scope, q);
      if (entry) cache.write(scope, q, { ...entry, items: next });
      return next;
    });
  }, [cache, scope]);

  return {
    items, loading, loadingMore, refreshing, error,
    hasMore, search, dataReady,
    setSearch, loadMore, refresh, updateItem,
  };
}
