import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentList } from '../../../hooks/usePaymentList';
import { PAYMENT_STATUSES } from '../../../hooks/usePaymentForm';
import {
  EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const METHOD_LABELS = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', online: 'Online',
};

function statusStyle(status) {
  return PAYMENT_STATUSES.find((s) => s.key === status) || { color: Colors.muted, bg: Colors.canvas, label: status };
}

function fmtPKR(n) {
  return 'PKR ' + Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });
}

// ─── Status Badge (payment-specific) ─────────────────────────────────────────
function PaymentStatusBadge({ status }) {
  const st = statusStyle(status);
  return (
    <View style={[S.statusBadge, { backgroundColor: st.bg }]}>
      <View style={[S.statusDot, { backgroundColor: st.color }]} />
      <Text style={[S.statusText, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <SkeletonLines widths={['40%', '60%', '50%']} />
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Payment Card ─────────────────────────────────────────────────────────────
function PaymentCard({ item, onEdit }) {
  const fee  = Number(item.fee ?? 0);
  const paid = Number(item.amount_paid ?? 0);
  const due  = Number(item.remaining_due ?? 0);

  return (
    <View style={S.card}>
      <View style={S.cardBody}>
        <Text style={S.cardMonth} numberOfLines={1}>{item.payment_month || '—'}</Text>

        <View style={S.amountsRow}>
          <View style={S.amountItem}>
            <Text style={S.amountLabel}>Fee</Text>
            <Text style={S.amountValue}>{fmtPKR(fee)}</Text>
          </View>
          <View style={S.amountDivider} />
          <View style={S.amountItem}>
            <Text style={S.amountLabel}>Paid</Text>
            <Text style={[S.amountValue, { color: Colors.success }]}>{fmtPKR(paid)}</Text>
          </View>
          {due > 0 && (
            <>
              <View style={S.amountDivider} />
              <View style={S.amountItem}>
                <Text style={S.amountLabel}>Due</Text>
                <Text style={[S.amountValue, { color: Colors.danger }]}>{fmtPKR(due)}</Text>
              </View>
            </>
          )}
        </View>

        {item.payment_method && (
          <View style={S.metaRow}>
            <Ionicons name="card-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText}>{METHOD_LABELS[item.payment_method] ?? item.payment_method}</Text>
          </View>
        )}

        {!!item.payment_description && (
          <View style={S.metaRow}>
            <Ionicons name="document-text-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText} numberOfLines={2}>{item.payment_description}</Text>
          </View>
        )}
      </View>

      <CardFooter
        left={<PaymentStatusBadge status={item.payment_status} />}
        right={
          <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={hp(2.1)} color={Colors.primary} />
          </TouchableOpacity>
        }
      />
    </View>
  );
}

// ─── Payment List Screen ──────────────────────────────────────────────────────
export default function PaymentListScreen() {
  const router = useRouter();
  const { schoolId, schoolName } = useLocalSearchParams();
  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } = usePaymentList(schoolId);

  function handleEdit(payment) {
    router.push({ pathname: '/screens/school/paymentForm', params: { schoolId, schoolName, paymentId: payment.id } });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Payments" subtitle={schoolName} onAdd={() => router.push({ pathname: '/screens/school/paymentForm', params: { schoolId, schoolName } })} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by month…" />

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PaymentCard item={item} onEdit={handleEdit} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="receipt-outline"
              emptyTitle="No payments yet"
              emptySub="Payments you record will appear here."
              search={search}
              searchSub="Try a different month name."
              onClear={() => setSearch('')}
            />
          }
          onRefresh={refresh}
          refreshing={refreshing}
          contentContainerStyle={items.length === 0 ? S.emptyContainer : S.listPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  listPad: { paddingHorizontal: wp(4), paddingBottom: hp(4), gap: hp(1.2) },
  emptyContainer: { flexGrow: 1, paddingHorizontal: wp(4) },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardBody: { gap: hp(0.5) },
  cardMonth: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2, marginBottom: hp(0.2) },

  amountsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.canvas, borderRadius: 10,
    paddingVertical: hp(0.9), paddingHorizontal: wp(3),
    gap: wp(3), marginVertical: hp(0.3),
  },
  amountItem: { alignItems: 'center', gap: 2 },
  amountLabel: { fontSize: hp(1.15), fontFamily: Fonts.regular, color: Colors.muted },
  amountValue: { fontSize: hp(1.5), fontFamily: Fonts.semiBold, color: Colors.ink },
  amountDivider: { width: 1, height: hp(2.5), backgroundColor: Colors.border },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(2), paddingVertical: hp(0.4), borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: hp(1.25), fontFamily: Fonts.semiBold, letterSpacing: 0.2 },

  editBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
});
