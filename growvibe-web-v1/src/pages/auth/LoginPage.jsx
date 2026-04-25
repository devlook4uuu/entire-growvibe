import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

import { loginThunk, clearError } from '../../store/authSlice';
import { C, FONT, RADIUS } from '../../styles/colors';
import BrandingPanel from '../../components/auth/BrandingPanel';
import FormInput from '../../components/ui/FormInput';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { ButtonSpinner } from '../../components/ui/Spinner';

// ─── Validation schema ────────────────────────────────────────────────────────
const loginSchema = Yup.object({
  email: Yup.string()
    .email('Enter a valid email address.')
    .required('Email is required.'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters.')
    .required('Password is required.'),
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: FONT,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: C.canvas,
    overflowY: 'auto',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
  },
  mobileLogoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    justifyContent: 'center',
  },
  mobileLogoBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    background: C.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoLetter: {
    fontSize: 20,
    fontWeight: 800,
    color: C.white,
    fontFamily: FONT,
  },
  mobileBrandName: {
    fontSize: 22,
    fontWeight: 800,
    color: C.ink,
    letterSpacing: '-0.3px',
    fontFamily: FONT,
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: C.ink,
    letterSpacing: '-0.3px',
    marginBottom: 6,
    fontFamily: FONT,
  },
  subheading: {
    fontSize: 14,
    color: C.soft,
    marginBottom: 28,
    fontWeight: 400,
    fontFamily: FONT,
  },
  submitBtn: (hovered, disabled) => ({
    width: '100%',
    height: 48,
    borderRadius: RADIUS.md,
    border: 'none',
    background: disabled ? C.primaryLight : hovered ? C.primaryDark : C.primary,
    color: disabled ? C.primary : C.white,
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s',
    fontFamily: FONT,
    letterSpacing: '-0.1px',
    marginTop: 4,
  }),
  footerNote: {
    marginTop: 28,
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 1.6,
    fontFamily: FONT,
  },
};

// ─── MobileLogo — shown only when branding panel is hidden ───────────────────
function MobileLogo() {
  return (
    <div style={S.mobileLogoRow}>
      <div style={S.mobileLogoBox}>
        <span style={S.mobileLogoLetter}>G</span>
      </div>
      <span style={S.mobileBrandName}>GrowVibe</span>
    </div>
  );
}

// ─── SubmitButton ─────────────────────────────────────────────────────────────
function SubmitButton({ loading, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="submit"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={S.submitBtn(hovered, disabled)}
    >
      {loading ? <ButtonSpinner /> : 'Sign In'}
    </button>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, session } = useSelector((s) => s.auth);

  const [isWide, setIsWide] = useState(window.innerWidth >= 768);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function handleSubmit(values) {
    try {
      await dispatch(loginThunk(values)).unwrap();
      navigate('/dashboard', { replace: true });
    } catch {
      // error already stored in Redux state, shown via <ErrorBanner />
    }
  }

  return (
    <div style={S.root}>
      <BrandingPanel visible={isWide} />

      <div style={{ ...S.rightPanel, padding: isWide ? '48px 40px' : '32px 24px' }}>
        <div style={S.formCard}>
          {!isWide && <MobileLogo />}

          <div style={S.heading}>Welcome back</div>
          <div style={S.subheading}>Sign in to your account</div>

          <ErrorBanner message={error} />

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={loginSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, isValid, dirty }) => (
              <Form noValidate>
                <Field
                  name="email"
                  component={FormInput}
                  label="Email"
                  type="email"
                  placeholder="email@school.com"
                  autoComplete="email"
                  disabled={loading}
                />

                <Field
                  name="password"
                  component={FormInput}
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <SubmitButton
                  loading={loading || isSubmitting}
                  disabled={loading || isSubmitting || !isValid || !dirty}
                />
              </Form>
            )}
          </Formik>

          <div style={S.footerNote}>
            Forgot your password? Contact your school administrator.
          </div>
        </div>
      </div>
    </div>
  );
}
