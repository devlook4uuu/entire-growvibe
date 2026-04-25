import { Redirect } from 'expo-router';

// Auth is handled by /(auth)/login — this route is unused.
export default function LoginRedirect() {
  return <Redirect href="/(auth)/login" />;
}
