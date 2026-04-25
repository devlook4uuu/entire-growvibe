import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { useSessionForm } from '../../../hooks/useSessionForm';
import { invalidateSelectorSessionCache } from '../../../components/BranchSessionSelector';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Date Picker Field ────────────────────────────────────────────────────────
function DateField({ label, value, onChange, minimumDate, error }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value + 'T00:00:00') : new Date();

  function handleChange(_event, selected) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(toISODate(selected));
  }

  return (
    <View style={S.fieldGroup}>
      <Text style={S.fieldLabel}>{label}</Text>

      <TouchableOpacity
        onPress={() => setShow(true)}
        style={[S.datePickerBtn, !!error && S.datePickerBtnError]}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={hp(2.2)} color={Colors.primary} />
        <Text style={[S.datePickerText, !value && { color: Colors.muted }]}>
          {value ? formatDisplay(value) : 'Select date'}
        </Text>
        <Ionicons name="chevron-down" size={hp(1.8)} color={Colors.muted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {!!error && <Text style={S.fieldError}>{error}</Text>}

      {/* iOS: bottom sheet */}
      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
              activeOpacity={1}
              onPress={() => setShow(false)}
            />
            <View style={S.dateSheet}>
              <View style={S.dateSheetHeader}>
                <Text style={S.dateSheetTitle}>{label}</Text>
                <TouchableOpacity onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={S.dateSheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                onChange={handleChange}
                style={{ height: 200, width: '100%' }}
                textColor={Colors.ink}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android: native dialog */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Session Form Screen ──────────────────────────────────────────────────────
export default function SessionFormScreen() {
  const router = useRouter();
  const { branchId, schoolId, branchName, sessionId } = useLocalSearchParams();

  const { isEdit, session, fetching, fetchError, save } = useSessionForm(branchId, schoolId, sessionId);

  const [sessionName,  setSessionName]  = useState('');
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd,   setSessionEnd]   = useState('');
  const [isActive,     setIsActive]     = useState(true);
  const [saveError,    setSaveError]    = useState('');
  const [nameError,    setNameError]    = useState('');
  const [startError,   setStartError]   = useState('');
  const [endError,     setEndError]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [initialised,  setInitialised]  = useState(!sessionId);

  useEffect(() => {
    if (session && !initialised) {
      setSessionName(session.session_name ?? '');
      setSessionStart(session.session_start ?? '');
      setSessionEnd(session.session_end ?? '');
      setIsActive(session.is_active ?? false);
      setInitialised(true);
    }
  }, [session, initialised]);

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    let ok = true;
    setNameError('');
    setStartError('');
    setEndError('');

    if (!sessionName.trim() || sessionName.trim().length < 2) {
      setNameError('Session name must be at least 2 characters.');
      ok = false;
    }
    if (!sessionStart) {
      setStartError('Start date is required.');
      ok = false;
    }
    if (!sessionEnd) {
      setEndError('End date is required.');
      ok = false;
    } else if (sessionStart && sessionEnd <= sessionStart) {
      setEndError('End date must be after start date.');
      ok = false;
    }
    return ok;
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaveError('');
    setSubmitting(true);

    const result = await save({
      session_name:  sessionName,
      session_start: sessionStart,
      session_end:   sessionEnd,
      is_active:     isActive,
    });

    setSubmitting(false);
    if (result.success) {
      invalidateSelectorSessionCache(branchId);
      router.back();
    } else {
      setSaveError(result.error);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} branchName={branchName} title="Edit Session" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (isEdit && (fetchError || !session)) {
    return (
      <ScreenWrapper>
        <Header router={router} branchName={branchName} title="Edit Session" />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load session</Text>
          <Text style={S.centerSub}>{fetchError}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.outlineBtn} activeOpacity={0.8}>
            <Text style={S.outlineBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  const startDateObj = sessionStart ? new Date(sessionStart + 'T00:00:00') : undefined;
  const minEndDate   = startDateObj
    ? new Date(startDateObj.getTime() + 86400000) // +1 day
    : undefined;

  return (
    <ScreenWrapper>
      <Header router={router} branchName={branchName} title={isEdit ? 'Edit Session' : 'New Session'} />

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

          <View style={S.formGap}>

            <SectionLabel>Session Details</SectionLabel>

            {/* Session name */}
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Session Name</Text>
              <Input
                type="text"
                placeholder="e.g. 2025–2026"
                value={sessionName}
                onChangeText={(t) => { setSessionName(t); setNameError(''); }}
                error={nameError}
              />
            </View>

            {/* Start date */}
            {initialised && (
              <DateField
                label="Start Date"
                value={sessionStart}
                onChange={(d) => { setSessionStart(d); setStartError(''); setEndError(''); }}
                error={startError}
              />
            )}

            {/* End date — min = start + 1 day */}
            {initialised && (
              <DateField
                label="End Date"
                value={sessionEnd}
                onChange={(d) => { setSessionEnd(d); setEndError(''); }}
                minimumDate={minEndDate}
                error={endError}
              />
            )}

            {/* Status */}
            <SectionLabel>Status</SectionLabel>
            <View style={S.statusRow}>
              <View style={S.statusLeft}>
                <View style={[S.statusDot, { backgroundColor: isActive ? Colors.success : Colors.muted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={S.statusLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
                  <Text style={S.statusSub}>
                    {isActive
                      ? 'Current session for this branch.'
                      : 'Session is archived.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isActive}
                onValueChange={(val) => {
                  if (!val && isEdit) {
                    Alert.alert(
                      'Deactivate Session',
                      'This branch will have no active session. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Deactivate', style: 'destructive', onPress: () => setIsActive(false) },
                      ]
                    );
                  } else {
                    setIsActive(val);
                  }
                }}
                trackColor={{ false: Colors.borderLight, true: Colors.success + '60' }}
                thumbColor={isActive ? Colors.success : Colors.muted}
              />
            </View>

            {isActive && (
              <View style={S.infoBanner}>
                <Ionicons name="information-circle-outline" size={hp(2)} color={Colors.primary} />
                <Text style={S.infoBannerText}>
                  Activating this session will automatically deactivate any other active session for this branch.
                </Text>
              </View>
            )}

            <Button
              title={isEdit ? 'Save Changes' : 'Create Session'}
              onPress={handleSave}
              loading={submitting}
              size="small"
            />

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────
function Header({ router, branchName, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.headerBackBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <View style={S.headerCenter}>
        <Text style={S.headerTitle}>{title}</Text>
        {!!branchName && <Text style={S.headerSub} numberOfLines={1}>{branchName}</Text>}
      </View>
      <View style={{ width: hp(4.4) }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1.4),
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerBackBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  scroll: { padding: wp(4), paddingBottom: hp(6), gap: hp(1.6) },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1, fontSize: hp(1.5), fontFamily: Fonts.medium,
    color: Colors.dangerText, lineHeight: hp(2.1),
  },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  infoBannerText: {
    flex: 1, fontSize: hp(1.4), fontFamily: Fonts.regular,
    color: Colors.primary, lineHeight: hp(2),
  },

  formGap: { gap: hp(1.4) },
  sectionLabel: {
    fontSize: hp(1.35), fontFamily: Fonts.semiBold, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: hp(0.6),
  },
  fieldGroup: { gap: hp(0.6) },
  fieldLabel: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },
  fieldError: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.danger, marginLeft: 2 },

  // Date picker
  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: hp(5.8), borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, backgroundColor: Colors.white,
  },
  datePickerBtnError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  datePickerText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, flex: 1 },

  // iOS date sheet
  dateSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: hp(4),
  },
  dateSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: wp(5), paddingVertical: hp(1.8),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  dateSheetTitle: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink },
  dateSheetDone: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.primary },

  // Status toggle
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 14, padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: wp(3), flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusLabel: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  statusSub: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), padding: wp(8) },
  centerIcon: { width: hp(10), height: hp(10), borderRadius: hp(5), alignItems: 'center', justifyContent: 'center', marginBottom: hp(0.4) },
  centerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  centerSub: { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center' },
  outlineBtn: {
    marginTop: hp(1), paddingHorizontal: wp(8), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.canvas, borderWidth: 1.5, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft },
});
