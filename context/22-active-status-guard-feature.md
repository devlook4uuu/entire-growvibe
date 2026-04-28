# 22 — Active Status Guard (isActive Middleware)

## What Was Built

A periodic active-status check on both web and app. After login and every 5 minutes (plus AppState foreground on app), the system checks if the user's account, school, or branch is still active. If any are inactive, the user is force-logged out with a specific error message.

---

## Checks Performed

| Check | Condition | Error message |
|-------|-----------|---------------|
| User account | `profiles.is_active = false` | "Your account has been deactivated. Contact your school." |
| School | `schools.is_active = false` | "Your school has been deactivated. Contact admin." |
| Branch | `branches.is_active = false` | "Your branch has been deactivated. Contact your school." |

- Admin role: skips school and branch checks (admin has no school/branch)
- Network errors: returns `null` — never false-logout on connectivity issues. Only confirmed inactive status causes logout.

---

## Files Created

### `growvibe-web-v1/src/lib/activeStatusCheck.js`
```js
export const INACTIVE_ERRORS = {
  USER:   'Your account has been deactivated. Contact your school.',
  SCHOOL: 'Your school has been deactivated. Contact admin.',
  BRANCH: 'Your branch has been deactivated. Contact your school.',
};
export async function checkActiveStatus(role) { ... }
```
- Tries RPC first (`check_active_status`), falls back to direct queries
- Returns `null` on any network/unexpected error

### `growvibe-app-v1/lib/activeStatusCheck.js`
- Same `INACTIVE_ERRORS` constants
- Direct queries only (no RPC attempt — simpler on mobile)
- Returns `null` on catch

---

## Web Integration — `App.jsx`

```js
useEffect(() => {
  if (!profile) { clearInterval(intervalRef.current); return; }
  async function runCheck() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // already logged out
    const error = await checkActiveStatus(profile.role);
    if (error) { await supabase.auth.signOut(); dispatch(forceLogout(error)); }
  }
  runCheck(); // immediate check on login
  intervalRef.current = setInterval(runCheck, 5 * 60 * 1000);
  return () => clearInterval(intervalRef.current);
}, [profile?.id, dispatch]);
```

- `intervalRef` prevents timer leak on logout
- Keyed on `profile?.id` — re-runs when user changes

---

## App Integration — `_layout.jsx`

`ActiveStatusGuard` component (renders null, side-effects only):
```js
function ActiveStatusGuard() {
  const profile  = useSelector((s) => s.auth.profile);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!profile?.id) return;
    async function runCheck() {
      const error = await checkActiveStatus(profile.role);
      if (error) { await supabase.auth.signOut(); dispatch(forceLogout(error)); }
    }
    runCheck();
    const interval = setInterval(runCheck, 5 * 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runCheck();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [profile?.id]);

  return null;
}
```

- `AppState.addEventListener('change')` re-runs check when app comes to foreground
- `<ActiveStatusGuard />` rendered in `RootLayoutInner` alongside `<InAppNotification />`

---

## Redux Changes — `authSlice.js` (both web and app)

### `forceLogout` reducer
```js
forceLogout(state, action) {
  state.session = null;
  state.profile = null;
  state.isInitialized = true;
  state.error = action.payload || INACTIVE_ERRORS.USER;
}
```
Exported and dispatched by both `App.jsx` (web) and `ActiveStatusGuard` (app).

### `loginThunk` change
Inline isActive checks replaced with:
```js
const inactiveError = await checkActiveStatus(profile.role);
if (inactiveError) { await supabase.auth.signOut(); return rejectWithValue(inactiveError); }
```

### `initAuthThunk` change
On session restore:
```js
const inactiveError = await checkActiveStatus(profile.role);
if (inactiveError) { await supabase.auth.signOut(); return { forceLogoutError: inactiveError }; }
```
`fulfilled` handler checks for `forceLogoutError` in payload and clears session.

---

## Key Decisions

1. **Never false-logout on network errors** — `checkActiveStatus` returns `null` on any catch. Intermittent connectivity should never kick users out.
2. **5-minute interval** — balance between responsiveness and battery/bandwidth. Deactivation takes effect within 5 minutes max.
3. **AppState listener on app** — catches the case where a user's account is deactivated while the app is in background. On next foreground, they are logged out.
4. **`forceLogout` in Redux** — sets `state.error` so the login screen shows the specific reason. No generic "session expired" message.
5. **Session check before running** — web `runCheck` checks `supabase.auth.getSession()` first; if session is already null, skip (user already logged out).

---

## Gotchas

- `INACTIVE_ERRORS` removed from `AUTH_ERRORS` in authSlice to avoid duplication — now lives exclusively in `activeStatusCheck.js`.
- Web uses `intervalRef.current` to avoid creating multiple intervals if `App.jsx` re-renders while `profile` is truthy.
- App `ActiveStatusGuard` keyed on `profile?.id` — if profile ID changes (unlikely but possible), old interval is cleaned up and new one starts.
