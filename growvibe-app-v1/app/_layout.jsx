import { useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from '../store';
import { initAuthThunk } from '../store/authSlice';
import { Colors } from '../constant/colors';
import '../global.css';

SplashScreen.preventAutoHideAsync();

// ─── In-app loading screen (replaces the black flash) ────────────────────────
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Image
        source={require('../assets/images/splash-icon.png')}
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <ActivityIndicator
        size="small"
        color={Colors.white}
        style={styles.loadingSpinner}
      />
    </View>
  );
}

// ─── AuthGuard ────────────────────────────────────────────────────────────────
function AuthGuard() {
  const router   = useRouter();
  const segments = useSegments();
  const { session } = useSelector((s) => s.auth);

  useEffect(() => {
    const inAuthGroup   = segments[0] === '(auth)';
    const inTabsGroup   = segments[0] === '(tabs)';
    const inScreens     = segments[0] === 'screens';
    const isOnboarding  = segments[0] === undefined || segments[0] === 'index';

    if (session && (isOnboarding || inAuthGroup)) {
      // Logged in but on login/onboarding → send to home
      router.replace('/(tabs)/home');
    } else if (!session && (inTabsGroup || inScreens)) {
      // Logged out but still inside protected area → send to login
      router.replace('/(auth)/login');
    }
  }, [session, segments, router]);

  return null;
}

// ─── RootLayout inner ────────────────────────────────────────────────────────
function RootLayoutInner() {
  const dispatch = useDispatch();
  const { loading: authLoading } = useSelector((s) => s.auth);

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Light':     require('../assets/font/DMSans_18pt-Light.ttf'),
    'DMSans-Regular':   require('../assets/font/DMSans_18pt-Regular.ttf'),
    'DMSans-Medium':    require('../assets/font/DMSans_18pt-Medium.ttf'),
    'DMSans-SemiBold':  require('../assets/font/DMSans_18pt-SemiBold.ttf'),
    'DMSans-Bold':      require('../assets/font/DMSans_24pt-Bold.ttf'),
    'DMSans-ExtraBold': require('../assets/font/DMSans_24pt-ExtraBold.ttf'),
  });

  useEffect(() => {
    dispatch(initAuthThunk());
  }, [dispatch]);

  // Hide the native splash once fonts + auth are both ready
  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  // While fonts or auth are still loading → show branded in-app loading screen
  // instead of a black void. Fonts must be loaded before rendering text anywhere.
  if ((!fontsLoaded && !fontError) || authLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <RootLayoutInner />
    </Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 120,
    height: 120,
  },
  loadingSpinner: {
    marginTop: 32,
  },
});
