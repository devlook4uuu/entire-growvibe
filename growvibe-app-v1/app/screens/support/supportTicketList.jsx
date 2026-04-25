/**
 * supportTicketList.jsx
 *
 * - Admin: lists all tickets across all schools (no create button, shows creator name)
 * - Other roles: lists own tickets with create button
 */

import { useState, useCallback, useRef } from 'react';
import {
  FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';

// ─── Module-level cache (survives unmount/remount) ───────────────────────────
const CACHE_TTL = 30_000; // 30s
const cache = {}; // key: `${uid}:${role}`

function cacheKey(uid, role) { return `${uid}:${role}`; }
function isCacheFresh(key) {
  const e = cache[key];
  return e && Date.now() - e.ts < CACHE_TTL;
}
function writeCache(key, items) {
  cache[key] = { items, ts: Date.now() };
}
export function invalidateSupportTicketCache(uid, role) {
  if (uid && role) delete cache[cacheKey(uid, role)];
  else Object.keys(cache).forEach((k) => delete cache[k]);
}
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { low: Colors.success, medium: Colors.warning, high: Colors.danger };
const PRIORITY_BG    = { low: Colors.successLight, medium: Colors.warningLight, high: Colors.dangerLight };
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

function TicketCard({ item, onPress, showCreator }) {
  const isOpen     = item.status === 'open';
  const replyCount = item.support_ticket_replies?.[0]?.count ?? 0;

  return (
    <TouchableOpacity style={S.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      {/* Top row: status dot · title · priority badge */}
      <View style={S.cardTop}>
        <View style={[S.statusDot, { backgroundColor: isOpen ? Colors.success : Colors.muted }]} />
        <Text style={S.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[S.priorityBadge, { backgroundColor: PRIORITY_BG[item.priority] }]}>
          <Text style={[S.priorityText, { color: PRIORITY_COLOR[item.priority] }]}>
            {PRIORITY_LABEL[item.priority]}
          </Text>
        </View>
      </View>

      {/* Creator name — admin view only */}
      {showCreator && item.profiles?.name && (
        <Text style={S.creatorName} numberOfLines={1}>
          {item.profiles.name} · {item.role}
        </Text>
      )}

      {/* Message preview */}
      <Text style={S.cardMsg} numberOfLines={2}>{item.message}</Text>

      {/* CTA hint */}
      <Text style={S.ctaHint}>Tap to view or add replies</Text>

      {/* Footer: date · reply count · status */}
      <View style={S.cardFooter}>
        <Text style={S.cardDate}>
          {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <View style={S.footerRight}>
          {replyCount > 0 && (
            <View style={S.replyBadge}>
              <Ionicons name="chatbubble-outline" size={hp(1.4)} color={Colors.primary} />
              <Text style={S.replyCount}>{replyCount}</Text>
            </View>
          )}
          <View style={[S.statusBadge, { backgroundColor: isOpen ? Colors.successLight : Colors.canvas }]}>
            <Text style={[S.statusText, { color: isOpen ? Colors.success : Colors.muted }]}>
              {isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={[S.card, { gap: hp(1) }]}>
      <View style={{ height: hp(2), width: '70%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
      <View style={{ height: hp(1.5), width: '90%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
      <View style={{ height: hp(1.5), width: '60%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
    </View>
  );
}

export default function SupportTicketList() {
  const router   = useRouter();
  const profile  = useSelector((s) => s.auth.profile);
  const isAdmin  = profile?.role === 'admin';

  const [tickets,    setTickets]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasMounted = useRef(false);

  const fetchTickets = useCallback(async ({ isRefresh = false } = {}) => {
    const uid  = profile?.id;
    const role = profile?.role;
    if (!uid) return;

    const key = cacheKey(uid, role);

    if (isRefresh) {
      setRefreshing(true);
      invalidateSupportTicketCache(uid, role);
    } else {
      setLoading(true);
    }

    // Admin: all tickets with creator info; others: own tickets only
    let q = supabase
      .from('support_tickets')
      .select(isAdmin
        ? 'id, title, message, priority, status, role, created_at, support_ticket_replies(count), profiles(name)'
        : 'id, title, message, priority, status, created_at, support_ticket_replies(count)')
      .order('created_at', { ascending: false });

    if (!isAdmin) q = q.eq('created_by', uid);

    const { data } = await q;
    const items = data || [];
    setTickets(items);
    writeCache(key, items);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id, profile?.role, isAdmin]);

  useFocusEffect(useCallback(() => {
    const uid  = profile?.id;
    const role = profile?.role;
    if (!uid) return;

    const key = cacheKey(uid, role);
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (isCacheFresh(key)) {
        setTickets(cache[key].items);
      } else {
        fetchTickets();
      }
    } else {
      if (isCacheFresh(key)) {
        setTickets(cache[key].items);
      } else {
        fetchTickets();
      }
    }
  }, [fetchTickets, profile?.id, profile?.role]));

  function handlePress(ticket) {
    router.push({
      pathname: '/screens/support/supportTicketDetail',
      params: { ticketId: ticket.id, title: ticket.title },
    });
  }

  return (
    <View style={{flex: 1, backgroundColor: Colors.white}}>
      {/* Header */}
      <View style={S.header}>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Support</Text>
          <Text style={S.headerSub}>{isAdmin ? 'All tickets' : 'Your tickets'}</Text>
        </View>
        {!isAdmin && (
          <TouchableOpacity
            style={S.newBtn}
            onPress={() => router.push('/screens/support/supportTicketForm')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={hp(2.4)} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : tickets.length === 0 ? (
        <View style={S.empty}>
          <View style={S.emptyIcon}>
            <Ionicons name="ticket-outline" size={hp(3.5)} color={Colors.muted} />
          </View>
          <Text style={S.emptyTitle}>{isAdmin ? 'No tickets yet' : 'No tickets yet'}</Text>
          <Text style={S.emptySub}>
            {isAdmin ? 'No support tickets have been created.' : 'Tap + to create your first support ticket.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TicketCard item={item} onPress={handlePress} showCreator={isAdmin} />}
          contentContainerStyle={S.listPad}
          showsVerticalScrollIndicator={false}
          onRefresh={() => fetchTickets({ isRefresh: true })}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(1.5),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2 },
  newBtn: {
    width: hp(4.5), height: hp(4.5), borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  listPad: { paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(4), gap: hp(1.2) },

  card: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: wp(4),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: wp(2), marginBottom: hp(0.8) },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cardTitle: { flex: 1, fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink },
  priorityBadge: { borderRadius: 20, paddingHorizontal: wp(2), paddingVertical: 3 },
  priorityText:  { fontSize: hp(1.2), fontFamily: Fonts.semiBold },
  creatorName: { fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.muted, marginBottom: hp(0.4), textTransform: 'capitalize' },
  cardMsg: { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.soft, marginBottom: hp(0.6) },
  ctaHint: { fontSize: hp(1.25), fontFamily: Fonts.regular, color: Colors.primary, marginBottom: hp(1) },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  cardDate:    { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted },
  replyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight ?? Colors.canvas,
    borderRadius: 20, paddingHorizontal: wp(2), paddingVertical: 3,
  },
  replyCount:  { fontSize: hp(1.2), fontFamily: Fonts.semiBold, color: Colors.primary },
  statusBadge: { borderRadius: 20, paddingHorizontal: wp(2.5), paddingVertical: 3 },
  statusText:  { fontSize: hp(1.2), fontFamily: Fonts.semiBold },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2) },
  emptyIcon: {
    width: hp(8), height: hp(8), borderRadius: hp(4),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink },
  emptySub:   { fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center', paddingHorizontal: wp(8) },
});
