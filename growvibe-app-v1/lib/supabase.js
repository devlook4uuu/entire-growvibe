import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ─── SecureStore adapter for Supabase ────────────────────────────────────────
// Replaces the default AsyncStorage (which has known issues in Expo).
// expo-secure-store uses iOS Keychain / Android Keystore — encrypted at rest.
//
// Supabase stores multiple keys (access token, refresh token, etc.).
// Each key is stored as a separate SecureStore entry.

const SecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

// ─── Supabase client ──────────────────────────────────────────────────────────
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage:            SecureStoreAdapter,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false, // must be false for React Native
    },
  }
);
