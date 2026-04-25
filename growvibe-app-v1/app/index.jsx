import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import WhiteFadeGradient from '../assets/images/WhiteFadeGradient';
import Button from '../components/Button';
import { hp, wp } from '../helpers/dimension';
import { Fonts } from '../constant/fonts';
import { Colors } from '../constant/colors';

// Onboarding / get-started screen.
// Shown only when the user is NOT logged in.
// Logged-in users are redirected to /(tabs)/home by AuthGuard before this renders.
export default function Index() {
  const router = useRouter();

  return (
    <View style={S.container}>
      <StatusBar style="light" />

      <Text style={[S.headerText, { fontSize: wp(22), marginTop: hp(9) }]}>
        Devlook
      </Text>

      <View style={S.mainContent}>
        <View style={S.imageContainer}>
          <Image
            source={require('../assets/images/get-started-model.png')}
            contentFit="contain"
            style={{ height: hp(70), width: wp(100) }}
            cachePolicy="disk"
          />
        </View>

        <View style={[S.gradientContainer, { height: hp(65) }]}>
          <WhiteFadeGradient />
          <View style={S.textContainer}>
            <Text style={S.title}>GrowVibe.</Text>
            <Text style={[S.subtitle, { fontSize: hp(1.8) }]}>
              One app to manage your entire school journey smarter, safer, and
              more connected than ever before.
            </Text>
            <View style={{ width: wp(85), marginTop: hp(1.6), marginBottom: hp(6) }}>
              <Button
                title="Step Into Smarter Learning"
                onPress={() => router.push('/(auth)/login')}
                size="medium"
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  headerText: {
    color: '#FFFFFF',
    opacity: 0.35,
    fontFamily: Fonts.semiBold,
    width: '100%',
    textAlign: 'center',
    letterSpacing: -1.5,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 200,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  gradientContainer: {
    width: '100%',
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontFamily: Fonts.semiBold,
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: '#4B5563',
    width: '85%',
    fontFamily: Fonts.regular,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
});
