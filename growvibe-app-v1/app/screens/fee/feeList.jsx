/**
 * feeList.jsx
 *
 * Displays all fee records for a single student within a session.
 * Route params:
 *   studentId   — uuid
 *   studentName — display label
 *   sessionId   — uuid
 *   sessionName — display label
 *   classId     — uuid (passed to feeForm)
 *   branchId    — uuid
 *   schoolId    — uuid
 */

import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFeeList } from '../../../hooks/useFeeList';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { ErrorState, SkeletonLines } from '../../../components/ListScreenComponents';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatMonth(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatAmount(n) {
  return Number(n || 0).toLocaleString();
}

const STATUS_CONFIG = {
  paid:    { label: 'Paid',    color: Colors.success,  bg: Colors.successLight },
  partial: { label: 'Partial', color: Colors.warning,  bg: Colors.warningLight },
  unpaid:  { label: 'Unpaid',  color: Colors.danger,   bg: Colors.dangerLight  },
};

const METHOD_LABEL = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  online:        'Online',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: hp(1) }}>
        <View style={{ height: 14, width: '40%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
        <View style={{ height: 20, width: 60, borderRadius: 20, backgroundColor: Colors.borderLight }} />
      </View>
      <SkeletonLines widths={['55%', '45%', '60%']} />
    </View>
  );
}

// ─── Fee Card ─────────────────────────────────────────────────────────────────
function FeeCard({ item, onEdit }) {
  const status = STATUS_CONFIG[item.payment_status] || STATUS_CONFIG.unpaid;
  const remaining = (Number(item.fee_amount) - Number(item.amount_paid)).toFixed(2);

  return (
    <View style={S.card}>
      {/* Header row */}
      <View style={S.cardHeader}>
        <Text style={S.cardMonth}>{formatMonth(item.month)}</Text>
        <View style={[S.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[S.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Fee rows */}
      <View style={S.cardRows}>
        <FeeRow label="Fee Amount"  value={`PKR ${formatAmount(item.fee_amount)}`} />
        <FeeRow label="Amount Paid" value={`PKR ${formatAmount(item.amount_paid)}`} />
        <FeeRow
          label="Remaining"
          value={`PKR ${formatAmount(remaining)}`}
          valueColor={Number(remaining) > 0 ? Colors.danger : Colors.success}
        />
        {item.payment_method && (
          <FeeRow label="Method" value={METHOD_LABEL[item.payment_method] || item.payment_method} />
        )}
        {item.description ? (
          <FeeRow label="Note" value={item.description} />
        ) : null}
      </View>

      {/* Edit button */}
      <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} activeOpacity={0.7} hitSlop={6}>
        <Ionicons name="create-outline" size={hp(1.9)} color={Colors.primary} />
        <Text style={S.editBtnText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

function FeeRow({ label, value, valueColor }) {
  return (
    <View style={S.feeRow}>
      <Text style={S.feeLabel}>{label}</Text>
      <Text style={[S.feeValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function FeeListScreen() {
  const router = useRouter();
  const { studentId, studentName, sessionId, sessionName, classId, branchId, schoolId } =
    useLocalSearchParams();

  const { items, loading, refreshing, error, refresh } = useFeeList(studentId, sessionId);

  function handleAdd() {
    router.push({
      pathname: '/screens/fee/feeForm',
      params: { studentId, studentName, sessionId, sessionName, classId, branchId, schoolId },
    });
  }

  function handleEdit(record) {
    router.push({
      pathname: '/screens/fee/feeForm',
      params: {
        studentId, studentName, sessionId, sessionName, classId, branchId, schoolId,
        recordId: record.id,
        month: record.month,
      },
    });
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>Fee Records</Text>
          {!!studentName && <Text style={S.headerSub} numberOfLines={1}>{studentName}</Text>}
        </View>
        <TouchableOpacity onPress={handleAdd} style={S.addBtn} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="add" size={hp(2.6)} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Session label */}
      {!!sessionName && (
        <View style={S.sessionBanner}>
          <Ionicons name="calendar-outline" size={hp(1.7)} color={Colors.primary} />
          <Text style={S.sessionBannerText}>{sessionName}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeeCard item={item} onEdit={handleEdit} />}
          contentContainerStyle={items.length === 0 ? S.emptyContainer : S.listPad}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <View style={S.emptyIcon}>
                <Ionicons name="receipt-outline" size={hp(4)} color={Colors.muted} />
              </View>
              <Text style={S.emptyTitle}>No fee records yet</Text>
              <Text style={S.emptySub}>Tap + to add the first fee record for this student.</Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
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
  addBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  sessionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: wp(4), paddingVertical: hp(0.9),
    backgroundColor: Colors.primaryLight, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sessionBannerText: { fontSize: hp(1.45), fontFamily: Fonts.medium, color: Colors.primary },

  listPad:       { padding: wp(4), gap: hp(1.4) },
  emptyContainer:{ flexGrow: 1, paddingHorizontal: wp(4) },

  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: hp(1.2) },
  cardMonth:  { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  statusBadge:{ paddingHorizontal: wp(3), paddingVertical: hp(0.4), borderRadius: 20 },
  statusText: { fontSize: hp(1.35), fontFamily: Fonts.semiBold },

  cardRows: { gap: hp(0.7), marginBottom: hp(1.4) },
  feeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeLabel: { fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted },
  feeValue: { fontSize: hp(1.55), fontFamily: Fonts.semiBold, color: Colors.ink },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    paddingHorizontal: wp(3), paddingVertical: hp(0.6),
    borderRadius: 20, backgroundColor: Colors.primaryLight,
  },
  editBtnText: { fontSize: hp(1.45), fontFamily: Fonts.semiBold, color: Colors.primary },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1), paddingTop: hp(10) },
  emptyIcon:  { width: hp(10), height: hp(10), borderRadius: hp(5), backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', marginBottom: hp(0.4) },
  emptyTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  emptySub:   { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center', paddingHorizontal: wp(8) },
});
