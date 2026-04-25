import { Image } from 'expo-image';
import { Formik } from 'formik';
import * as Yup from 'yup';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginThunk, clearError } from '../../store/authSlice';
import { ScreenWrapper } from '../../helpers/screenWrapper';
import { hp, wp } from '../../helpers/dimension';
import { Colors } from '../../constant/colors';
import { Fonts } from '../../constant/fonts';
import Button from '../../components/Button';
import Input from '../../components/Input';

// ─── Validation schema ────────────────────────────────────────────────────────
const LoginSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters.')
    .required('Password is required.'),
});

// ─── LoginScreen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const dispatch = useDispatch();
  const { error } = useSelector((s) => s.auth);

  async function handleLogin(values, { setSubmitting }) {
    dispatch(clearError());
    try {
      await dispatch(loginThunk({ email: values.email.trim(), password: values.password })).unwrap();
      // AuthGuard in _layout.jsx handles redirect to /(tabs)/home
    } catch {
      // error already stored in Redux state, shown in ErrorBanner below
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenWrapper style="dark" bg="#dbeafe">
      <KeyboardAvoidingView
        style={S.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={S.container}>
            <View style={[S.imageWrapper, { marginTop: hp(6) }]}>

              {/* Hero image */}
              <Image
                source={require('../../assets/images/login-model.png')}
                contentFit="contain"
                style={{ height: hp(30), width: wp(100), zIndex: 1 }}
                cachePolicy="disk"
              />

              {/* Login card */}
              <View style={[S.card, { top: hp(28.2), minHeight: hp(40) }]}>

                <Text style={[S.cardTitle, { fontSize: hp(3.2) }]}>Login</Text>

                {/* Server error banner */}
                {!!error && (
                  <View style={S.errorBanner}>
                    <Text style={S.errorBannerText}>{error}</Text>
                  </View>
                )}

                {/* Form */}
                <View style={S.formBox}>
                  <Formik
                    initialValues={{ email: '', password: '' }}
                    validationSchema={LoginSchema}
                    onSubmit={handleLogin}
                  >
                    {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting }) => (
                      <>
                        <View style={{ gap: hp(1.2) }}>
                          <Input
                            type="email"
                            placeholder="Email"
                            value={values.email}
                            onChangeText={handleChange('email')}
                            onBlur={handleBlur('email')}
                            error={touched.email && errors.email}
                          />

                          <Input
                            type="password"
                            placeholder="Password"
                            value={values.password}
                            onChangeText={handleChange('password')}
                            onBlur={handleBlur('password')}
                            error={touched.password && errors.password}
                          />
                        </View>

                        <View style={{ marginTop: hp(2) }}>
                          <Button
                            title="Login"
                            bgColor={Colors.primary}
                            textColor={Colors.white}
                            onPress={handleSubmit}
                            loading={isSubmitting}
                            size="small"
                          />
                        </View>

                        <Text style={[S.helperText, { fontSize: hp(1.6), marginTop: hp(1.8) }]}>
                          Provided by your institute
                        </Text>
                      </>
                    )}
                  </Formik>
                </View>

                {/* Footer */}
                <Text style={[S.footerText, { fontSize: hp(2), marginTop: hp(1.5) }]}>
                  - GrowVibe By <Text style={S.footerHighlight}>Devlook</Text> -
                </Text>

              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#dbeafe',
  },
  scroll: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  imageWrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: Colors.primary,
    width: '85%',
    padding: 16,
    borderRadius: 24,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -wp(42.5) }],
    alignSelf: 'center',
  },
  cardTitle: {
    textAlign: 'center',
    color: Colors.white,
    fontFamily: Fonts.semiBold,
    letterSpacing: -1.2,
  },
  errorBanner: {
    marginTop: hp(1.5),
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorBannerText: {
    color: Colors.white,
    fontSize: hp(1.5),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  formBox: {
    width: '100%',
    marginTop: hp(2),
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  helperText: {
    textAlign: 'center',
    color: Colors.soft,
    fontFamily: Fonts.regular,
    letterSpacing: -0.4,
  },
  footerText: {
    textAlign: 'center',
    color: Colors.white,
    fontFamily: Fonts.medium,
    letterSpacing: -0.4,
  },
  footerHighlight: {
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
});
