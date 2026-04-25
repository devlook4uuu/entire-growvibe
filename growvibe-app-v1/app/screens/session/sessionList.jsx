import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionList } from '../../../hooks/useSessionList';
import {
  EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <SkeletonLines widths={['50%', '70%', '40%']} />
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ item, onEdit }) {
  return (
    <View style={S.card}>
      <View style={S.cardBody}>
        <View style={S.nameRow}>
          {item.is_active && <View style={S.activeDot} />}
          <Text style={S.cardName} numberOfLines={1}>{item.session_name || '—'}</Text>
        </View>

        <View style={S.metaRow}>
          <Ionicons name="calendar-outline" size={hp(1.5)} color={Colors.muted} />
          <Text style={S.metaText}>
            {formatDate(item.session_start)} — {formatDate(item.session_end)}
          </Text>
        </View>
      </View>

      <CardFooter
        left={
          <View style={[S.statusBadge, item.is_active ? S.statusActive : S.statusInactive]}>
            <Text style={[S.statusText, item.is_active ? S.statusTextActive : S.statusTextInactive]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        }
        right={
          <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={hp(2.1)} color={Colors.primary} />
          </TouchableOpacity>
        }
      />
    </View>
  );
}

// ─── Session List Screen ──────────────────────────────────────────────────────
export default function SessionListScreen() {
  const router = useRouter();
  const { branchId, schoolId, branchName } = useLocalSearchParams();

  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } =
    useSessionList(branchId);

  function handleEdit(session) {
    router.push({
      pathname: '/screens/session/sessionForm',
      params: { branchId, schoolId, branchName, sessionId: session.id },
    });
  }

  function handleAdd() {
    router.push({
      pathname: '/screens/session/sessionForm',
      params: { branchId, schoolId, branchName },
    });
  }

return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Sessions" subtitle={branchName} onAdd={handleAdd} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search sessions…" />

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SessionCard item={item} onEdit={handleEdit} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="calendar-outline"
              emptyTitle="No sessions yet"
              emptySub="Create a session to get started."
              search={search}
              searchSub="Try a different session name."
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
  cardBody: { gap: hp(0.4) },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: Colors.success, flexShrink: 0,
  },
  cardName: {
    fontSize: hp(1.85), fontFamily: Fonts.semiBold,
    color: Colors.ink, letterSpacing: -0.2, flex: 1,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },

  statusBadge: {
    paddingHorizontal: wp(2.5), paddingVertical: hp(0.3),
    borderRadius: 20, borderWidth: 1,
  },
  statusActive: { backgroundColor: Colors.successLight, borderColor: Colors.success + '40' },
  statusInactive: { backgroundColor: Colors.borderLight, borderColor: Colors.border },
  statusText: { fontSize: hp(1.3), fontFamily: Fonts.semiBold },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.muted },

  editBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
});
