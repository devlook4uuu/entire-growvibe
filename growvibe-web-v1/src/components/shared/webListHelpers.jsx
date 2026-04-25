/**
 * webListHelpers.jsx
 * Shared utilities for all web management list pages.
 *
 * Exports:
 *   makePageCache(ttl)     — module-level cache factory
 *   usePageList(config)    — data-fetching hook for list pages
 *   SlideOver              — right-drawer panel
 *   Field                  — form field wrapper with label + error
 *   TextInput              — focus-ring text input
 *   Toggle                 — active/inactive toggle switch
 *   SaveBtn                — primary save button with hover + loading states
 *   CancelBtn              — secondary cancel button
 *   FormError              — red error banner inside a form
 *   StatusPill             — active/inactive pill (boolean)
 *   SearchBar              — search input with icon
 *   CardGrid               — responsive grid wrapper
 *   SkeletonGrid           — grid of skeleton placeholder cards
 *   EmptyBlock             — empty-state message
 *   ErrorBlock             — error message + retry button
 *   LoadMoreBtn            — "Load More" / "Loading…" button
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, useBreakpoint } from '../../pages/dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import Search from '../../assets/icons/Search';

// ─── Cache factory ────────────────────────────────────────────────────────────
/**
 * makePageCache(ttl?)
 * Call once at module level in each page file.
 * Returns { isFresh, read, write, invalidate, invalidateAll }
 *
 * cacheKeyFn(scope, query) — optional override.
 * Default key: scope ? `${scope}|${normQ}` : normQ
 */
export function makePageCache(ttl = 30_000, cacheKeyFn) {
  const store = {};
  const key = cacheKeyFn
    ? cacheKeyFn
    : (scope, q) => {
        const nq = (q || '').trim().toLowerCase() || '__all__';
        return scope ? `${scope}|${nq}` : nq;
      };

  return {
    isFresh:     (scope, q) => { const e = store[key(scope, q)]; return !!(e && Date.now() - e.ts < ttl); },
    read:        (scope, q) => store[key(scope, q)],
    write:       (scope, q, payload) => { store[key(scope, q)] = { ...payload, ts: Date.now() }; },
    invalidate:  (scope) => { Object.keys(store).filter((k) => !scope || k.startsWith(`${scope}|`) || k === key(scope, '')).forEach((k) => delete store[k]); },
    invalidateAll: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

// ─── usePageList hook ─────────────────────────────────────────────────────────
/**
 * config: {
 *   cache:       makePageCache() result
 *   scope:       string  — '' for global, schoolId for school-scoped
 *   pageSize:    number
 *   buildQuery:  (supabase, scope, query, from, to) => SupabaseQueryBuilder
 * }
 */
export function usePageList({ cache, scope = '', pageSize, buildQuery }) {
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearchState] = useState('');

  const debounceRef    = useRef(null);
  const searchRef      = useRef('');
  const pageRef        = useRef(0);
  const hasMoreRef     = useRef(true);
  const isFetching     = useRef(false);
  const fetchId        = useRef(0);
  // Always-fresh ref so fetchItems never captures a stale buildQuery.
  // Assigned synchronously (not in an effect) so it's always current before fetchItems runs.
  const buildQueryRef  = useRef(buildQuery);
  buildQueryRef.current = buildQuery;

  const applyCached = useCallback((q) => {
    const entry = cache.read(scope, q);
    if (!entry) return false;
    setItems(entry.items);
    setHasMore(entry.hasMore);
    hasMoreRef.current = entry.hasMore;
    pageRef.current    = entry.pages - 1;
    setError('');
    return true;
  }, [cache, scope]);

  // fetchItems reads buildQuery from ref — no stale closure, no extra deps
  const fetchItems = useCallback(async ({ page, query, mode }) => {
    if (mode === 'more' && (isFetching.current || !hasMoreRef.current)) return;
    isFetching.current = true;
    const myId = mode !== 'more' ? ++fetchId.current : fetchId.current;

    if (mode === 'initial' || mode === 'search') { setLoading(true); setError(''); }
    else if (mode === 'more') setLoadingMore(true);

    try {
      const from = page * pageSize;
      const to   = from + pageSize - 1;
      const q    = buildQueryRef.current(supabase, scope, query, from, to);
      const { data, error: err } = await q;

      if (myId !== fetchId.current) return;
      if (err) { setError(err.message); return; }

      const rows = data ?? [];
      const more = rows.length === pageSize;
      hasMoreRef.current = more;
      setHasMore(more);
      pageRef.current = page;
      setItems((prev) => {
        const merged = page === 0 ? rows : [...prev, ...rows];
        cache.write(scope, query, { items: merged, pages: page + 1, hasMore: more });
        return merged;
      });
    } finally {
      if (myId === fetchId.current || mode === 'more') {
        setLoading(false); setLoadingMore(false); isFetching.current = false;
      }
    }
  }, [cache, scope, pageSize]); // buildQuery removed — read from ref instead

  // Initial load (scope change)
  useEffect(() => {
    if (cache.isFresh(scope, '')) applyCached('');
    else fetchItems({ page: 0, query: '', mode: 'initial' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function setSearch(val) {
    setSearchState(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchRef.current = val;
      pageRef.current   = 0;
      if (cache.isFresh(scope, val)) applyCached(val);
      else { fetchId.current++; fetchItems({ page: 0, query: val, mode: 'search' }); }
    }, val === '' ? 0 : 400);
  }

  function loadMore() {
    if (!hasMore || loadingMore) return;
    fetchItems({ page: pageRef.current + 1, query: searchRef.current, mode: 'more' });
  }

  function reload() {
    cache.invalidate(scope);
    fetchItems({ page: 0, query: searchRef.current, mode: 'search' });
  }

  return {
    items, loading, loadingMore, hasMore, error, search,
    searchRef, pageRef,
    setSearch, loadMore, reload, fetchItems,
  };
}

// ─── SlideOver ────────────────────────────────────────────────────────────────
export function SlideOver({ open, onClose, title, width = 440, children }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  // On mobile: full-height sheet from bottom; on desktop: right drawer
  const panelStyle = isMobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '92dvh', maxHeight: '92dvh',
        borderRadius: '20px 20px 0 0',
        backgroundColor: C.white, zIndex: 50,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }
    : {
        position: 'fixed', top: 0, right: 0, height: '100%',
        width, maxWidth: '100vw',
        backgroundColor: C.white, zIndex: 50,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s' }}
      />
      <div style={panelStyle}>
        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: C.border }} />
          </div>
        )}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '24px' }}>{children}</div>
      </div>
    </>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────────
export function Field({ label, optional, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.soft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: C.muted, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 13, color: C.ink, backgroundColor: disabled ? C.canvas : C.white, outline: 'none', boxSizing: 'border-box', padding: '0 12px', border: `1.5px solid ${focused ? C.blue : C.border}`, transition: 'border-color 0.15s' }}
    />
  );
}

export function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0, backgroundColor: value ? C.green : C.muted, transition: 'background-color 0.2s', position: 'relative' }}
      >
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      {label && <span style={{ fontSize: 13, color: C.soft }}>{label}</span>}
    </div>
  );
}

export function SaveBtn({ label, loading, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ height: 40, paddingInline: 24, borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', backgroundColor: loading ? C.muted : hov ? '#2563EB' : C.blue, color: '#fff', fontSize: 13, fontWeight: 600, transition: 'background-color 0.15s' }}
    >{loading ? 'Saving…' : label}</button>
  );
}

export function CancelBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ height: 40, paddingInline: 20, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.soft, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
    >Cancel</button>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div style={{ backgroundColor: C.redBg, border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C', marginBottom: 16 }}>
      {message}
    </div>
  );
}

// ─── Status Pill (active / inactive boolean) ──────────────────────────────────
export function StatusPill({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, backgroundColor: active ? C.greenBg : C.canvas, color: active ? C.green : C.muted, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: active ? C.green : C.muted }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: 'relative', maxWidth: 320 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          <Search size={15} color={C.muted} />
        </span>
        <input
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', height: 36, borderRadius: 8, fontSize: 13, color: C.ink, border: `1px solid ${C.border}`, outline: 'none', paddingLeft: 32, paddingRight: 12, backgroundColor: C.canvas, boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}

// ─── Card grid ────────────────────────────────────────────────────────────────
export function CardGrid({ children, skeletonCount = 6, SkeletonCard }) {
  const bp   = useBreakpoint();
  const cols = bp === '2xl' ? 6 : bp === 'xl' ? 4 : bp === 'lg' ? 3 : bp === 'sm' ? 2 : 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
      {SkeletonCard
        ? Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)
        : children}
    </div>
  );
}

// ─── Empty / Error / Load-more ────────────────────────────────────────────────
export function EmptyBlock({ search, emptyText = 'Nothing here yet.' }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted, fontSize: 13 }}>
      {search ? `No results for "${search}"` : emptyText}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: C.red, fontSize: 13 }}>
      {message}{' '}
      <button onClick={onRetry} style={{ color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Retry</button>
    </div>
  );
}

export function LoadMoreBtn({ loadingMore, onClick }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <button
        onClick={onClick} disabled={loadingMore}
        style={{ height: 36, paddingInline: 28, borderRadius: 8, border: `1.5px solid ${C.blue}`, backgroundColor: C.white, color: C.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >{loadingMore ? 'Loading…' : 'Load More'}</button>
    </div>
  );
}
