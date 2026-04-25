import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOwnerList } from '../../../hooks/useOwnerList';
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
        <View style={S.skeletonAvatar} />
        <SkeletonLines widths={['50%', '70%', '38%']} />
      </View>
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Owner Card ───────────────────────────────────────────────────────────────
function OwnerCard({ item, onEdit }) {
  const joinDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <Avatar url={item.avatar_url} name={item.name || ''} size={hp(6)} />
        <View style={S.cardBody}>
          <Text style={S.cardName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={S.cardEmail} numberOfLines={1}>{item.email || '—'}</Text>
          <View style={S.cardMeta}>
            {item.school_name ? (
              <View style={S.metaRow}>
                <Ionicons name="business-outline" size={hp(1.5)} color={Colors.muted} />
                <Text style={S.metaText} numberOfLines={1}>{item.school_name}</Text>
              </View>
            ) : (
              <Text style={S.noSchool}>No school assigned</Text>
            )}
            {joinDate && (
              <View style={S.metaRow}>
                <Ionicons name="calendar-outline" size={hp(1.5)} color={Colors.muted} />
                <Text style={S.metaText}>Joined {joinDate}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <CardFooter
        left={<StatusBadge active={item.is_active} />}
        right={
          <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={hp(2.2)} color={Colors.primary} />
          </TouchableOpacity>
        }
      />
    </View>
  );
}

// ─── Owner List Screen ────────────────────────────────────────────────────────
export default function OwnerListScreen() {
  const router = useRouter();
  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } = useOwnerList();

  function handleEdit(owner) {
    router.push({ pathname: '/screens/owner/ownerForm', params: { ownerId: owner.id } });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Owners" onAdd={() => router.push('/screens/owner/ownerForm')} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or email…" />

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
          renderItem={({ item }) => <OwnerCard item={item} onEdit={handleEdit} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="people-outline"
              emptyTitle="No owners yet"
              emptySub="Owners you add will appear here."
              search={search}
              searchSub="Try a different name or email address."
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  cardBody: { flex: 1, gap: hp(0.3) },
  cardName: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  cardEmail: { fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted },
  cardMeta: { marginTop: hp(0.5), gap: hp(0.3) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },
  noSchool: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, fontStyle: 'italic' },

  editBtn: {
    width: hp(4), height: hp(4), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  skeletonAvatar: {
    width: hp(6), height: hp(6), borderRadius: hp(3),
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },
});
