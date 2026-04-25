/**
 * chatInfo.jsx — Group info screen
 *
 * Route params: chatId, chatName
 *
 * Shows:
 *  - Group name + member count
 *  - All members with avatar, name, role badge, can_send_message indicator
 *  - Created-at date
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { CachedAvatar } from '../../../helpers/imageCache';

// ─── Module-level cache (30 s TTL) ───────────────────────────────────────────
const cache = {};
const CACHE_TTL = 30_000;
function isFresh(chatId) {
  const e = cache[chatId];
  return !!(e && Date.now() - e.ts < CACHE_TTL);
}

// ─── Role badge colours ───────────────────────────────────────────────────────
const ROLE_COLORS = {
  owner:       { bg: Colors.purpleLight,  text: Colors.purple },
  admin:       { bg: Colors.dangerLight,  text: Colors.danger },
  principal:   { bg: Colors.primaryLight, text: Colors.primary },
  coordinator: { bg: Colors.primaryLight, text: Colors.primary },
  teacher:     { bg: Colors.successLight, text: Colors.success },
  student:     { bg: Colors.orangeLight,  text: Colors.orange },
};
function roleColor(role) {
  return ROLE_COLORS[role] ?? { bg: Colors.borderLight, text: Colors.muted };
}
function roleLabel(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ─── MemberRow ────────────────────────────────────────────────────────────────
function MemberRow({ member }) {
  const rc = roleColor(member.role);
  return (
    <View style={S.memberRow}>
      <CachedAvatar
        name={member.name}
        avatarUrl={member.avatar_url}
        size={hp(5)}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={S.memberName} numberOfLines={1}>{member.name || 'Unknown'}</Text>
          {member.role ? (
            <View style={[S.roleBadge, { backgroundColor: rc.bg }]}>
              <Text style={[S.roleText, { color: rc.text }]}>{roleLabel(member.role)}</Text>
            </View>
          ) : null}
        </View>
        {!member.can_send_message ? (
          <Text style={S.noSendLabel}>View only</Text>
        ) : null}
      </View>
      {member.can_send_message ? (
        <Ionicons name="chatbubble-ellipses-outline" size={hp(2.2)} color={Colors.primary} />
      ) : (
        <Ionicons name="eye-outline" size={hp(2.2)} color={Colors.muted} />
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <View style={[S.memberRow, { gap: 12 }]}>
      <View style={{ width: hp(5), height: hp(5), borderRadius: hp(2.5), backgroundColor: Colors.borderLight }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, width: '45%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
        <View style={{ height: 10, width: '25%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
      </View>
    </View>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────
function Separator() {
  return <View style={{ height: 1, backgroundColor: Colors.borderLight, marginLeft: hp(5) + 24 }} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatInfo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chatId, chatName } = useLocalSearchParams();

  const [members,     setMembers]     = useState([]);
  const [chatDetails, setChatDetails] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  const hasFetched = useRef(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function load(force = false) {
    if (!chatId) return;
    if (!force && isFresh(chatId)) {
      const e = cache[chatId];
      setMembers(e.members);
      setChatDetails(e.chatDetails);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch chat details + all members with profile info in parallel
      const [chatRes, membersRes] = await Promise.all([
        supabase
          .from('chats')
          .select('id, name, created_at')
          .eq('id', chatId)
          .single(),
        supabase
          .from('chat_members')
          .select('profile_id, can_send_message, joined_at, profiles(id, name, avatar_url, role)')
          .eq('chat_id', chatId)
          .order('joined_at', { ascending: true }),
      ]);

      if (chatRes.error)    throw chatRes.error;
      if (membersRes.error) throw membersRes.error;

      const flatMembers = (membersRes.data || []).map((m) => ({
        id:              m.profile_id,
        can_send_message: m.can_send_message,
        joined_at:       m.joined_at,
        name:            m.profiles?.name ?? null,
        avatar_url:      m.profiles?.avatar_url ?? null,
        role:            m.profiles?.role ?? null,
      }));

      const details = chatRes.data;

      setMembers(flatMembers);
      setChatDetails(details);
      cache[chatId] = { members: flatMembers, chatDetails: details, ts: Date.now() };
    } catch (err) {
      setError(err?.message ?? 'Failed to load group info');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [chatId]);

  // ── Header ────────────────────────────────────────────────────────────────
  function Header() {
    return (
      <View style={[S.topBar, { paddingTop: insets.top + hp(1) }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="chevron-back" size={hp(2.8)} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={S.topTitle} numberOfLines={1}>Group Info</Text>
        <View style={{ width: hp(4) }} />
      </View>
    );
  }

  // ── Group hero card ───────────────────────────────────────────────────────
  function GroupCard() {
    const name = chatDetails?.name ?? chatName ?? 'Group Chat';
    const created = chatDetails?.created_at
      ? new Date(chatDetails.created_at).toLocaleDateString([], {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : null;

    return (
      <View style={S.groupCard}>
        {/* Large avatar */}
        <View style={S.groupAvatarWrap}>
          <Text style={S.groupAvatarText}>
            {name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <Text style={S.groupName}>{name}</Text>

        <View style={S.groupMeta}>
          <Ionicons name="people-outline" size={hp(1.9)} color={Colors.muted} />
          <Text style={S.groupMetaText}>
            {loading ? '…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {created ? (
          <View style={S.groupMeta}>
            <Ionicons name="calendar-outline" size={hp(1.9)} color={Colors.muted} />
            <Text style={S.groupMetaText}>Created {created}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.white }}>
        <Header />
        <GroupCard />
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>Members</Text>
        </View>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i}>
            <SkeletonRow />
            {i < 7 && <Separator />}
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.white }}>
        <Header />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: wp(6) }}>
          <View style={{ width: hp(7), height: hp(7), borderRadius: hp(3.5), backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="alert-circle-outline" size={hp(3.5)} color={Colors.danger} />
          </View>
          <Text style={{ fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, textAlign: 'center' }}>
            Failed to load
          </Text>
          <Text style={{ fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center' }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => load(true)} style={S.retryBtn}>
            <Text style={S.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <Header />
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MemberRow member={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <>
            <GroupCard />
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>
                Members · {members.length}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: hp(4), gap: 8 }}>
            <Ionicons name="people-outline" size={hp(4)} color={Colors.muted} />
            <Text style={{ fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.muted }}>
              No members found
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + hp(2) }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Top bar
  topBar: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: wp(4),
    paddingBottom:    hp(1.2),
    backgroundColor:  Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width:  hp(4),
    height: hp(4),
    alignItems:      'center',
    justifyContent:  'center',
  },
  topTitle: {
    fontSize:   hp(2.1),
    fontFamily: Fonts.semiBold,
    color:      Colors.ink,
    flex:       1,
    textAlign:  'center',
  },

  // Group hero
  groupCard: {
    alignItems:     'center',
    paddingVertical: hp(3),
    paddingHorizontal: wp(4),
    gap: 6,
    backgroundColor: Colors.white,
  },
  groupAvatarWrap: {
    width:           hp(10),
    height:          hp(10),
    borderRadius:    hp(5),
    backgroundColor: Colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    hp(0.5),
  },
  groupAvatarText: {
    fontSize:   hp(4),
    fontFamily: Fonts.bold,
    color:      Colors.primary,
  },
  groupName: {
    fontSize:   hp(2.5),
    fontFamily: Fonts.bold,
    color:      Colors.ink,
    textAlign:  'center',
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  groupMetaText: {
    fontSize:   hp(1.7),
    fontFamily: Fonts.regular,
    color:      Colors.muted,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: wp(4),
    paddingVertical:   hp(1.2),
    backgroundColor:  Colors.canvas,
    borderTopWidth:   1,
    borderBottomWidth: 1,
    borderColor:      Colors.borderLight,
  },
  sectionTitle: {
    fontSize:   hp(1.55),
    fontFamily: Fonts.semiBold,
    color:      Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Member row
  memberRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    paddingHorizontal: wp(4),
    paddingVertical:  hp(1.4),
    backgroundColor:  Colors.white,
  },
  memberName: {
    fontSize:   hp(1.8),
    fontFamily: Fonts.medium,
    color:      Colors.ink,
    flex:       1,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      20,
    flexShrink:        0,
  },
  roleText: {
    fontSize:   hp(1.3),
    fontFamily: Fonts.medium,
  },
  noSendLabel: {
    fontSize:   hp(1.4),
    fontFamily: Fonts.regular,
    color:      Colors.muted,
    marginTop:  1,
  },

  // Error/retry
  retryBtn: {
    marginTop:        hp(1),
    paddingHorizontal: wp(6),
    paddingVertical:  hp(1.4),
    borderRadius:     8,
    backgroundColor:  Colors.primary,
  },
  retryBtnText: {
    fontSize:   hp(1.75),
    fontFamily: Fonts.semiBold,
    color:      Colors.white,
  },
});
