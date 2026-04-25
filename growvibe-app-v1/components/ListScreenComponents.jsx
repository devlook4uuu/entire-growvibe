/**
 * ListScreenComponents.jsx
 * Shared UI building blocks reused across all list screens.
 *
 * Exports:
 *   StatusBadge         — active/inactive pill
 *   EmptyState          — empty list or empty search result
 *   ErrorState          — fetch error + retry button
 *   ListScreenHeader    — back button + title + optional subtitle + add button
 *   SearchBar           — search input with icon + clear button
 *   LoadMoreFooter      — "Load More" button / spinner
 *   CardFooter          — bottom row: left slot + right slot (badge + actions)
 *   SkeletonLines       — placeholder lines inside a skeleton card
 */

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ active }) {
  return (
    <View style={[S.badge, { backgroundColor: active ? Colors.successLight : Colors.dangerLight }]}>
      <View style={[S.badgeDot, { backgroundColor: active ? Colors.success : Colors.danger }]} />
      <Text style={[S.badgeText, { color: active ? Colors.success : Colors.danger }]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ iconName = 'file-tray-outline', emptyTitle, emptySub, search, searchSub, onClear }) {
  return (
    <View style={S.emptyWrap}>
      <View style={S.emptyIconCircle}>
        <Ionicons name={iconName} size={hp(4.5)} color={Colors.muted} />
      </View>
      {search ? (
        <>
          <Text style={S.emptyTitle}>No results for "{search}"</Text>
          <Text style={S.emptySub}>{searchSub || 'Try a different search term.'}</Text>
          <TouchableOpacity style={S.clearBtn} onPress={onClear} activeOpacity={0.8}>
            <Text style={S.clearBtnText}>Clear Search</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={S.emptyTitle}>{emptyTitle}</Text>
          <Text style={S.emptySub}>{emptySub}</Text>
        </>
      )}
    </View>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  return (
    <View style={S.emptyWrap}>
      <View style={[S.emptyIconCircle, { backgroundColor: Colors.dangerLight }]}>
        <Ionicons name="alert-circle-outline" size={hp(4.5)} color={Colors.danger} />
      </View>
      <Text style={S.emptyTitle}>Something went wrong</Text>
      <Text style={S.emptySub}>{message}</Text>
      <TouchableOpacity
        style={[S.clearBtn, { backgroundColor: Colors.danger, borderColor: Colors.danger }]}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text style={[S.clearBtnText, { color: Colors.white }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────
export function ListScreenHeader({ router, title, subtitle, onAdd }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.iconBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <View style={S.headerCenter}>
        <Text style={S.headerTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={S.headerSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={onAdd} style={S.addBtn} hitSlop={8} activeOpacity={0.8}>
        <Ionicons name="add" size={hp(2.4)} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
export function SearchBar({ value, onChangeText, placeholder = 'Search…' }) {
  return (
    <View style={S.searchWrap}>
      <Ionicons name="search-outline" size={hp(2)} color={Colors.muted} />
      <TextInput
        style={S.searchInput}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={hp(2.2)} color={Colors.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Load More Footer ─────────────────────────────────────────────────────────
export function LoadMoreFooter({ hasMore, loadingMore, onLoadMore }) {
  if (!hasMore) return null;
  return (
    <TouchableOpacity
      style={S.loadMoreBtn}
      onPress={onLoadMore}
      disabled={loadingMore}
      activeOpacity={0.8}
    >
      {loadingMore
        ? <ActivityIndicator size="small" color={Colors.primary} />
        : <Text style={S.loadMoreText}>Load More</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Card Footer ──────────────────────────────────────────────────────────────
// Renders the bottom row of a card: left slot (e.g. status badge) + right slot (buttons).
export function CardFooter({ left, right }) {
  return (
    <View style={S.cardFooter}>
      <View>{left}</View>
      <View style={S.footerRight}>{right}</View>
    </View>
  );
}

// ─── Skeleton Lines ───────────────────────────────────────────────────────────
// Renders a set of placeholder shimmer lines. widths = array of % strings or numbers.
export function SkeletonLines({ widths = ['50%', '70%', '40%'] }) {
  return (
    <View style={{ gap: hp(0.7) }}>
      {widths.map((w, i) => (
        <View key={i} style={[S.skeletonLine, { width: w }]} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Status badge
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(2), paddingVertical: hp(0.4), borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: hp(1.25), fontFamily: Fonts.semiBold, letterSpacing: 0.2 },

  // Empty / Error
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: hp(8), gap: hp(1),
  },
  emptyIconCircle: {
    width: hp(11), height: hp(11), borderRadius: hp(5.5),
    backgroundColor: Colors.hover, alignItems: 'center', justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  emptyTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  emptySub: {
    fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted,
    textAlign: 'center', paddingHorizontal: wp(10), lineHeight: hp(2.3),
  },
  clearBtn: {
    marginTop: hp(0.8), paddingHorizontal: wp(7), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.primaryLight,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  clearBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.primary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1.6),
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  iconBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },
  addBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: wp(4), marginTop: hp(1.8), marginBottom: hp(1.2),
    paddingHorizontal: wp(3.5), height: hp(5.6),
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, gap: 8,
  },
  searchInput: {
    flex: 1, fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, paddingVertical: 0,
  },

  // Load more
  loadMoreBtn: {
    marginHorizontal: wp(4), marginTop: hp(0.8), marginBottom: hp(2),
    height: hp(5.5), borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  loadMoreText: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.primary },

  // Card footer
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: hp(1.2), paddingTop: hp(1),
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  footerRight: { flexDirection: 'row', gap: 6 },

  // Skeleton
  skeletonLine: { height: hp(1.4), borderRadius: 6, backgroundColor: Colors.borderLight },
});
