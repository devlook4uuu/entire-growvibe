/**
 * staffForm.jsx
 *
 * Shared create/edit form for principal, coordinator, teacher.
 * Route params:
 *   role        — 'principal' | 'coordinator' | 'teacher'
 *   branchId    — uuid  (required for create)
 *   schoolId    — uuid  (required for create)
 *   branchName  — display label
 *   staffId     — uuid  (edit mode only)
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';
import { invalidateStaffCache } from '../../../hooks/useStaffList';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

const ROLE_META = {
  principal:   { label: 'Principal',   singular: 'principal' },
  coordinator: { label: 'Coordinator', singular: 'coordinator' },
  teacher:     { label: 'Teacher',     singular: 'teacher' },
};

// ─── Validation schemas ───────────────────────────────────────────────────────
const CreateSchema = Yup.object({
  name:     Yup.string().trim().min(2, 'At least 2 characters').required('Name is required'),
  email:    Yup.string().email('Enter a valid email').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const EditSchema = Yup.object({
  name:     Yup.string().trim().min(2, 'At least 2 characters').required('Name is required'),
  email:    Yup.string().email('Enter a valid email').required('Email is required'),
  password: Yup.string().test(
    'password-min',
    'Password must be at least 6 characters',
    (val) => !val || val.length >= 6,
  ),
});

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Staff Form Screen ────────────────────────────────────────────────────────
export default function StaffFormScreen() {
  const router = useRouter();
  const { role, branchId, schoolId, branchName, staffId } = useLocalSearchParams();
  const isEdit = !!staffId;

  const meta = ROLE_META[role] ?? ROLE_META.teacher;

  const [staff,       setStaff]       = useState(null);
  const [fetching,    setFetching]    = useState(isEdit);
  const [fetchError,  setFetchError]  = useState(null);
  const [saveError,   setSaveError]   = useState('');
  const [isActive,    setIsActive]    = useState(true);

  // ── Load staff record (edit mode) ──────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, is_active, created_at, branch_id, school_id, class_id')
        .eq('id', staffId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setFetchError(error?.message || 'Record not found.');
      } else {
        setStaff(data);
        setIsActive(data.is_active ?? true);
      }
      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [staffId, isEdit]);

  // ── Create handler ─────────────────────────────────────────────────────────
  async function handleCreate(values, { setSubmitting }) {
    setSaveError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('create-user', {
        body: {
          name:      values.name.trim(),
          email:     values.email.trim(),
          password:  values.password,
          role,
          school_id: schoolId,
          branch_id: branchId,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      invalidateStaffCache(role, branchId);
      router.back();
    } catch (err) {
      setSaveError(err.message || `Failed to create ${meta.singular}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit handler ───────────────────────────────────────────────────────────
  async function handleEdit(values, { setSubmitting }) {
    setSaveError('');
    try {
      const body = {
        user_id:   staff.id,
        name:      values.name.trim(),
        email:     values.email.trim(),
        is_active: isActive,
      };
      if (values.password) body.password = values.password;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('update-user', {
        body,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      invalidateStaffCache(role, branchId ?? staff.branch_id);
      router.back();
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} title={`Edit ${meta.label}`} />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Fetch error ────────────────────────────────────────────────────────────
  if (isEdit && (fetchError || !staff)) {
    return (
      <ScreenWrapper>
        <Header router={router} title={`Edit ${meta.label}`} />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load record</Text>
          <Text style={S.centerSub}>{fetchError}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.outlineBtn} activeOpacity={0.8}>
            <Text style={S.outlineBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  const joinDate = staff?.created_at
    ? new Date(staff.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <ScreenWrapper>
      <Header router={router} title={isEdit ? `Edit ${meta.label}` : `Add ${meta.label}`} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Identity strip (edit only) ── */}
          {isEdit && staff && (
            <View style={S.identityCard}>
              <Avatar url={staff.avatar_url} name={staff.name || ''} size={hp(7)} />
              <View style={S.identityMeta}>
                <Text style={S.identityName} numberOfLines={1}>{staff.name || '—'}</Text>
                {joinDate && <Text style={S.identityJoin}>Joined {joinDate}</Text>}
                <View style={S.metaRow}>
                  <Ionicons name="git-branch-outline" size={12} color={Colors.muted} />
                  <Text style={S.identityBranch}>{branchName || 'Branch'}</Text>
                </View>
                {role === 'teacher' && (
                  <View style={S.metaRow}>
                    <Ionicons name="library-outline" size={12} color={Colors.muted} />
                    <Text style={S.identityBranch}>
                      {staff.class_id ? 'Class assigned' : 'Unassigned'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Server error banner ── */}
          {!!saveError && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveError}</Text>
            </View>
          )}

          <Formik
            initialValues={{
              name:     staff?.name  || '',
              email:    staff?.email || '',
              password: '',
            }}
            validationSchema={isEdit ? EditSchema : CreateSchema}
            onSubmit={isEdit ? handleEdit : handleCreate}
            enableReinitialize
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
              <View style={S.formGap}>

                <SectionLabel>Basic Information</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Full Name</Text>
                  <Input
                    type="text"
                    placeholder={`${meta.label}'s full name`}
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    error={touched.name && errors.name}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Email Address</Text>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={touched.email && errors.email}
                  />
                </View>

                <SectionLabel>{isEdit ? 'Change Password' : 'Set Password'}</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>{isEdit ? 'New Password' : 'Password'}</Text>
                  <Input
                    type="password"
                    placeholder={isEdit ? 'Leave blank to keep current' : 'Minimum 6 characters'}
                    value={values.password}
                    onChangeText={handleChange('password')}
                    onBlur={handleBlur('password')}
                    error={touched.password && errors.password}
                  />
                  {isEdit && (
                    <Text style={S.fieldHint}>Leave blank to keep the current password unchanged.</Text>
                  )}
                </View>

                {/* Account status (edit only) */}
                {isEdit && (
                  <>
                    <SectionLabel>Account Status</SectionLabel>
                    <View style={S.statusRow}>
                      <View style={S.statusLeft}>
                        <View style={[S.statusDot, { backgroundColor: isActive ? Colors.success : Colors.danger }]} />
                        <View>
                          <Text style={S.statusLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
                          <Text style={S.statusSub}>
                            {isActive
                              ? `${meta.label} can log in and use the app.`
                              : `${meta.label} is blocked from logging in.`}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isActive}
                        onValueChange={(val) => {
                          if (!val) {
                            Alert.alert(
                              `Deactivate ${meta.label}`,
                              `This will block the ${meta.singular} from logging in. Continue?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Deactivate', style: 'destructive', onPress: () => setIsActive(false) },
                              ],
                            );
                          } else {
                            setIsActive(true);
                          }
                        }}
                        trackColor={{ false: Colors.borderLight, true: Colors.success + '60' }}
                        thumbColor={isActive ? Colors.success : Colors.muted}
                      />
                    </View>
                  </>
                )}

                <Button
                  title={isEdit ? 'Save Changes' : `Add ${meta.label}`}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  size="small"
                />

              </View>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Screen header ────────────────────────────────────────────────────────────
function Header({ router, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.headerBackBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <Text style={S.headerTitle}>{title}</Text>
      <View style={{ width: hp(4.4) }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1.6),
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerBackBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3,
  },

  scroll: { padding: wp(4), paddingBottom: hp(6), gap: hp(1.6) },

  identityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    gap: wp(3.5), shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  identityMeta:   { flex: 1, gap: 3 },
  identityName:   { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  identityJoin:   { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  identityBranch: { fontSize: hp(1.35), fontFamily: Fonts.medium, color: Colors.soft },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1, fontSize: hp(1.5), fontFamily: Fonts.medium,
    color: Colors.dangerText, lineHeight: hp(2.1),
  },

  formGap:    { gap: hp(1.4) },
  sectionLabel: {
    fontSize: hp(1.35), fontFamily: Fonts.semiBold, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: hp(0.6),
  },
  fieldGroup: { gap: hp(0.6) },
  fieldLabel: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },
  fieldHint:  { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted, marginLeft: 2 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 14, padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  statusLeft:  { flexDirection: 'row', alignItems: 'center', gap: wp(3), flex: 1 },
  statusDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusLabel: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  statusSub:   { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },

  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), padding: wp(8),
  },
  centerIcon: {
    width: hp(10), height: hp(10), borderRadius: hp(5),
    alignItems: 'center', justifyContent: 'center', marginBottom: hp(0.4),
  },
  centerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  centerSub:   { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center' },
  outlineBtn: {
    marginTop: hp(1), paddingHorizontal: wp(8), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.canvas, borderWidth: 1.5, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft },
});
