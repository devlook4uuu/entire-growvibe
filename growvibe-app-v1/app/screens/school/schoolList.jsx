import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchoolList } from '../../../hooks/useSchoolList';
import Avatar from '../../../components/Avatar';
import {
  StatusBadge, EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <View style={S.skeletonLogo} />
        <SkeletonLines widths={['50%', '70%', '40%']} />
      </View>
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── School Card ──────────────────────────────────────────────────────────────
function SchoolCard({ item, onEdit, onBranches, onPayments }) {
  const fee         = Number(item.total_subscription_fee ?? 0);
  const branchCount = Number(item.active_branch_count ?? 0);
  const hasFee      = branchCount > 0 && fee > 0;

  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <Avatar url={item.logo_url} name={item.name || ''} size={hp(6)} />
        <View style={S.cardBody}>
          <Text style={S.cardName} numberOfLines={1}>{item.name || '—'}</Text>

          {item.owner_name ? (
            <View style={S.metaRow}>
              <Ionicons name="person-outline" size={hp(1.5)} color={Colors.muted} />
              <Text style={S.metaText} numberOfLines={1}>{item.owner_name}</Text>
            </View>
          ) : (
            <Text style={S.noOwner}>No owner assigned</Text>
          )}

          {!!item.school_address && (
            <View style={S.metaRow}>
              <Ionicons name="location-outline" size={hp(1.5)} color={Colors.muted} />
              <Text style={S.metaText} numberOfLines={1}>{item.school_address}</Text>
            </View>
          )}

          {!!item.school_contact && (
            <View style={S.metaRow}>
              <Ionicons name="call-outline" size={hp(1.5)} color={Colors.muted} />
              <Text style={S.metaText} numberOfLines={1}>{item.school_contact}</Text>
            </View>
          )}

          {branchCount > 0 && (
            <View style={S.pillRow}>
              <View style={S.branchPill}>
                <Ionicons name="git-branch-outline" size={hp(1.4)} color={Colors.primary} />
                <Text style={S.branchPillText}>{branchCount} {branchCount === 1 ? 'branch' : 'branches'}</Text>
              </View>
              {hasFee && (
                <View style={S.feePill}>
                  <Ionicons name="cash-outline" size={hp(1.4)} color={Colors.success} />
                  <Text style={S.feePillText}>PKR {fee.toLocaleString('en-PK', { minimumFractionDigits: 0 })}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <CardFooter
        left={<StatusBadge active={item.is_active} />}
        right={
          <>
            <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={hp(2.1)} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[S.footerBtn, S.footerBtnSecondary]} onPress={() => onBranches(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="git-branch-outline" size={hp(1.8)} color={Colors.soft} />
              <Text style={S.footerBtnLabel}>Branches</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.footerBtn, S.footerBtnPayment]} onPress={() => onPayments(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="receipt-outline" size={hp(1.8)} color={Colors.success} />
              <Text style={[S.footerBtnLabel, { color: Colors.success }]}>Payments</Text>
            </TouchableOpacity>
          </>
        }
      />
    </View>
  );
}

// ─── School List Screen ───────────────────────────────────────────────────────
export default function SchoolListScreen() {
  const router = useRouter();
  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } = useSchoolList();

  function handleEdit(school) {
    router.push({ pathname: '/screens/school/schoolForm', params: { schoolId: school.id } });
  }
  function handleBranches(school) {
    router.push({ pathname: '/screens/school/branchList', params: { schoolId: school.id, schoolName: school.name } });
  }
  function handlePayments(school) {
    router.push({ pathname: '/screens/school/paymentList', params: { schoolId: school.id, schoolName: school.name } });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Schools" onAdd={() => router.push('/screens/school/schoolForm')} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by school name or owner…" />

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SchoolCard item={item} onEdit={handleEdit} onBranches={handleBranches} onPayments={handlePayments} />
          )}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="business-outline"
              emptyTitle="No schools yet"
              emptySub="Schools you add will appear here."
              search={search}
              searchSub="Try a different school name or owner."
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: wp(3) },
  cardBody: { flex: 1, gap: hp(0.35) },
  cardName: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2, marginBottom: hp(0.1) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },
  noOwner: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, fontStyle: 'italic' },

  pillRow: { flexDirection: 'row', gap: 6, marginTop: hp(0.5), flexWrap: 'wrap' },
  branchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primaryLight, paddingHorizontal: wp(2), paddingVertical: hp(0.3), borderRadius: 20,
  },
  branchPillText: { fontSize: hp(1.25), fontFamily: Fonts.semiBold, color: Colors.primary },
  feePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.successLight, paddingHorizontal: wp(2), paddingVertical: hp(0.3), borderRadius: 20,
  },
  feePillText: { fontSize: hp(1.25), fontFamily: Fonts.semiBold, color: Colors.success },

  editBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  footerBtn: { height: hp(3.8), borderRadius: 10, paddingHorizontal: wp(2.5), flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerBtnSecondary: { backgroundColor: Colors.canvas },
  footerBtnPayment: { backgroundColor: Colors.successLight },
  footerBtnLabel: { fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.soft },

  skeletonLogo: { width: hp(6), height: hp(6), borderRadius: hp(3), backgroundColor: Colors.borderLight, flexShrink: 0 },
});
