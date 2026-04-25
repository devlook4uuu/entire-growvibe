# GrowVibe — Claude Code Rules

## school_id Column Rule
Every table that is scoped to a school (directly or via a parent FK) **MUST include a `school_id uuid not null references public.schools(id) on delete cascade` column**, even if the data is already reachable through a parent FK chain.

Reasons:
- Enables direct school-scoped RLS policies without multi-hop joins (faster, simpler)
- Enables direct `eq('school_id', ...)` queries without joins
- Consistent pattern across all tables

Examples: `branches` has `school_id`, so `branch_off_days` must also carry `school_id` directly (not just `branch_id`). Future tables like `classes`, `students`, `staff`, `attendance` etc. must all include `school_id`.

Always backfill `school_id` from the parent row when adding to existing tables.

## Supabase Migration Rule
Before creating any Supabase table, trigger, function, Edge Function, or RLS policy in the dashboard,
**ALWAYS create a migration SQL file first** at:

```
supabase/migrations/<timestamp>_<description>.sql
```

- Naming format: `YYYYMMDDHHMMSS_description.sql`
  - Example: `20260411120000_create_profiles.sql`
- Apply the file manually via the Supabase dashboard SQL editor
- Never create DB objects without a corresponding migration file
- Commit the migration file before applying it

## Frontend Rules
- Use pure inline CSS style objects — no Tailwind classes in component JSX
- Hover states via `onMouseEnter` / `onMouseLeave` + `useState` (inline CSS cannot use `:hover`)
- Shared design tokens live in the `C` object exported from `AdminDashboard.jsx`
- Responsive layout via `useBreakpoint()` hook (exported from `AdminDashboard.jsx`)
- No `<table>` elements — use `div`-based grid layouts for tabular data
- No hard deletes anywhere in the app

## List Screen Rules (App)
Every listing screen in the app MUST follow this pattern.
Reference implementation: `hooks/useOwnerList.js` + `app/screens/owner/ownerList.jsx`

### Hook structure (`hooks/use<Entity>List.js`)

**Module-level cache** (outside the hook so it survives unmount/remount):
```js
const cache = {};
// Structure per entry: { items, pages, hasMore, ts }
// Key: query.trim().toLowerCase() || '__all__'
export function invalidate<Entity>Cache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}
```

**State** (all required):
```js
const [items, setItems]             = useState([]);
const [loading, setLoading]         = useState(false); // MUST be false, not true
const [loadingMore, setLoadingMore] = useState(false);
const [refreshing, setRefreshing]   = useState(false);
const [error, setError]             = useState(null);
const [hasMore, setHasMore]         = useState(true);
const [search, setSearchState]      = useState('');
```

**Refs** (all required — never read mutable loop state from React state):
```js
const searchRef     = useRef('');   // current query string
const pageRef       = useRef(0);    // last successfully loaded page
const hasMoreRef    = useRef(true); // mirror of hasMore for use inside callbacks
const isFetching    = useRef(false);
const fetchId       = useRef(0);    // bumped to cancel in-flight results
const debounceTimer = useRef(null);
const hasMounted    = useRef(false);
```

**`fetchPage` modes** — one function, four modes:
- `'initial'` — first mount or focus re-entry; checks cache first, shows skeleton if miss
- `'search'` — new search query; cancels in-flight, shows skeleton
- `'more'` — load next page; blocked if `isFetching` or `!hasMore`
- `'refresh'` — pull-to-refresh; invalidates current query's cache, keeps list visible

**Cache rules:**
- Cache is keyed by search query — `'__all__'` for empty search, `'john'` for "john" etc.
- Each query has its own independent TTL (30s)
- On cache hit: call `applyCached(q)` — restores items/hasMore/pageRef instantly, no loading flash
- On cache miss: fetch and `writeCache` inside the `setItems` updater so data and cache are always in sync
- `updateItem` (optimistic local edit) must also update the cache entry

**In-flight cancellation:**
- Bump `fetchId.current` at the start of any non-`'more'` fetch
- Check `if (myId !== fetchId.current) return` after every `await` — drop stale results silently

**Loading state rules:**
- `setLoading(true)` only for `'initial'` and `'search'` modes
- `setLoadingMore(true)` only for `'more'` mode
- `setRefreshing(true)` set by the `refresh` caller before calling `fetchPage`
- ALL three cleared in `finally` — never in `.then()` or after `await`

**`useFocusEffect` pattern:**
```js
useFocusEffect(useCallback(() => {
  const q = searchRef.current;
  if (!hasMounted.current) {
    isCacheFresh(q) ? (applyCached(q), hasMounted.current = true)
                    : fetchPage({ page: 0, query: q, mode: 'initial' });
  } else {
    isCacheFresh(q) ? applyCached(q)
                    : (pageRef.current = 0, fetchPage({ page: 0, query: q, mode: 'refresh' }));
  }
}, [fetchPage, applyCached]))
```

**Search** — debounce 400ms (0ms for clear), always check cache before fetching:
```js
debounceTimer.current = setTimeout(() => {
  searchRef.current = text;
  pageRef.current   = 0;
  isCacheFresh(text) ? applyCached(text) : fetchPage({ page: 0, query: text, mode: 'search' });
}, text === '' ? 0 : 400);
```

**Return shape:**
```js
return { items, loading, loadingMore, refreshing, error, hasMore, search,
         setSearch, loadMore, refresh, updateItem };
```

### Pagination — "Load More" button (NOT `onEndReached`)
- Never use `onEndReached` — FlatList fires it immediately after page-0 renders, causing double calls
- Render a "Load More" button as `ListFooterComponent` when `hasMore === true`
- Button shows `ActivityIndicator` in-place while `loadingMore === true`
- `loadMore` in the hook guards with `isFetching.current` and `hasMoreRef.current`

### UI states (all required)
- **Loading (first page):** `SkeletonCard` × PAGE_SIZE — never a spinner alone
- **Load more:** "Load More" button at list bottom; spinner replaces label while fetching
- **Empty state:** icon circle + title + subtitle — never just "No data"
- **Search empty:** distinct "No results for '…'" message + Clear button
- **Error state:** icon + message + Retry button that calls `refresh`

### Screen structure
- File: `app/screens/<entity>/<entity>List.jsx`
- Hook: `hooks/use<Entity>List.js`
- No fetch logic in the screen — all data logic lives in the hook
- Search bar at top, outside FlatList (sticky)
- Pull-to-refresh wired via `onRefresh` + `refreshing` props on FlatList
- `PAGE_SIZE` constant defined in the hook — screen never references it directly

## Context Files Rule
After building each feature, create a context file at:

```
context/<NN>-<feature-name>.md
```

Document: what was built, key decisions made, file paths changed, SQL applied, and any gotchas.
