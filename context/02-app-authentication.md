# Context: App (Expo) Authentication

## What Was Built
Auth system for the Expo mobile app — mirrors the web auth architecture. Uses `expo-secure-store` instead of AsyncStorage for session persistence, Redux for state management, and Expo Router's `useSegments`-based `AuthGuard` for protected routes.

## Why expo-secure-store (not AsyncStorage)
AsyncStorage has known issues in newer Expo versions (data loss on app update, not encrypted). `expo-secure-store` stores data in iOS Keychain / Android Keystore — encrypted at rest, reliable, and the Supabase-recommended approach for React Native.

## Feature Scope
- Same backend as web (same Supabase project, same profiles/schools/branches tables)
- Same isActive checks (user → school → branch)
- Same error messages as web
- Session persisted across app restarts via SecureStore
- AuthGuard redirects: no session → `/(auth)/login`, logged in → `/(tabs)/home`

## Files Created / Modified

### New Files
| File | Purpose |
|---|---|
| `growvibe-app-v1/.env` | EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY |
| `growvibe-app-v1/lib/supabase.js` | Supabase client with SecureStoreAdapter |
| `growvibe-app-v1/store/index.js` | Redux store |
| `growvibe-app-v1/store/authSlice.js` | Auth state + loginThunk, logoutThunk, initAuthThunk |
| `growvibe-app-v1/app/(auth)/_layout.jsx` | Auth route group layout (headerShown: false) |
| `growvibe-app-v1/app/(auth)/login.jsx` | Login screen (React Native, styled with StyleSheet) |

### Modified Files
| File | Change |
|---|---|
| `growvibe-app-v1/app/_layout.jsx` | Wrapped with Redux Provider, added AuthGuard component |
| `growvibe-app-v1/app/index.jsx` | Simplified to `<Redirect href="/(tabs)/home" />` — AuthGuard handles routing |
| `growvibe-app-v1/constant/colors.js` | Expanded to full token set (matches web's colors.js) |

## Architecture

### Auth Flow
```
App launches
  → _layout.jsx renders Provider + AuthGuard + Stack
  → AuthGuard dispatches initAuthThunk()
    → reads session from SecureStore via supabase.auth.getSession()
    → if session: fetch profile → dispatch to Redux
  → AuthGuard useEffect watches (session, loading, segments)
    → loading=true: do nothing (splash still showing)
    → no session + not in (auth): redirect → /(auth)/login
    → session + in (auth): redirect → /(tabs)/home
```

### SecureStore Adapter
```js
const SecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
// Passed to createClient({ auth: { storage: SecureStoreAdapter } })
```

### Packages Installed
- `@supabase/supabase-js` — Supabase JS client
- `expo-secure-store` — Encrypted key-value storage
- `@reduxjs/toolkit` — Redux store
- `react-redux` — React bindings for Redux

## Key Decisions
- **No Formik on mobile** — Manual validation in login screen (simpler for RN, no library needed)
- **AuthGuard as a component** (not hook) — Rendered inside Provider so it can access Redux; renders null (no UI)
- **`RootLayoutInner` wrapper** — Needed because `useFonts` must be called inside Provider; fonts + auth guard co-located
- **`detectSessionInUrl: false`** — Must be false for React Native (no URL-based OAuth)
- **Env prefix `EXPO_PUBLIC_`** — Expo requires this prefix for env vars to be accessible in client code

## Pending / To Do Later
- [ ] **Logout button** — No logout UI in the app yet. `logoutThunk` exists in authSlice but nothing calls it. Add to profile tab or drawer.
- [ ] **Loading screen** — While `auth.loading = true`, the app renders nothing (AuthGuard hasn't redirected yet). Should show a proper branded loading/splash screen.
- [ ] **Role-based tab visibility** — All users see the same 4 tabs (Home, Chat, Support, Profile). Tabs should be filtered by role (e.g. student sees Store, teacher sees GrowTasks).
- [ ] **Device token registration** — On login, the user's expo push token should be saved to `profiles.device_tokens`. Not implemented yet.
- [ ] **Session expiry handling** — If token expires mid-session, `supabase.auth.autoRefreshToken: true` handles silent refresh. But if refresh fails, the user should be redirected to login. Not yet wired up.
