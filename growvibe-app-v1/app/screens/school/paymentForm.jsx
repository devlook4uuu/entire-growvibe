import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import { usePaymentForm, PAYMENT_METHODS, PAYMENT_STATUSES } from '../../../hooks/usePaymentForm';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Validation ───────────────────────────────────────────────────────────────
const Schema = Yup.object({
  payment_month:       Yup.string().trim().required('Payment month is required'),
  fee:                 Yup.number().typeError('Enter a valid number').min(0, 'Cannot be negative').required('Fee is required'),
  amount_paid:         Yup.number().typeError('Enter a valid number').min(0, 'Cannot be negative').required('Amount paid is required'),
  remaining_due:       Yup.number().typeError('Enter a valid number').min(0, 'Cannot be negative').required('Remaining due is required'),
  payment_description: Yup.string().trim(),
});

function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Method Selector ──────────────────────────────────────────────────────────
function MethodSelector({ value, onChange }) {
  return (
    <View style={S.selectorWrap}>
      {PAYMENT_METHODS.map((m) => {
        const active = value === m.key;
        return (
          <TouchableOpacity
            key={m.key}
            style={[S.selectorBtn, active && S.selectorBtnActive]}
            onPress={() => onChange(m.key)}
            activeOpacity={0.7}
          >
            <Text style={[S.selectorBtnText, active && S.selectorBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Status Selector ──────────────────────────────────────────────────────────
function StatusSelector({ value, onChange }) {
  return (
    <View style={S.selectorWrap}>
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[S.selectorBtn, active && { borderColor: s.color, backgroundColor: s.bg }]}
            onPress={() => onChange(s.key)}
            activeOpacity={0.7}
          >
            <View style={[S.statusDot, { backgroundColor: active ? s.color : Colors.muted }]} />
            <Text style={[S.selectorBtnText, active && { color: s.color }]}>{s.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Payment Form Screen ──────────────────────────────────────────────────────
export default function PaymentFormScreen() {
  const router = useRouter();
  const { schoolId, schoolName, paymentId } = useLocalSearchParams();

  const { isEdit, payment, fetching, fetchError, save } = usePaymentForm(schoolId, paymentId);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [saveError, setSaveError]         = useState('');
  const [initialised, setInitialised]     = useState(!paymentId);

  useEffect(() => {
    if (payment && !initialised) {
      setPaymentMethod(payment.payment_method || 'cash');
      setPaymentStatus(payment.payment_status || 'unpaid');
      setInitialised(true);
    }
  }, [payment, initialised]);

  async function handleSave(values, { setSubmitting }) {
    setSaveError('');
    const result = await save({
      payment_month:       values.payment_month,
      fee:                 values.fee,
      amount_paid:         values.amount_paid,
      remaining_due:       values.remaining_due,
      payment_method:      paymentMethod,
      payment_status:      paymentStatus,
      payment_description: values.payment_description,
    });

    if (result.success) {
      router.back();
    } else {
      setSaveError(result.error);
    }
    setSubmitting(false);
  }

  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} schoolName={schoolName} title="Edit Payment" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (isEdit && (fetchError || !payment)) {
    return (
      <ScreenWrapper>
        <Header router={router} schoolName={schoolName} title="Edit Payment" />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load payment</Text>
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
      <Header router={router} schoolName={schoolName} title={isEdit ? 'Edit Payment' : 'Add Payment'} />

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
          {!!saveError && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveError}</Text>
            </View>
          )}

          <Formik
            initialValues={{
              payment_month:       payment?.payment_month       ?? '',
              fee:                 payment?.fee != null          ? String(payment.fee)           : '',
              amount_paid:         payment?.amount_paid != null  ? String(payment.amount_paid)   : '',
              remaining_due:       payment?.remaining_due != null ? String(payment.remaining_due) : '',
              payment_description: payment?.payment_description  ?? '',
            }}
            validationSchema={Schema}
            onSubmit={handleSave}
            enableReinitialize
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue, isSubmitting }) => (
              <View style={S.formGap}>

                <SectionLabel>Payment Details</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Payment Month</Text>
                  <Input
                    type="text"
                    placeholder="e.g. April 2026"
                    value={values.payment_month}
                    onChangeText={handleChange('payment_month')}
                    onBlur={handleBlur('payment_month')}
                    error={touched.payment_month && errors.payment_month}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Total Fee (PKR)</Text>
                  <Input
                    type="text"
                    placeholder="0"
                    value={values.fee}
                    onChangeText={(val) => {
                      handleChange('fee')(val);
                      // Auto-suggest remaining = fee - amount_paid
                      const f = Number(val) || 0;
                      const p = Number(values.amount_paid) || 0;
                      const rem = Math.max(0, f - p);
                      setFieldValue('remaining_due', rem > 0 ? String(rem) : '0');
                    }}
                    onBlur={handleBlur('fee')}
                    error={touched.fee && errors.fee}
                    keyboardType="numeric"
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Amount Paid (PKR)</Text>
                  <Input
                    type="text"
                    placeholder="0"
                    value={values.amount_paid}
                    onChangeText={(val) => {
                      handleChange('amount_paid')(val);
                      // Auto-suggest remaining = fee - amount_paid
                      const f = Number(values.fee) || 0;
                      const p = Number(val) || 0;
                      const rem = Math.max(0, f - p);
                      setFieldValue('remaining_due', rem > 0 ? String(rem) : '0');
                      // Auto-suggest status
                      if (p === 0) setPaymentStatus('unpaid');
                      else if (p >= f && f > 0) setPaymentStatus('paid');
                      else setPaymentStatus('partial');
                    }}
                    onBlur={handleBlur('amount_paid')}
                    error={touched.amount_paid && errors.amount_paid}
                    keyboardType="numeric"
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Remaining Due (PKR)</Text>
                  <Input
                    type="text"
                    placeholder="0"
                    value={values.remaining_due}
                    onChangeText={handleChange('remaining_due')}
                    onBlur={handleBlur('remaining_due')}
                    error={touched.remaining_due && errors.remaining_due}
                    keyboardType="numeric"
                  />
                </View>

                <SectionLabel>Payment Method</SectionLabel>
                {initialised && (
                  <MethodSelector value={paymentMethod} onChange={setPaymentMethod} />
                )}

                <SectionLabel>Payment Status</SectionLabel>
                {initialised && (
                  <StatusSelector value={paymentStatus} onChange={setPaymentStatus} />
                )}

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>
                    Description <Text style={S.optional}>(optional)</Text>
                  </Text>
                  <Input
                    type="text"
                    placeholder="Any notes about this payment…"
                    value={values.payment_description}
                    onChangeText={handleChange('payment_description')}
                    onBlur={handleBlur('payment_description')}
                    error={touched.payment_description && errors.payment_description}
                  />
                </View>

                <Button
                  title={isEdit ? 'Save Changes' : 'Add Payment'}
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

  formGap: { gap: hp(1.4) },
  sectionLabel: {
    fontSize: hp(1.35), fontFamily: Fonts.semiBold, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: hp(0.6),
  },
  fieldGroup: { gap: hp(0.6) },
  fieldLabel: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },
  optional: { fontFamily: Fonts.regular, color: Colors.muted },

  selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(3.5), paddingVertical: hp(0.9),
    borderRadius: 20, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.canvas,
  },
  selectorBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  selectorBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.soft },
  selectorBtnTextActive: { color: Colors.primary },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), padding: wp(8),
  },
  centerIcon: {
    width: hp(10), height: hp(10), borderRadius: hp(5),
    alignItems: 'center', justifyContent: 'center', marginBottom: hp(0.4),
  },
  centerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  centerSub: { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center' },
  outlineBtn: {
    marginTop: hp(1), paddingHorizontal: wp(8), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.canvas, borderWidth: 1.5, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft },
});
