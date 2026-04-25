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

import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { useBranchForm, ALL_DAYS, OFF_DAY_PRESETS } from '../../../hooks/useBranchForm';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Validation ───────────────────────────────────────────────────────────────
const Schema = Yup.object({
  name:                   Yup.string().trim().min(2, 'At least 2 characters').required('Branch name is required'),
  branch_address:         Yup.string().trim(),
  branch_contact:         Yup.string().trim(),
  branch_subscription_fee: Yup.number()
    .typeError('Enter a valid number')
    .min(0, 'Cannot be negative'),
});

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Off Days Picker ──────────────────────────────────────────────────────────
// Toggle grid of 7 day chips + preset quick-select buttons
function OffDaysPicker({ selected, onChange }) {
  function toggleDay(key) {
    if (selected.includes(key)) onChange(selected.filter((d) => d !== key));
    else onChange([...selected, key]);
  }

  function applyPreset(days) {
    onChange(days);
  }

  return (
    <View style={S.offDaysWrap}>
      {/* Preset buttons */}
      <View style={S.presetRow}>
        {OFF_DAY_PRESETS.map((preset) => {
          const active = JSON.stringify([...preset.days].sort()) === JSON.stringify([...selected].sort());
          return (
            <TouchableOpacity
              key={preset.label}
              style={[S.presetBtn, active && S.presetBtnActive]}
              onPress={() => applyPreset(preset.days)}
              activeOpacity={0.7}
            >
              <Text style={[S.presetBtnText, active && S.presetBtnTextActive]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {selected.length > 0 && (
          <TouchableOpacity
            style={S.presetBtnClear}
            onPress={() => onChange([])}
            activeOpacity={0.7}
          >
            <Text style={S.presetBtnClearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Day chips */}
      <View style={S.dayChipsRow}>
        {ALL_DAYS.map(({ key, label }) => {
          const on = selected.includes(key);
          return (
            <TouchableOpacity
              key={key}
              style={[S.dayChip, on && S.dayChipActive]}
              onPress={() => toggleDay(key)}
              activeOpacity={0.7}
            >
              <Text style={[S.dayChipText, on && S.dayChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected.length > 0 && (
        <Text style={S.offDaysSummary}>
          Off: {selected.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
        </Text>
      )}
    </View>
  );
}

// ─── Branch Form Screen ───────────────────────────────────────────────────────
export default function BranchFormScreen() {
  const router = useRouter();
  const { schoolId, schoolName, branchId } = useLocalSearchParams();

  const { isEdit, branch, fetching, fetchError, save } = useBranchForm(schoolId, branchId);

  const [isActive, setIsActive]   = useState(true);
  const [offDays, setOffDays]     = useState([]);
  const [saveError, setSaveError] = useState('');
  const [initialised, setInitialised] = useState(!branchId); // true immediately for create

  // Set state once branch loads in edit mode
  useEffect(() => {
    if (branch && !initialised) {
      setIsActive(branch.is_active ?? true);
      setOffDays(Array.isArray(branch.off_days) ? branch.off_days : []);
      setInitialised(true);
    }
  }, [branch, initialised]);

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave(values, { setSubmitting }) {
    setSaveError('');
    const result = await save({
      name:                    values.name,
      branch_address:          values.branch_address  || null,
      branch_contact:          values.branch_contact  || null,
      branch_subscription_fee: values.branch_subscription_fee,
      is_active:               isActive,
      offDays,
    });

    if (result.success) {
      router.back();
    } else {
      setSaveError(result.error);
    }
    setSubmitting(false);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} schoolName={schoolName} title="Edit Branch" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (isEdit && (fetchError || !branch)) {
    return (
      <ScreenWrapper>
        <Header router={router} schoolName={schoolName} title="Edit Branch" />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load branch</Text>
          <Text style={S.centerSub}>{fetchError}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.outlineBtn} activeOpacity={0.8}>
            <Text style={S.outlineBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Header router={router} schoolName={schoolName} title={isEdit ? 'Edit Branch' : 'Add Branch'} />

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
          {/* Error banner */}
          {!!saveError && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveError}</Text>
            </View>
          )}

          <Formik
            initialValues={{
              name:                    branch?.name                    ?? '',
              branch_address:          branch?.branch_address          ?? '',
              branch_contact:          branch?.branch_contact          ?? '',
              branch_subscription_fee: branch?.branch_subscription_fee != null
                                         ? String(branch.branch_subscription_fee)
                                         : '',
            }}
            validationSchema={Schema}
            onSubmit={handleSave}
            enableReinitialize
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
              <View style={S.formGap}>

                {/* Branch details */}
                <SectionLabel>Branch Information</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Branch Name</Text>
                  <Input
                    type="text"
                    placeholder="e.g. Main Campus"
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    error={touched.name && errors.name}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Address <Text style={S.optional}>(optional)</Text></Text>
                  <Input
                    type="text"
                    placeholder="Street, City"
                    value={values.branch_address}
                    onChangeText={handleChange('branch_address')}
                    onBlur={handleBlur('branch_address')}
                    error={touched.branch_address && errors.branch_address}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Contact <Text style={S.optional}>(optional)</Text></Text>
                  <Input
                    type="text"
                    placeholder="Phone number or email"
                    value={values.branch_contact}
                    onChangeText={handleChange('branch_contact')}
                    onBlur={handleBlur('branch_contact')}
                    error={touched.branch_contact && errors.branch_contact}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Subscription Fee <Text style={S.optional}>(PKR/month)</Text></Text>
                  <Input
                    type="text"
                    placeholder="0"
                    value={values.branch_subscription_fee}
                    onChangeText={handleChange('branch_subscription_fee')}
                    onBlur={handleBlur('branch_subscription_fee')}
                    error={touched.branch_subscription_fee && errors.branch_subscription_fee}
                    keyboardType="numeric"
                  />
                </View>

                {/* Off days */}
                <SectionLabel>Weekly Off Days</SectionLabel>
                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Select off days</Text>
                  {initialised && (
                    <OffDaysPicker selected={offDays} onChange={setOffDays} />
                  )}
                </View>

                {/* Status (edit only) */}
                {isEdit && (
                  <>
                    <SectionLabel>Status</SectionLabel>
                    <View style={S.statusRow}>
                      <View style={S.statusLeft}>
                        <View style={[S.statusDot, { backgroundColor: isActive ? Colors.success : Colors.danger }]} />
                        <View>
                          <Text style={S.statusLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
                          <Text style={S.statusSub}>
                            {isActive ? 'Branch is operational.' : 'Branch is hidden from the app.'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isActive}
                        onValueChange={(val) => {
                          if (!val) {
                            Alert.alert(
                              'Deactivate Branch',
                              'This will hide the branch from the app. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Deactivate', style: 'destructive', onPress: () => setIsActive(false) },
                              ]
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
                  title={isEdit ? 'Save Changes' : 'Add Branch'}
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

// ─── Screen Header ────────────────────────────────────────────────────────────
function Header({ router, schoolName, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.headerBackBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <View style={S.headerCenter}>
        <Text style={S.headerTitle}>{title}</Text>
        {!!schoolName && <Text style={S.headerSub} numberOfLines={1}>{schoolName}</Text>}
      </View>
      <View style={{ width: hp(4.4) }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerBackBtn: {
    width: hp(4.4),
    height: hp(4.4),
    borderRadius: hp(2.2),
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: wp(2),
  },
  headerTitle: {
    fontSize: hp(2.1),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginTop: 1,
  },

  scroll: {
    padding: wp(4),
    paddingBottom: hp(6),
    gap: hp(1.6),
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: wp(3.5),
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1,
    fontSize: hp(1.5),
    fontFamily: Fonts.medium,
    color: Colors.dangerText,
    lineHeight: hp(2.1),
  },

  // Form
  formGap: { gap: hp(1.4) },
  sectionLabel: {
    fontSize: hp(1.35),
    fontFamily: Fonts.semiBold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: hp(0.6),
  },
  fieldGroup: { gap: hp(0.6) },
  fieldLabel: {
    fontSize: hp(1.5),
    fontFamily: Fonts.medium,
    color: Colors.soft,
    marginLeft: 2,
  },
  optional: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },

  // Off days picker
  offDaysWrap: {
    gap: hp(1),
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: wp(3.5),
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.55),
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  presetBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  presetBtnText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.semiBold,
    color: Colors.soft,
  },
  presetBtnTextActive: {
    color: Colors.primary,
  },
  presetBtnClear: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.55),
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerLight,
  },
  presetBtnClearText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.semiBold,
    color: Colors.danger,
  },
  dayChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    paddingVertical: hp(0.9),
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
  },
  dayChipActive: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orangeLight,
  },
  dayChipText: {
    fontSize: hp(1.3),
    fontFamily: Fonts.semiBold,
    color: Colors.muted,
  },
  dayChipTextActive: {
    color: Colors.orange,
  },
  offDaysSummary: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginTop: hp(0.2),
  },

  // Status toggle
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    flex: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusLabel: {
    fontSize: hp(1.7),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  statusSub: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },

  // Center (loading / error)
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(1.2),
    padding: wp(8),
  },
  centerIcon: {
    width: hp(10),
    height: hp(10),
    borderRadius: hp(5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.4),
  },
  centerTitle: {
    fontSize: hp(2),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  centerSub: {
    fontSize: hp(1.55),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    textAlign: 'center',
  },
  outlineBtn: {
    marginTop: hp(1),
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.2),
    borderRadius: 22,
    backgroundColor: Colors.canvas,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  outlineBtnText: {
    fontSize: hp(1.6),
    fontFamily: Fonts.semiBold,
    color: Colors.soft,
  },
});
