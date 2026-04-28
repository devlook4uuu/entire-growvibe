/**
 * supportTicketDetail.jsx
 *
 * Shows a single support ticket with its replies.
 * Creator + admin can reply. If status is closed, input is hidden.
 *
 * Route params: ticketId, title
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';
import { sendPush } from '../../../lib/notifications';

// ─── Module-level reply cache keyed by ticketId ──────────────────────────────
const REPLY_CACHE_TTL = 30_000;
const replyCache = {};
function isReplyCacheFresh(id) {
  const e = replyCache[id];
  return e && Date.now() - e.ts < REPLY_CACHE_TTL;
}
function writeReplyCache(id, ticket, replies) {
  replyCache[id] = { ticket, replies, ts: Date.now() };
}
function invalidateReplyCache(id) { delete replyCache[id]; }
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { low: Colors.success, medium: Colors.warning, high: Colors.danger };
const PRIORITY_BG    = { low: Colors.successLight, medium: Colors.warningLight, high: Colors.dangerLight };

function Avatar({ name, avatarUrl, size = hp(3.8) }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[S.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[S.avatarInitials, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

function ReplyBubble({ reply, myId }) {
  const isMine = reply.sent_by === myId;
  return (
    <View style={[S.bubbleWrap, isMine ? S.bubbleRight : S.bubbleLeft]}>
      <View style={[S.bubble, isMine ? S.bubbleMine : S.bubbleOther]}>
        <Text style={[S.bubbleText, isMine && { color: Colors.white }]}>{reply.message}</Text>
      </View>
      <Text style={[S.bubbleTime, isMine && { textAlign: 'right' }]}>
        {new Date(reply.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        {' · '}
        {new Date(reply.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>
    </View>
  );
}

export default function SupportTicketDetail() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);
  const { ticketId, title } = useLocalSearchParams();
  const flatRef = useRef(null);

  const isAdmin = profile?.role === 'admin';

  const [ticket,      setTicket]      = useState(null);
  const [replies,     setReplies]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [toggling,    setToggling]    = useState(false);
  const [toggleError, setToggleError] = useState('');

  const load = useCallback(async () => {
    if (isReplyCacheFresh(ticketId)) {
      const c = replyCache[ticketId];
      setTicket(c.ticket);
      setReplies(c.replies);
      setLoading(false);
      return;
    }
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('support_tickets').select('*, profiles(name, avatar_url)').eq('id', ticketId).maybeSingle(),
      supabase
        .from('support_ticket_replies')
        .select('id, message, sent_by, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    ]);
    setTicket(t);
    setReplies(r || []);
    writeReplyCache(ticketId, t, r || []);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .insert({
        ticket_id: ticketId,
        school_id: ticket.school_id,
        sent_by:   profile.id,
        message:   text.trim(),
      })
      .select('id, message, sent_by, created_at');

    const reply = Array.isArray(data) ? data[0] : data;
    setSending(false);
    if (!error && reply) {
      setReplies((prev) => {
        const next = [...prev, reply];
        writeReplyCache(ticketId, ticket, next);
        return next;
      });
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      // Notify the ticket creator if the replier is someone else (e.g. admin)
      if (ticket?.created_by && ticket.created_by !== profile.id) {
        sendPush(
          [ticket.created_by],
          'Support Ticket',
          `${profile?.name || 'Support'} replied: ${text.trim().length > 80 ? text.trim().slice(0, 80) + '…' : text.trim()}`,
          { type: 'support_reply', ticketId },
        );
      }
    }
  }

  async function handleToggleStatus() {
    if (!ticket || toggling) return;
    setToggling(true);
    setToggleError('');
    const newStatus = ticket.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId);
    setToggling(false);
    if (error) {
      setToggleError('Failed to update ticket status. Please try again.');
    } else {
      setTicket((prev) => {
        const next = { ...prev, status: newStatus };
        writeReplyCache(ticketId, next, replyCache[ticketId]?.replies || []);
        return next;
      });
      // Notify the ticket creator of the status change
      if (ticket.created_by && ticket.created_by !== profile.id) {
        const statusLabel = newStatus === 'closed' ? 'closed' : 'reopened';
        sendPush(
          [ticket.created_by],
          'Support Ticket',
          `Your support ticket "${title}" has been ${statusLabel}.`,
          { type: 'support_status', ticketId, status: newStatus },
        );
      }
    }
  }

  const isClosed = ticket?.status === 'closed';

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle} numberOfLines={1}>{title || 'Ticket'}</Text>
          {ticket && (
            <View style={S.headerMeta}>
              <View style={[S.priorityBadge, { backgroundColor: PRIORITY_BG[ticket.priority] }]}>
                <Text style={[S.priorityText, { color: PRIORITY_COLOR[ticket.priority] }]}>
                  {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </Text>
              </View>
              <View style={[S.statusBadge, { backgroundColor: isClosed ? Colors.canvas : Colors.successLight }]}>
                <Text style={[S.statusText, { color: isClosed ? Colors.muted : Colors.success }]}>
                  {isClosed ? 'Closed' : 'Open'}
                </Text>
              </View>
            </View>
          )}
        </View>
        {isAdmin && ticket && (
          <TouchableOpacity
            style={[S.toggleBtn, { backgroundColor: isClosed ? Colors.successLight : Colors.dangerLight }]}
            onPress={handleToggleStatus}
            disabled={toggling}
            activeOpacity={0.8}
          >
            {toggling
              ? <ActivityIndicator size="small" color={isClosed ? Colors.success : Colors.danger} />
              : <Text style={[S.toggleBtnText, { color: isClosed ? Colors.success : Colors.danger }]}>
                  {isClosed ? 'Reopen' : 'Close'}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={hp(2)}
        >
          {/* Toggle error banner */}
          {!!toggleError && (
            <View style={S.toggleErrorBanner}>
              <Text style={S.toggleErrorText}>{toggleError}</Text>
            </View>
          )}

          {/* Ticket body */}
          <View style={S.ticketBody}>
            {/* Creator row */}
            <View style={S.creatorRow}>
              <Avatar
                name={ticket?.profiles?.name}
                avatarUrl={ticket?.profiles?.avatar_url}
                size={hp(3.6)}
              />
              <View style={{ flex: 1 }}>
                <Text style={S.creatorName}>{ticket?.profiles?.name || 'Unknown'}</Text>
                <Text style={S.ticketDate}>
                  {new Date(ticket?.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
            <Text style={S.ticketMsg}>{ticket?.message}</Text>
          </View>

          {/* Replies */}
          <FlatList
            ref={flatRef}
            data={replies}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => <ReplyBubble reply={item} myId={profile.id} />}
            contentContainerStyle={S.repliesPad}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={S.noReplies}>No replies yet.</Text>
            }
            onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Reply input — hidden when closed */}
          {isClosed ? (
            <View style={S.closedBar}>
              <Ionicons name="lock-closed-outline" size={hp(1.8)} color={Colors.muted} />
              <Text style={S.closedText}>This ticket is closed. No further replies allowed.</Text>
            </View>
          ) : (
            <View style={S.inputBar}>
              <TextInput
                style={S.inputField}
                placeholder="Write a reply…"
                placeholderTextColor={Colors.muted}
                value={text}
                onChangeText={setText}
                multiline
              />
              <TouchableOpacity
                style={[S.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Ionicons name="send" size={hp(2)} color={Colors.white} />
                }
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </ScreenWrapper>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(1.5),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:  { padding: 4 },
  toggleBtn: { paddingHorizontal: wp(3), paddingVertical: hp(0.8), borderRadius: 8, minWidth: hp(8), alignItems: 'center', justifyContent: 'center' },
  toggleBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold },
  headerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerMeta:  { flexDirection: 'row', gap: 6, marginTop: 4 },
  priorityBadge: { borderRadius: 20, paddingHorizontal: wp(2), paddingVertical: 2 },
  priorityText:  { fontSize: hp(1.2), fontFamily: Fonts.semiBold },
  statusBadge:   { borderRadius: 20, paddingHorizontal: wp(2), paddingVertical: 2 },
  statusText:    { fontSize: hp(1.2), fontFamily: Fonts.semiBold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  ticketBody: {
    marginHorizontal: wp(4), marginTop: hp(1.5), marginBottom: hp(0.5),
    backgroundColor: Colors.canvas, borderRadius: 12, padding: wp(4), gap: hp(1),
  },
  creatorRow:  { flexDirection: 'row', alignItems: 'center', gap: wp(2.5) },
  creatorName: { fontSize: hp(1.5), fontFamily: Fonts.semiBold, color: Colors.ink },
  ticketMsg:  { fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.ink, lineHeight: hp(2.4) },
  ticketDate: { fontSize: hp(1.25), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  repliesPad: { paddingHorizontal: wp(4), paddingVertical: hp(1), gap: hp(1.4) },
  noReplies:  { textAlign: 'center', color: Colors.muted, fontSize: hp(1.5), marginTop: hp(2) },

  bubbleWrap:  { maxWidth: '75%', gap: 3 },
  bubbleLeft:  { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubble:      { borderRadius: 14, paddingHorizontal: wp(3.5), paddingVertical: hp(1) },
  bubbleMine:  { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight, borderBottomLeftRadius: 4 },
  bubbleText:  { fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.ink },
  bubbleTime:  { fontSize: hp(1.1), fontFamily: Fonts.regular, color: Colors.muted, marginHorizontal: 4 },

  toggleErrorBanner: {
    marginHorizontal: wp(4), marginTop: hp(1),
    backgroundColor: Colors.dangerLight, borderRadius: 10,
    paddingVertical: hp(1), paddingHorizontal: wp(4),
    borderWidth: 1, borderColor: Colors.dangerBorder ?? Colors.danger,
  },
  toggleErrorText: {
    fontSize: hp(1.4), fontFamily: Fonts.medium, color: Colors.dangerText ?? Colors.danger,
    textAlign: 'center',
  },
  closedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.canvas, margin: wp(4), borderRadius: 10,
    padding: wp(3.5),
  },
  closedText: { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted, flex: 1 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: wp(2),
    paddingHorizontal: wp(4), paddingVertical: hp(1.2),
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    backgroundColor: Colors.white,
    marginBottom: hp(2)
  },
  inputField: {
    flex: 1, backgroundColor: Colors.canvas, borderRadius: 20,
    paddingHorizontal: wp(4), paddingVertical: hp(1.1),
    fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.ink,
    maxHeight: hp(12),
  },
  sendBtn: {
    width: hp(4.8), height: hp(4.8), borderRadius: hp(2.4),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
});
