import { Stack } from 'expo-router';

// Auth group layout — no header, plain stack
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
