/**
 * chat.jsx  — Chat tab
 *
 * Shows all group chats the logged-in user is a member of.
 * Data: chat_members → chats (name, class_id, branch_id)
 * UI only for now: last message and unread count are static placeholders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { getSignedUrl } from '../../helpers/imageCache';
import { Colors } from '../../constant/colors';
import { Fonts } from '../../constant/fonts';
import { hp, wp } from '../../helpers/dimension';
import { SearchBar, EmptyState as SharedEmptyState, ErrorState } from '../../components/ListScreenComponents';
import { ScreenWrapper } from '../../helpers/screenWrapper';

const PAGE_SIZE = 20;
const CACHE_TTL = 30_000;

// ─── Last-message text helper ─────────────────────────────────────────────────
function formatLastMessage(msg) {
  if (!msg) return null;
  if (msg.is_deleted) return 'Message deleted';
  switch (msg.type) {
    case 'image':    return 'Image';
    case 'document': return msg.file_name || 'Document';
    case 'voice':    return 'Voice message';
    default:         return msg.content || '';
  }
}

// Icon name for last message type (shown in chat list row)
function lastMsgIcon(type) {
  if (type === 'image')    return 'image-outline';
  if (type === 'document') return 'document-outline';
  if (type === 'voice')    return 'mic-outline';
  return null;
}

// ─── Module-level cache ───────────────────────────────────────────────────────
const cache = {};
function cacheKey(uid, q) { return `${uid}|${q || '__all__'}`; }
function isFresh(key)      { const e = cache[key]; return !!(e && Date.now() - e.ts < CACHE_TTL); }

// ─── Avatar / initials ────────────────────────────────────────────────────────
function ChatAvatar({ name, imageUrl, size = hp(5.5) }) {
  const [resolvedUri, setResolvedUri] = useState(null);
  const [errored,     setErrored]     = useState(false);

  // imageUrl is a private storage path — needs signing
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    getSignedUrl('chat-images', imageUrl).then((url) => {
      if (!cancelled && url) setResolvedUri(url);
    });
    return () => { cancelled = true; };
  }, [imageUrl]);

  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (resolvedUri && !errored) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
        cachePolicy="disk"
        recyclingKey={resolvedUri}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <View style={[S.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[S.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <View style={S.rowWrap}>
      <View style={[S.avatarWrap, { width: hp(5.5), height: hp(5.5), borderRadius: hp(2.75), backgroundColor: Colors.borderLight }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
        <View style={{ height: 10, width: '75%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
      </View>
    </View>
  );
}

// ─── Chat row ─────────────────────────────────────────────────────────────────
function ChatRow({ item, onPress, isOwner }) {
  // Placeholder values — will be real data when messaging is built
  const lastMessage  = item.last_message  ?? 'No messages yet';
  const unreadCount  = item.unread_count  ?? 0;
  const lastTime     = item.last_msg_time ?? null;

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      style={S.rowWrap}
    >
      <ChatAvatar name={item.name} imageUrl={item.image_url} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={S.chatName} numberOfLines={1}>{item.name || 'Unnamed Chat'}</Text>
          {lastTime ? (
            <Text style={S.timeText}>{formatTime(lastTime)}</Text>
          ) : null}
        </View>
        {isOwner && item.branch_name ? (
          <Text style={S.branchName} numberOfLines={1}>{item.branch_name}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 8 }}>
            {!item.can_send_message && (
              <View style={S.readOnlyBadge}>
                <Ionicons name="eye-outline" size={hp(1.4)} color={Colors.muted} />
                <Text style={S.readOnlyText}>Read only</Text>
              </View>
            )}
            {lastMsgIcon(item.last_msg_type) && (
              <Ionicons
                name={lastMsgIcon(item.last_msg_type)}
                size={hp(1.7)}
                color={unreadCount > 0 ? Colors.ink : Colors.muted}
              />
            )}
            <Text style={[S.lastMsg, unreadCount > 0 && S.lastMsgBold]} numberOfLines={1}>
              {lastMessage}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={S.badge}>
              <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────
function Separator() {
  return <View style={{ height: 1, backgroundColor: Colors.borderLight, marginLeft: hp(5.5) + 12 }} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatTab() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth?.profile);
  const uid     = profile?.id;

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState(null);

  const searchRef  = useRef('');
  const pageRef    = useRef(0);
  const hasMoreRef = useRef(true);
  const isFetching = useRef(false);
  const fetchId    = useRef(0);
  const hasMounted = useRef(false);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async ({ page, query, mode }) => {
    if (!uid) return;
    if (mode === 'more' && (isFetching.current || !hasMoreRef.current)) return;

    isFetching.current = true;
    const myId = ++fetchId.current;

    const q = (query || '').trim().toLowerCase();
    const key = cacheKey(uid, q);

    if (mode === 'initial' || mode === 'search') setLoading(true);
    if (mode === 'more')    setLoadingMore(true);

    try {
      // Cache hit for page 0
      if (page === 0 && isFresh(key)) {
        const e = cache[key];
        if (myId !== fetchId.current) return;
        setItems(e.items);
        setHasMore(e.hasMore);
        hasMoreRef.current = e.hasMore;
        pageRef.current    = e.pages;
        setError(null);
        return;
      }

      const from = page * PAGE_SIZE;
      const to   = from + PAGE_SIZE - 1;

      // Query: chat_members → chats, include can_send_message for this user.
      // Note: .ilike() on a joined foreign table column is not supported by
      // Supabase PostgREST — we fetch all and filter client-side instead.
      const dbq = supabase
        .from('chat_members')
        .select('chat_id, can_send_message, chats(id, name, image_url, branch_id, class_id, created_at)')
        .eq('profile_id', uid)
        .range(from, to)
        .order('chat_id', { ascending: false });

      const { data, error: err } = await dbq;
      if (myId !== fetchId.current) return;
      if (err) { setError(err.message); return; }

      // Filter by search query client-side (PostgREST does not support
      // .ilike() filtering on embedded foreign table columns).
      const allRows  = (data || []).filter((m) => m.chats);
      const memberRows = q
        ? allRows.filter((m) => m.chats.name?.toLowerCase().includes(q))
        : allRows;
      const chatIds  = memberRows.map((m) => m.chat_id);
      const branchIds = [...new Set(memberRows.map((m) => m.chats.branch_id).filter(Boolean))];

      // Fetch last message, unread counts, and branch names in parallel
      const [lastMsgRes, unreadRes, branchRes] = await Promise.all([
        chatIds.length > 0
          ? supabase.rpc('get_last_messages_for_chats', { chat_ids: chatIds })
          : Promise.resolve({ data: [] }),
        chatIds.length > 0
          ? supabase.rpc('get_unread_counts_for_chats', { chat_ids: chatIds })
          : Promise.resolve({ data: [] }),
        branchIds.length > 0
          ? supabase.from('branches').select('id, name').in('id', branchIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (myId !== fetchId.current) return;

      // Build lookup maps
      const lastMsgMap = {};
      (lastMsgRes.data || []).forEach((m) => { lastMsgMap[m.chat_id] = m; });

      const unreadMap = {};
      (unreadRes.data || []).forEach((r) => { unreadMap[r.chat_id] = r.unread_count; });

      const branchMap = {};
      (branchRes.data || []).forEach((b) => { branchMap[b.id] = b.name; });

      // Flatten: attach branch_name, last_message, last_msg_time, can_send_message, unread_count
      const rows = memberRows.map((m) => {
        const c   = m.chats;
        const lm  = lastMsgMap[m.chat_id];
        return {
          ...c,
          branch_name:      branchMap[c.branch_id] ?? null,
          can_send_message: m.can_send_message,
          image_url:        c.image_url ?? null,
          last_message:     lm ? formatLastMessage(lm) : null,
          last_msg_time:    lm?.created_at ?? null,
          last_msg_type:    lm?.type ?? null,
          unread_count:     unreadMap[m.chat_id] ?? 0,
        };
      });

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
  }, [uid]);

  // ── Focus effect ───────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    const q = searchRef.current;
    const key = cacheKey(uid, q);
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (isFresh(key)) {
        const e = cache[key];
        setItems(e.items);
        setHasMore(e.hasMore);
        hasMoreRef.current = e.hasMore;
        pageRef.current    = e.pages;
      } else {
        fetchPage({ page: 0, query: q, mode: 'initial' });
      }
    } else {
      // Always re-fetch on return — unread counts may have changed
      delete cache[key];
      pageRef.current = 0;
      fetchPage({ page: 0, query: q, mode: 'refresh' });
    }
  }, [fetchPage, uid]));

  // ── Search ─────────────────────────────────────────────────────────────────
  const debounceRef = useRef(null);
  function handleSearch(text) {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchRef.current = text;
      pageRef.current   = 0;
      const key = cacheKey(uid, text.trim().toLowerCase());
      if (isFresh(key)) {
        const e = cache[key];
        setItems(e.items);
        setHasMore(e.hasMore);
        hasMoreRef.current = e.hasMore;
        pageRef.current    = e.pages;
      } else {
        fetchPage({ page: 0, query: text, mode: 'search' });
      }
    }, text === '' ? 0 : 400);
  }

  function loadMore() {
    if (!isFetching.current && hasMoreRef.current) {
      fetchPage({ page: pageRef.current + 1, query: searchRef.current, mode: 'more' });
    }
  }

  function refresh() {
    const key = cacheKey(uid, searchRef.current);
    delete cache[key];
    pageRef.current = 0;
    setRefreshing(true);
    fetchPage({ page: 0, query: searchRef.current, mode: 'refresh' });
  }

  function handleChatPress(item) {
    // Clear unread badge immediately (optimistic)
    setItems((prev) => prev.map((c) => c.id === item.id ? { ...c, unread_count: 0 } : c));
    // Persist last_read_at on the server
    supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', item.id)
      .eq('profile_id', uid)
      .then(() => {});
    router.push({
      pathname: '/screens/chat/chatRoom',
      params: {
        chatId:        item.id,
        chatName:      item.name,
        chatImageUrl:  item.image_url  ?? '',
        canSend:       item.can_send_message ? 'true' : 'false',
      },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{backgroundColor: Colors.white, flex: 1}}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>Chats</Text>
      </View>

      {/* Search bar */}
      <SearchBar value={search} onChangeText={handleSearch} placeholder="Search chats…" />

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, paddingHorizontal: wp(4), paddingTop: hp(1) }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i}>
              <SkeletonRow />
              {i < 7 && <Separator />}
            </View>
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatRow item={item} onPress={handleChatPress} isOwner={profile?.role === 'owner'} />}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingBottom: hp(2) }}
          ListEmptyComponent={
            <SharedEmptyState
              iconName="chatbubbles-outline"
              search={search}
              emptyTitle="No chats yet"
              emptySub="You haven't been added to any group chat."
              onClear={() => handleSearch('')}
            />
          }
          onRefresh={refresh}
          refreshing={refreshing}
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: wp(4),
    paddingTop: hp(1.5),
    paddingBottom: hp(1.2),
  },
  headerTitle: {
    fontSize: hp(3),
    fontFamily: Fonts.bold,
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
  },
  avatarWrap: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  chatName: {
    fontSize: hp(1.75),
    fontWeight: '600',
    color: Colors.ink,
    fontFamily: Fonts.semiBold,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: hp(1.4),
    color: Colors.muted,
    fontFamily: Fonts.regular,
    flexShrink: 0,
  },
  branchName: {
    fontSize: hp(1.35),
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginBottom: 1,
  },
  lastMsg: {
    fontSize: hp(1.6),
    color: Colors.muted,
    fontFamily: Fonts.regular,
    flex: 1,
    marginRight: 8,
  },
  lastMsgBold: {
    color: Colors.ink,
    fontFamily: Fonts.medium,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  readOnlyText: {
    fontSize: hp(1.25),
    fontFamily: Fonts.medium,
    color: Colors.muted,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: hp(2.4),
    height: hp(2.4),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: hp(1.35),
    fontWeight: '700',
    color: Colors.white,
    fontFamily: Fonts.bold,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: hp(1.8),
  },
  loadMoreText: {
    fontSize: hp(1.65),
    color: Colors.primary,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
  },
});
