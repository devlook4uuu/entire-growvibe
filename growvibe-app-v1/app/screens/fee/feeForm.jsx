/**
 * feeForm.jsx
 *
 * Add or edit a monthly fee record for a student.
 * Route params:
 *   studentId   — uuid
 *   studentName — display name
 *   sessionId   — uuid
 *   sessionName — display label
 *   classId     — uuid
 *   branchId    — uuid
 *   schoolId    — uuid
 *   recordId    — uuid (edit mode only)
 *   month       — 'YYYY-MM' (edit mode — pre-fills month picker)
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { invalidateFeeCache } from '../../../hooks/useFeeList';
import { sendPush } from '../../../lib/notifications';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import Input from '../../../components/Input';

// ─── Constants ────────────────────────────────────────────────────────────────
const METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online' },
];

// Generate last 24 months + next 2
function buildMonthOptions() {
  const now = new Date();
  const options = [];
  for (let i = -2; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}
const MONTH_OPTIONS = buildMonthOptions();

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Dropdown Sheet ───────────────────────────────────────────────────────────
function DropdownSheet({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <View style={D.sheet}>
          <View style={D.handle} />
          <Text style={D.sheetTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: hp(45) }}>
            {options.map((opt) => {
              const active = opt.value === selected;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[D.sheetItem, active && D.sheetItemActive]}
                  onPress={() => { onSelect(opt.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[D.sheetItemText, active && D.sheetItemTextActive]}>{opt.label}</Text>
                  {active && <Ionicons name="checkmark" size={hp(2)} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const D = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: hp(4), paddingTop: hp(1.2),
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight,
    alignSelf: 'center', marginBottom: hp(1.6),
  },
  sheetTitle: {
    fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink,
    paddingHorizontal: wp(5), marginBottom: hp(1),
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(5), paddingVertical: hp(1.6),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetItemActive: { backgroundColor: Colors.primaryLight },
  sheetItemText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink },
  sheetItemTextActive: { fontFamily: Fonts.semiBold, color: Colors.primary },
});

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children, error }) {
  return (
    <View style={S.fieldGroup}>
      <Text style={S.fieldLabel}>{label}</Text>
      {children}
      {!!error && <Text style={S.fieldError}>{error}</Text>}
    </View>
  );
}

// ─── Selector Button ──────────────────────────────────────────────────────────
function SelectorBtn({ value, placeholder, onPress, error }) {
  return (
    <TouchableOpacity
      style={[S.selectorBtn, error && S.selectorBtnError]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[S.selectorText, !value && { color: Colors.muted }]}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={hp(1.8)} color={Colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Fee Form Screen ──────────────────────────────────────────────────────────
export default function FeeFormScreen() {
  const router = useRouter();
  const {
    studentId, studentName,
    sessionId, sessionName,
    classId, branchId, schoolId,
    recordId, month: paramMonth,
  } = useLocalSearchParams();

  const isEdit = !!recordId;

  const [fetching,  setFetching]  = useState(isEdit);
  const [fetchErr,  setFetchErr]  = useState(null);

  // Form state
  const [month,         setMonth]         = useState(paramMonth || currentMonth());
  const [feeAmount,     setFeeAmount]     = useState('');
  const [amountPaid,    setAmountPaid]    = useState('');
  const [method,        setMethod]        = useState(null);
  const [description,   setDescription]  = useState('');

  // Errors
  const [monthErr,   setMonthErr]   = useState('');
  const [feeErr,     setFeeErr]     = useState('');
  const [paidErr,    setPaidErr]    = useState('');

  const [saveErr,    setSaveErr]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dropdowns
  const [monthSheet,  setMonthSheet]  = useState(false);
  const [methodSheet, setMethodSheet] = useState(false);

  // ── Load existing record (edit mode) ───────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('student_fee_records')
        .select('*')
        .eq('id', recordId)
        .single();
      setFetching(false);
      if (error || !data) { setFetchErr('Could not load record.'); return; }
      setMonth(data.month || currentMonth());
      setFeeAmount(String(data.fee_amount ?? ''));
      setAmountPaid(String(data.amount_paid ?? ''));
      setMethod(data.payment_method || null);
      setDescription(data.description || '');
    })();
  }, [isEdit, recordId]);

  // ── Pre-fill fee amount from most recent record (add mode only) ────────────
  useEffect(() => {
    if (isEdit || !studentId || !sessionId) return;
    supabase
      .from('student_fee_records')
      .select('fee_amount')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.fee_amount != null) {
          setFeeAmount(String(data.fee_amount));
        }
      });
  }, [isEdit, studentId, sessionId]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    let ok = true;
    setMonthErr(''); setFeeErr(''); setPaidErr('');
    if (!month) { setMonthErr('Month is required.'); ok = false; }
    const fa = parseFloat(feeAmount);
    if (!feeAmount || isNaN(fa) || fa < 0) { setFeeErr('Enter a valid fee amount.'); ok = false; }
    const ap = parseFloat(amountPaid);
    if (amountPaid === '' || isNaN(ap) || ap < 0) { setPaidErr('Enter a valid paid amount.'); ok = false; }
    else if (ok && ap > fa) { setPaidErr('Amount paid cannot exceed fee amount.'); ok = false; }
    return ok;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaveErr('');
    setSubmitting(true);

    try {
      const { error } = await supabase.rpc('upsert_fee_record', {
        p_school_id:      schoolId,
        p_branch_id:      branchId,
        p_session_id:     sessionId,
        p_class_id:       classId,
        p_student_id:     studentId,
        p_month:          month,
        p_fee_amount:     parseFloat(feeAmount),
        p_amount_paid:    parseFloat(amountPaid),
        p_payment_method: method || null,
        p_description:    description.trim() || null,
      });

      if (error) { setSaveErr(error.message); return; }

      // Notify student of new fee record (fire-and-forget, new records only)
      if (!isEdit) {
        const mLabel = MONTH_OPTIONS.find((o) => o.value === month)?.label || month;
        sendPush([studentId], 'Fee Record', `${mLabel} fee record has been created`).catch(() => {});
      }

      invalidateFeeCache(studentId, sessionId);
      router.back();
    } catch (e) {
      setSaveErr('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Month display label ───────────────────────────────────────────────────
  const monthLabel = MONTH_OPTIONS.find((o) => o.value === month)?.label || month;
  const methodLabel = METHODS.find((m) => m.value === method)?.label || null;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} studentName={studentName} title="Edit Fee Record" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (isEdit && fetchErr) {
    return (
      <ScreenWrapper>
        <Header router={router} studentName={studentName} title="Edit Fee Record" />
        <View style={S.centerWrap}>
          <Ionicons name="alert-circle-outline" size={hp(5)} color={Colors.danger} />
          <Text style={S.centerTitle}>{fetchErr}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.outlineBtn} activeOpacity={0.8}>
            <Text style={S.outlineBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Header router={router} studentName={studentName} title={isEdit ? 'Edit Fee Record' : 'Add Fee Record'} />

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
          {!!saveErr && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveErr}</Text>
            </View>
          )}

          <View style={S.formGap}>

            {/* Month */}
            <Field label="Month" error={monthErr}>
              <SelectorBtn
                value={monthLabel}
                placeholder="Select month"
                onPress={() => setMonthSheet(true)}
                error={monthErr}
              />
            </Field>

            {/* Fee Amount */}
            <Field label="Fee Amount" error={feeErr}>
              <Input
                type="text"
                keyboardType="decimal-pad"
                placeholder="e.g. 5000"
                value={feeAmount}
                onChangeText={(t) => { setFeeAmount(t); setFeeErr(''); }}
                error={feeErr}
              />
            </Field>

            {/* Amount Paid */}
            <Field label="Amount Paid" error={paidErr}>
              <Input
                type="text"
                keyboardType="decimal-pad"
                placeholder="e.g. 5000"
                value={amountPaid}
                onChangeText={(t) => { setAmountPaid(t); setPaidErr(''); }}
                error={paidErr}
              />
            </Field>

            {/* Remaining (computed display) */}
            {feeAmount !== '' && amountPaid !== '' && !isNaN(parseFloat(feeAmount)) && !isNaN(parseFloat(amountPaid)) && (
              <View style={S.remainingRow}>
                <Text style={S.remainingLabel}>Remaining</Text>
                <Text style={[
                  S.remainingValue,
                  { color: parseFloat(feeAmount) - parseFloat(amountPaid) > 0 ? Colors.danger : Colors.success }
                ]}>
                  PKR {(parseFloat(feeAmount) - parseFloat(amountPaid)).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Payment Method */}
            <Field label="Payment Method (optional)">
              <SelectorBtn
                value={methodLabel}
                placeholder="Select method"
                onPress={() => setMethodSheet(true)}
              />
            </Field>

            {/* Description */}
            <Field label="Description / Note (optional)">
              <Input
                type="text"
                placeholder="e.g. Partial payment, scholarship discount…"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </Field>

            {/* Save */}
            <TouchableOpacity
              style={[S.saveBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={S.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Fee Record'}</Text>
              }
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Month dropdown */}
      <DropdownSheet
        visible={monthSheet}
        title="Select Month"
        options={MONTH_OPTIONS}
        selected={month}
        onSelect={(v) => { setMonth(v); setMonthErr(''); }}
        onClose={() => setMonthSheet(false)}
      />

      {/* Method dropdown */}
      <DropdownSheet
        visible={methodSheet}
        title="Payment Method"
        options={[{ value: '', label: 'None' }, ...METHODS]}
        selected={method || ''}
        onSelect={(v) => setMethod(v || null)}
        onClose={() => setMethodSheet(false)}
      />
    </ScreenWrapper>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ router, studentName, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <View style={S.headerCenter}>
        <Text style={S.headerTitle}>{title}</Text>
        {!!studentName && <Text style={S.headerSub} numberOfLines={1}>{studentName}</Text>}
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
  backBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  scroll: { padding: wp(4), paddingBottom: hp(6) },
  formGap: { gap: hp(1.6) },

  fieldGroup: { gap: hp(0.6) },
  fieldLabel: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },
  fieldError: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.danger, marginLeft: 2 },

  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: hp(5.8), borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, backgroundColor: Colors.white,
  },
  selectorBtnError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  selectorText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, flex: 1 },

  remainingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.canvas, borderRadius: 12,
    paddingHorizontal: wp(4), paddingVertical: hp(1.2),
  },
  remainingLabel: { fontSize: hp(1.55), fontFamily: Fonts.medium, color: Colors.soft },
  remainingValue: { fontSize: hp(1.7), fontFamily: Fonts.bold },

  saveBtn: {
    height: hp(5.8), borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: hp(0.4),
  },
  saveBtnText: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.white },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.dangerBorder, marginBottom: hp(0.4),
  },
  errorBannerText: {
    flex: 1, fontSize: hp(1.5), fontFamily: Fonts.medium,
    color: Colors.dangerText, lineHeight: hp(2.1),
  },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), padding: wp(8) },
  centerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  outlineBtn: {
    marginTop: hp(1), paddingHorizontal: wp(8), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.canvas, borderWidth: 1.5, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft },
});
