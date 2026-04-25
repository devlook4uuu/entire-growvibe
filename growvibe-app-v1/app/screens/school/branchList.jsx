import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBranchList } from '../../../hooks/useBranchList';
import {
  StatusBadge, EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const DAY_LABELS = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <SkeletonLines widths={['45%', '65%', '35%']} />
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Branch Card ──────────────────────────────────────────────────────────────
function BranchCard({ item, onEdit }) {
  const fee     = Number(item.branch_subscription_fee ?? 0);
  const offDays = Array.isArray(item.off_days) ? item.off_days : [];

  return (
    <View style={S.card}>
      <View style={S.cardBody}>
        <Text style={S.cardName} numberOfLines={1}>{item.name || '—'}</Text>

        {!!item.branch_address && (
          <View style={S.metaRow}>
            <Ionicons name="location-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText} numberOfLines={1}>{item.branch_address}</Text>
          </View>
        )}

        {!!item.branch_contact && (
          <View style={S.metaRow}>
            <Ionicons name="call-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText} numberOfLines={1}>{item.branch_contact}</Text>
          </View>
        )}

        {fee > 0 && (
          <View style={S.metaRow}>
            <Ionicons name="cash-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText}>PKR {fee.toLocaleString('en-PK', { minimumFractionDigits: 0 })} / month</Text>
          </View>
        )}

        {offDays.length > 0 && (
          <View style={S.offDaysRow}>
            <Ionicons name="moon-outline" size={hp(1.4)} color={Colors.orange} />
            <View style={S.offDaysPills}>
              {offDays.map((d) => (
                <View key={d} style={S.offDayPill}>
                  <Text style={S.offDayPillText}>{DAY_LABELS[d] ?? d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <CardFooter
        left={<StatusBadge active={item.is_active} />}
        right={
          <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={hp(2.1)} color={Colors.primary} />
          </TouchableOpacity>
        }
      />
    </View>
  );
}

// ─── Branch List Screen ───────────────────────────────────────────────────────
export default function BranchListScreen() {
  const router = useRouter();
  const { schoolId, schoolName } = useLocalSearchParams();
  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } = useBranchList(schoolId);

  function handleEdit(branch) {
    router.push({ pathname: '/screens/school/branchForm', params: { schoolId, schoolName, branchId: branch.id } });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Branches" subtitle={schoolName} onAdd={() => router.push({ pathname: '/screens/school/branchForm', params: { schoolId, schoolName } })} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search branches…" />

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
          renderItem={({ item }) => <BranchCard item={item} onEdit={handleEdit} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="git-branch-outline"
              emptyTitle="No branches yet"
              emptySub="Branches you add will appear here."
              search={search}
              searchSub="Try a different branch name."
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
  cardBody: { gap: hp(0.35) },
  cardName: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2, marginBottom: hp(0.15) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },

  offDaysRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: hp(0.5) },
  offDaysPills: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  offDayPill: { backgroundColor: Colors.orangeLight, paddingHorizontal: wp(1.8), paddingVertical: hp(0.25), borderRadius: 20 },
  offDayPillText: { fontSize: hp(1.2), fontFamily: Fonts.semiBold, color: Colors.orange },

  editBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
});
