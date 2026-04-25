# 11 — Banners Feature

## What was built
A fully customizable promotional banner system. Admin creates banners via a management page; banners appear as an auto-scrolling carousel on every user's dashboard (web) and home screen (app).

## Key decisions
- **3 banner types**: `image_only`, `image_text`, `image_text_cta` — selected via radio buttons; irrelevant fields are hidden and nulled on save
- **CTA types**: `url` (opens external/deep link) or `info` (shows a rich-text info sheet on tap/click)
- **Targeting**: global (school_id null) → school-wide (school_id set, branch_id null) → branch-specific (both set). RLS enforces this — users only receive banners in their scope.
- **Scheduling**: `start_date` + optional `end_date` — RLS filters these server-side
- **Recommended image resolution**: 1200 × 480 px (2.5:1 ratio), WebP/JPEG, max 5 MB — stored in Supabase Storage bucket `banners` (public read)
- **Cache TTL**: 60 s (module-level, keyed by profile.id). App uses `expo-image` with `cachePolicy="disk"` for image-level caching.
- **No hard delete on banner image**: delete flow removes the storage file first, then the DB row

## Files changed / created

### Supabase
- `supabase/migrations/20260424200000_create_banners.sql` — table, storage bucket, RLS policies, indexes

### Web (`growvibe-web-v1`)
- `src/pages/management/BannerPage.jsx` — admin CRUD: card grid, image upload zone (drag-drop + click), overlay colour/opacity slider, text colour picker, type selector, CTA config, schedule dates, sort order, active toggle, scope selector (global/school/branch), delete with storage cleanup
- `src/components/shared/BannerCarousel.jsx` — carousel used on all dashboards: 60 s cache, auto-advance 5 s, hover-pause, prev/next arrows, dot indicators, inline info sheet, `window.open` for URL CTAs
- `src/assets/icons/Banner.jsx` — new SVG icon
- `src/data/sidebarConfig.js` — added `Banners` entry to admin nav
- `src/App.jsx` — added `/banners` route + `BannerPage` import
- `src/pages/dashboard/AdminDashboard.jsx` — `<BannerCarousel />` after `<PageHeader />`
- `src/pages/dashboard/OwnerDashboard.jsx` — same
- `src/pages/dashboard/PrincipalDashboard.jsx` — same
- `src/pages/dashboard/CoordinatorDashboard.jsx` — same
- `src/pages/dashboard/TeacherDashboard.jsx` — same
- `src/pages/dashboard/StudentDashboard.jsx` — same

### App (`growvibe-app-v1`)
- `hooks/useBanners.js` — `useBanners(profileId)` hook: `useFocusEffect` for fetch, 60 s module-level cache, `getBannerImageUrl(path)` helper exported for component use
- `components/BannerCarousel.jsx` — RN carousel: FlatList with `snapToInterval`, auto-advance timer, dot indicators (active dot wider), `expo-image` with `cachePolicy="disk"`, `Linking.openURL` for URL CTAs, bottom-sheet Modal for info CTAs
- `app/(tabs)/home.jsx` — imported `useBanners` + `BannerCarousel`, renders carousel after greeting when `banners.length > 0`

## SQL applied
`20260424200000_create_banners.sql` — apply via Supabase dashboard SQL editor

## Gotchas
- Storage RLS: Supabase storage policies are on `storage.objects`, not `public.*` — the bucket must be created before policies are added
- RLS read policy uses a subquery `(select school_id from public.profiles where id = auth.uid())` — this runs per-row but is indexed on `profiles.id`
- `overlay_opacity` is `numeric(4,3)` — Supabase returns it as a string in JS; parse with `parseFloat` before comparison/display
- BannerCarousel renders `null` when `banners.length === 0` — no skeleton needed, just nothing
- Web carousel uses `backgroundImage` CSS + absolute-positioned overlay div — works without any extra library
