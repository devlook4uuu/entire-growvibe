# 14 — Expo Push Notifications (Android)

## What was built

Android-only Expo push notification infrastructure:
- Supabase `push_tokens` table to store one token per user
- `lib/notifications.js` with `registerForPushNotificationsAsync` and `deletePushToken`
- `send-push` Supabase Edge Function to fan-out notifications to a list of userIds
- Auth integration: token registered on login, deleted on logout

## Files changed / created

| File | Change |
|---|---|
| `growvibe-app-v1/app.json` | Added `android.package`, `android.googleServicesFile`, `expo-notifications` plugin, `extra.eas.projectId` |
| `growvibe-app-v1/lib/notifications.js` | New — `registerForPushNotificationsAsync`, `deletePushToken` |
| `growvibe-app-v1/store/authSlice.js` | Import notifications; call register in `loginThunk`, delete in `logoutThunk` |
| `growvibe-app-v1/app/(tabs)/profile.jsx` | Pass `profile.id` to `logoutThunk()` so token is deleted before sign-out |
| `supabase/migrations/20260425150000_create_push_tokens.sql` | `push_tokens` table + RLS |
| `supabase/functions/send-push/index.ts` | New Edge Function |

## Key decisions

- **Android only** — `registerForPushNotificationsAsync` returns early if `Platform.OS !== 'android'`. iOS can be added later.
- **Channel before token** — `setNotificationChannelAsync` is called first; Expo requires this order on Android.
- **Non-blocking registration** — `registerForPushNotificationsAsync` is called without `await` inside `loginThunk` so a slow permission dialog never delays the login redirect.
- **Delete before sign-out** — `deletePushToken` is called with `await` *before* `supabase.auth.signOut()` so the user's JWT is still valid for the RLS policy.
- **Upsert via delete→insert** — Instead of a true upsert, old records are explicitly deleted (by token, then by user_id) before inserting the fresh one. This handles device re-registration and multi-device login cleanly without needing a complex ON CONFLICT clause.
- **`projectId` source** — Read from `Constants.expoConfig.extra.eas.projectId` (set in app.json). Required by `expo-notifications` SDK 53+.

## SQL applied

```sql
-- Run in Supabase dashboard SQL editor:
-- supabase/migrations/20260425150000_create_push_tokens.sql
```

## Packages installed

```
expo-notifications  expo-device  expo-constants
```
(via `npx expo install` — SDK-compatible versions selected automatically)

## Manual steps still required

1. **Firebase setup** — Create a Firebase project, add Android app with package `com.abdullah010.growvibe`, download `google-services.json`, place it in `growvibe-app-v1/`.
2. **EAS project ID** — Run `eas init` inside `growvibe-app-v1/` and replace `YOUR_EAS_PROJECT_ID` in `app.json`.
3. **Apply migration** — Paste `20260425150000_create_push_tokens.sql` into Supabase SQL editor.
4. **Deploy Edge Function** — `supabase functions deploy send-push`
5. **Dev build required** — Push notifications do not work in Expo Go on Android (removed in SDK 53). Use `eas build --profile development`.

## Gotchas

- `google-services.json` must be placed at the path referenced in `app.json` (`./google-services.json` relative to project root, i.e., inside `growvibe-app-v1/`).
- The `send-push` Edge Function uses the service role key (set automatically by Supabase) so it can bypass RLS and read any user's token.
- `DeviceNotRegistered` errors from Expo's push API automatically clean up stale tokens in `send-push`.
