# 24 — App Authentication & Session Updates

## What Was Built (Additions Over Context 02)

Additional auth-related features added to the app after the initial auth build:

1. **`forceLogout` action** — Redux action for forced session termination with an error message (used by active status guard)
2. **`checkActiveStatus` integration** — login and session restore now check isActive status
3. **App `authSlice.js` parity with web** — matched the web authSlice pattern for inactive status handling

---

## Changes to `growvibe-app-v1/store/authSlice.js`

### Imports added
```js
import { checkActiveStatus, INACTIVE_ERRORS } from '../lib/activeStatusCheck';
```

### `loginThunk` change
Replaced inline `is_active` checks with:
```js
const inactiveError = await checkActiveStatus(profile.role);
if (inactiveError) {
  await supabase.auth.signOut();
  return rejectWithValue(inactiveError);
}
```

### `initAuthThunk` change
After profile fetch:
```js
const inactiveError = await checkActiveStatus(profile.role);
if (inactiveError) {
  await supabase.auth.signOut();
  return { forceLogoutError: inactiveError };
}
```
`fulfilled` handler:
```js
if (action.payload?.forceLogoutError) {
  state.session = null;
  state.profile = null;
  state.error = action.payload.forceLogoutError;
  return;
}
```

### `forceLogout` reducer added
```js
forceLogout(state, action) {
  state.session = null;
  state.profile = null;
  state.isInitialized = true;
  state.error = action.payload || INACTIVE_ERRORS.USER;
}
```
Exported from the slice.

---

## Changes to `growvibe-app-v1/app/_layout.jsx`

### Imports added
```js
import { useRef } from 'react';
import { AppState } from 'react-native';
import { forceLogout } from '../../store/authSlice';
import { supabase } from '../../lib/supabase';
import { checkActiveStatus } from '../../lib/activeStatusCheck';
import InAppNotification from '../../components/InAppNotification';
```

### `ActiveStatusGuard` component added
Renders null; runs the periodic active-status check via `setInterval` + `AppState` listener.
See context `22-active-status-guard-feature.md` for full details.

### `RootLayoutInner` updated
```jsx
<ActiveStatusGuard />
<InAppNotification />
```
Both rendered before the `<Stack>` navigator.

---

## Error Message Display

`forceLogout` sets `state.error` on the auth slice. The login screen reads `auth.error` from Redux and displays it as a red error banner. Users see exactly why they were logged out:
- "Your account has been deactivated. Contact your school."
- "Your school has been deactivated. Contact admin."
- "Your branch has been deactivated. Contact your school."

---

## Key Decisions

- See context `22-active-status-guard-feature.md` for the full guard architecture.
- `forceLogout` is the single action used for all forced session terminations — keeps logout logic consistent whether triggered by login check, periodic check, or AppState check.

---

## Gotchas

- `INACTIVE_ERRORS` was previously duplicated in `AUTH_ERRORS` — removed from `AUTH_ERRORS` to avoid drift between the two.
- If `initAuthThunk` returns `{ forceLogoutError }`, the `fulfilled` handler must exit early before setting session state. Otherwise the user appears logged in for a frame before the error is set.
