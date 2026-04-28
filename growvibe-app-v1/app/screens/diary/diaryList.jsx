/**
 * diaryList.jsx — Active diary entries for a student's class
 *
 * Route params: none (uses profile.class_id)
 *
 * Shows all active (non-expired) diary entries for the student's class.
 * Each card shows: title, description, subject list, expire date.
 * Pull-to-refresh + pagination.
 */

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const PAGE_SIZE = 20;
const CACHE_TTL = 30_000;

// ─── Module-level cache ───────────────────────────────────────────────────────
const cache = {};
function cacheKey(classId) { return classId || '__none__'; }
function isFresh(key) { const e = cache[key]; return !!(e && Date.now() - e.ts < CACHE_TTL); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtExpire(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <View style={{ height: 14, width: '60%', borderRadius: 7, backgroundColor: Colors.borderLight, marginBottom: 8 }} />
      <View style={{ height: 11, width: '80%', borderRadius: 6, backgroundColor: Colors.borderLight, marginBottom: 12 }} />
      <View style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: Colors.borderLight }} />
    </View>
  );
}

// ─── Diary Card ───────────────────────────────────────────────────────────────
function DiaryCard({ item, onPress }) {
  const subjects = item.subjects || [];
  return (
    <TouchableOpacity style={S.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      {/* Header */}
      <View style={S.cardHeader}>
        <View style={S.cardIconWrap}>
          <Ionicons name="book-outline" size={hp(2.2)} color={Colors.purple} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={S.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={hp(2)} color={Colors.muted} />
      </View>

      {/* Subject chips */}
      {subjects.length > 0 && (
        <View style={S.subjectRow}>
          {subjects.slice(0, 3).map((s, i) => (
            <View key={i} style={S.subjectChip}>
              <Text style={S.subjectChipText} numberOfLines={1}>{s.subject_name}</Text>
            </View>
          ))}
          {subjects.length > 3 && (
            <View style={[S.subjectChip, { backgroundColor: Colors.canvas }]}>
              <Text style={[S.subjectChipText, { color: Colors.muted }]}>+{subjects.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={S.cardFooter}>
        <Ionicons name="time-outline" size={hp(1.6)} color={Colors.muted} />
        <Text style={S.cardExpire}>Expires {fmtExpire(item.expire_date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiaryList() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);
  const classId = profile?.class_id;

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  const pageRef    = useRef(0);
  const hasMoreRef = useRef(true);
  const isFetching = useRef(false);
  const fetchId    = useRef(0);
  const hasMounted = useRef(false);

  const fetchPage = useCallback(async ({ page, mode }) => {
    if (!classId) return;
    if (mode === 'more' && (isFetching.current || !hasMoreRef.current)) return;

    isFetching.current = true;
    const myId = ++fetchId.current;
    const key  = cacheKey(classId);

    if (mode === 'initial' || mode === 'search') setLoading(true);
    if (mode === 'more')    setLoadingMore(true);

    try {
      if (page === 0 && isFresh(key)) {
        if (myId !== fetchId.current) return;
        const e = cache[key];
        setItems(e.items);
        setHasMore(e.hasMore);
        hasMoreRef.current = e.hasMore;
        pageRef.current    = e.pages;
        setError(null);
        return;
      }

      const from = page * PAGE_SIZE;
      const to   = from + PAGE_SIZE - 1;
      const today = new Date().toISOString().split('T')[0];

      const { data, error: err } = await supabase
        .from('class_diary')
        .select('id, title, description, subjects, expire_date, created_at, created_by')
        .eq('class_id', classId)
        .eq('is_expired', false)
        .gte('expire_date', today)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (myId !== fetchId.current) return;
      if (err) { setError(err.message); return; }

      const rows = data || [];
      const more = rows.length === PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);

      if (page === 0) {
        setItems(rows);
        cache[key] = { items: rows, hasMore: more, pages: 0, ts: Date.now() };
      } else {
        setItems((prev) => {
          const merged = [...prev, ...rows];
          cache[key] = { items: merged, hasMore: more, pages: page, ts: Date.now() };
          return merged;
        });
      }
      pageRef.current = page;
      setError(null);
    } finally {
      isFetching.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [classId]);

  useFocusEffect(useCallback(() => {
    const key = cacheKey(classId);
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (isFresh(key)) {
        const e = cache[key];
        setItems(e.items);
        setHasMore(e.hasMore);
        hasMoreRef.current = e.hasMore;
        pageRef.current    = e.pages;
      } else {
        fetchPage({ page: 0, mode: 'initial' });
      }
    } else {
      delete cache[key];
      pageRef.current = 0;
      fetchPage({ page: 0, mode: 'refresh' });
    }
  }, [fetchPage, classId]));

  function loadMore() {
    if (!isFetching.current && hasMoreRef.current) {
      fetchPage({ page: pageRef.current + 1, mode: 'more' });
    }
  }

  function refresh() {
    const key = cacheKey(classId);
    delete cache[key];
    pageRef.current = 0;
    setRefreshing(true);
    fetchPage({ page: 0, mode: 'refresh' });
  }

  function handlePress(item) {
    router.push({
      pathname: '/screens/diary/diaryDetail',
      params: { diaryId: item.id },
    });
  }

  if (!classId) {
    return (
      <ScreenWrapper>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
            <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Class Diary</Text>
        </View>
        <View style={S.center}>
          <View style={S.emptyIconWrap}>
            <Ionicons name="book-outline" size={hp(3.5)} color={Colors.purple} />
          </View>
          <Text style={S.emptyTitle}>No class assigned</Text>
          <Text style={S.emptySub}>You haven't been assigned to a class yet. Contact your school for help.</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Class Diary</Text>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: wp(4), paddingTop: hp(1), gap: hp(1.5) }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={hp(5)} color={Colors.danger} />
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={S.retryBtn}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DiaryCard item={item} onPress={handlePress} />}
          contentContainerStyle={[
            { paddingHorizontal: wp(4), paddingTop: hp(1), paddingBottom: hp(4) },
            items.length === 0 && { flex: 1 },
          ]}
          onRefresh={refresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <View style={S.emptyIconWrap}>
                <Ionicons name="book-outline" size={hp(3.5)} color={Colors.purple} />
              </View>
              <Text style={S.emptyTitle}>No diary entries</Text>
              <Text style={S.emptySub}>Your teacher hasn't posted any diary entries yet.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity onPress={loadMore} style={S.loadMoreBtn} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={S.loadMoreText}>Load more</Text>
                }
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingVertical: hp(1.6),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: hp(2.2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.5), paddingHorizontal: wp(8) },
  errorText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.danger, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: wp(6), paddingVertical: hp(1.2), borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  retryText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.primary },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16, borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: wp(4), marginBottom: hp(1.4),
    gap: hp(1.2),
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: wp(3) },
  cardIconWrap: {
    width: hp(4.4), height: hp(4.4), borderRadius: 12,
    backgroundColor: Colors.purpleLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTitle:   { fontSize: hp(1.75), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  cardDesc:    { fontSize: hp(1.45), fontFamily: Fonts.regular, color: Colors.soft, marginTop: 2 },

  subjectRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subjectChip: {
    paddingHorizontal: wp(2.5), paddingVertical: hp(0.5),
    borderRadius: 20, backgroundColor: Colors.purpleLight,
  },
  subjectChipText: { fontSize: hp(1.35), fontFamily: Fonts.medium, color: Colors.purple },

  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardExpire:  { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },

  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: hp(8), gap: hp(1.5) },
  emptyIconWrap: {
    width: hp(8), height: hp(8), borderRadius: hp(4),
    backgroundColor: Colors.purpleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:  { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink },
  emptySub:    { fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center', paddingHorizontal: wp(8) },

  loadMoreBtn: { alignItems: 'center', paddingVertical: hp(1.8) },
  loadMoreText: { fontSize: hp(1.65), fontFamily: Fonts.semiBold, color: Colors.primary },
});
