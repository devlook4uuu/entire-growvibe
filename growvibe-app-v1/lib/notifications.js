import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Notification behaviour while app is foregrounded ────────────────────────
// Suppress the OS banner when the app is active — InAppNotification handles it.
// The notification is still delivered to addNotificationReceivedListener.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList:   false,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
});

// ─── registerForPushNotificationsAsync ───────────────────────────────────────
// Call after a successful login. Android only.
// - Sets up the notification channel (must come before getExpoPushTokenAsync)
// - Requests permission
// - Gets the Expo push token
// - Saves it to push_tokens (upsert-style: delete-old → insert-new)
// Errors are swallowed — a missing token should never block login.

export async function registerForPushNotificationsAsync(userId) {
  if (Platform.OS !== 'android') return;
  if (!Device.isDevice) return; // emulators cannot receive push notifications

  try {
    // 1. Create / update notification channel (required before token fetch)
    await Notifications.setNotificationChannelAsync('default', {
      name:        'default',
      importance:  Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:  '#1E88E5',
    });

    // 2. Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return; // user denied — nothing to save

    // 3. Get Expo push token (projectId is required in SDK 53+)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[notifications] EAS projectId not found in app config');
      return;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData;

    if (!token) return;

    // 4. Upsert: delete any stale records, then insert fresh
    //    Step A — remove same token (device may have been re-registered)
    await supabase.from('push_tokens').delete().eq('token', token);
    //    Step B — remove same user (user logged in from a different device)
    await supabase.from('push_tokens').delete().eq('user_id', userId);
    //    Step C — insert fresh record
    await supabase.from('push_tokens').insert({ user_id: userId, token });
  } catch (err) {
    // Non-fatal — log but do not throw
    console.warn('[notifications] registerForPushNotificationsAsync error:', err);
  }
}

// ─── sendPush ─────────────────────────────────────────────────────────────────
// Calls the send-push Edge Function to deliver a push notification to a list
// of users. Fire-and-forget — errors are logged but never thrown.
//
//   userIds  — array of profile UUIDs to notify
//   title    — notification title string
//   body     — notification body string
//   data     — optional extra payload (object)

export async function sendPush(userIds, title, body, data = {}) {
  if (!userIds || userIds.length === 0) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userIds, title, body, data }),
      }
    );
  } catch (err) {
    console.warn('[notifications] sendPush error:', err);
  }
}

// ─── deletePushToken ──────────────────────────────────────────────────────────
// Call on logout. Removes the user's token from Supabase so they stop receiving
// notifications after signing out.

export async function deletePushToken(userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
    if (error) console.error('[notifications] deletePushToken failed:', error.message);
  } catch (err) {
    console.error('[notifications] deletePushToken unexpected error:', err);
  }
}
