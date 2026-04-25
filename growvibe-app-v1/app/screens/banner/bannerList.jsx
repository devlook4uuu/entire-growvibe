/**
 * bannerList.jsx — Admin banner management list screen
 *
 * Admin-only screen to view, add, and edit promotional banners.
 */

import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useBannerList } from '../../../hooks/useBannerList';
import { getBannerImageUrl } from '../../../hooks/useBanners';
import {
  EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const TYPE_LABELS = {
  image_only:     'Image only',
  image_text:     'Image + text',
  image_text_cta: 'Image + text + CTA',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <View style={S.cardRow}>
        <View style={S.skeletonThumb} />
        <View style={{ flex: 1 }}>
          <SkeletonLines widths={['60%', '45%', '30%']} />
        </View>
      </View>
    </View>
  );
}

// ─── Banner Card ───────────────────────────────────────────────────────────────
function BannerCard({ item, onEdit }) {
  const imgUrl  = getBannerImageUrl(item.bg_image_path);
  const isActive = item.is_active;

  let scopeLabel = 'Global';
  if (item.branch_id)      scopeLabel = 'Branch';
  else if (item.school_id) scopeLabel = 'School';

  const startFmt = item.start_date
    ? new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const endFmt = item.end_date
    ? new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={S.card}>
      <View style={S.cardRow}>
        {/* Thumbnail */}
        <View style={S.thumb}>
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={S.thumbImg} contentFit="cover" cachePolicy="memory" />
          ) : (
            <View style={[S.thumbImg, S.thumbPlaceholder]}>
              <Ionicons name="image-outline" size={hp(2.2)} color={Colors.border} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={S.cardBody}>
          <Text style={S.cardTitle} numberOfLines={1}>{item.title || '(no title)'}</Text>
          <Text style={S.cardType}>{TYPE_LABELS[item.banner_type] || item.banner_type}</Text>

          <View style={S.metaRow}>
            <View style={[S.badge, { backgroundColor: scopeLabel === 'Global' ? Colors.primaryLight : Colors.purpleLight }]}>
              <Text style={[S.badgeText, { color: scopeLabel === 'Global' ? Colors.primary : Colors.purple }]}>{scopeLabel}</Text>
            </View>
            <View style={[S.badge, { backgroundColor: isActive ? Colors.successLight : Colors.borderLight }]}>
              <Text style={[S.badgeText, { color: isActive ? Colors.success : Colors.muted }]}>{isActive ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>

          {(startFmt || endFmt) && (
            <View style={S.dateRow}>
              <Ionicons name="calendar-outline" size={hp(1.5)} color={Colors.muted} />
              <Text style={S.dateText}>
                {startFmt || '—'}{endFmt ? ` → ${endFmt}` : ' → no end'}
              </Text>
            </View>
          )}
        </View>

        {/* Edit button */}
        <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={hp(2.2)} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Banner List Screen ───────────────────────────────────────────────────────
export default function BannerListScreen() {
  const router = useRouter();
  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } = useBannerList();

  function handleEdit(banner) {
    router.push({ pathname: '/screens/banner/bannerForm', params: { bannerId: banner.id } });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader router={router} title="Banners" onAdd={() => router.push('/screens/banner/bannerForm')} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by title…" />

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
          renderItem={({ item }) => <BannerCard item={item} onEdit={handleEdit} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="megaphone-outline"
              emptyTitle="No banners yet"
              emptySub="Banners you create will appear here."
              search={search}
              searchSub="Try a different title."
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
  listPad:       { paddingHorizontal: wp(4), paddingBottom: hp(4), gap: hp(1.2) },
  emptyContainer: { flexGrow: 1, paddingHorizontal: wp(4) },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  cardBody: { flex: 1, gap: hp(0.4) },

  thumb: {
    width: hp(8), height: hp(6), borderRadius: 10, overflow: 'hidden',
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  skeletonThumb: {
    width: hp(8), height: hp(6), borderRadius: 10,
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },

  cardTitle: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  cardType:  { fontSize: hp(1.45), fontFamily: Fonts.regular,  color: Colors.muted },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: hp(0.3) },
  badge: { borderRadius: 20, paddingHorizontal: wp(2), paddingVertical: 2 },
  badgeText: { fontSize: hp(1.3), fontFamily: Fonts.medium },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: hp(0.2) },
  dateText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },

  editBtn: {
    width: hp(4), height: hp(4), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});
