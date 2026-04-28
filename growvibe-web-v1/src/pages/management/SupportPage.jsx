/**
 * SupportPage.jsx
 *
 * Admin view: lists all support tickets across all schools.
 * Admin can:
 *   - Filter by status (all / open / closed)
 *   - Open a ticket to read + reply
 *   - Toggle status between open / closed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { C } from '../dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import Ticket  from '../../assets/icons/Ticket';
import Send    from '../../assets/icons/Send';

// ─── Fire-and-forget push helper (web) ───────────────────────────────────────
async function sendPush(userIds, title, body) {
  if (!userIds || userIds.length === 0) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userIds, title, body }),
  }).catch(() => {});
}

// ── Module-level caches ───────────────────────────────────────────────────────
const CACHE_TTL = 30_000;
const ticketCache  = {}; // key: filter ('all'|'open'|'closed')
const repliesCache = {}; // key: ticketId
function isFresh(cache, key) { const e = cache[key]; return e && Date.now() - e.ts < CACHE_TTL; }
// ─────────────────────────────────────────────────────────────────────────────

// ── helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { low: C.green,  medium: C.yellow,  high: C.red   };
const PRIORITY_BG    = { low: C.greenBg, medium: C.yellowBg, high: C.redBg };
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

function Avatar({ name, avatarUrl, size = 30 }) {
  const initials = (name || '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');
  if (avatarUrl && avatarUrl.startsWith('http')) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: C.blue, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600,
    }}>
      {initials || '?'}
    </div>
  );
}

function fmt(dt) {
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dt) {
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' · ' +
    new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── TicketRow ─────────────────────────────────────────────────────────────────
function TicketRow({ ticket, selected, onClick }) {
  const [hov, setHov] = useState(false);
  const isOpen = ticket.status === 'open';
  return (
    <div
      onClick={() => onClick(ticket)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer',
        backgroundColor: selected ? C.blueBg : hov ? C.canvas : '#fff',
        transition: 'background-color 0.1s',
      }}
    >
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: isOpen ? C.green : C.border }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {ticket.profiles?.name || '—'} · {ticket.profiles?.role || ''} · {fmt(ticket.created_at)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[ticket.priority], backgroundColor: PRIORITY_BG[ticket.priority], borderRadius: 20, padding: '2px 8px' }}>
          {PRIORITY_LABEL[ticket.priority]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: isOpen ? C.green : C.muted, backgroundColor: isOpen ? C.greenBg : C.canvas, borderRadius: 20, padding: '2px 8px' }}>
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>
    </div>
  );
}

// ── ReplyBubble ───────────────────────────────────────────────────────────────
function ReplyBubble({ reply, adminId }) {
  const isMine = reply.sent_by === adminId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{
        maxWidth: '75%', padding: '9px 13px', borderRadius: 12,
        borderBottomRightRadius: isMine ? 2 : 12,
        borderBottomLeftRadius:  isMine ? 12 : 2,
        backgroundColor: isMine ? C.blue : C.canvas,
        color: isMine ? '#fff' : C.ink,
        fontSize: 13, lineHeight: '1.5',
      }}>
        {reply.message}
      </div>
      <span style={{ fontSize: 11, color: C.muted, marginTop: 3, marginLeft: 4, marginRight: 4 }}>
        {fmtTime(reply.created_at)}
      </span>
    </div>
  );
}

// ── SkeletonRow ───────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.borderLight, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
        <div style={{ height: 10, width: '75%', borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ── SupportPage ───────────────────────────────────────────────────────────────
export default function SupportPage() {
  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState('all');
  const [selected,       setSelected]       = useState(null);
  const [replies,        setReplies]        = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [sending,        setSending]        = useState(false);
  const [toggling,       setToggling]       = useState(false);
  const [adminId,        setAdminId]        = useState(null);
  const repliesEndRef = useRef(null);

  // Grab admin's own user id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data?.user) setAdminId(data.user.id); });
  }, []);

  // ── Load tickets ───────────────────────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    if (isFresh(ticketCache, filter)) {
      setTickets(ticketCache[filter].items);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = supabase
      .from('support_tickets')
      .select('id, title, message, priority, status, created_at, school_id, created_by, profiles(name, role, avatar_url)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') q.eq('status', filter);
    const { data } = await q;
    const items = data || [];
    ticketCache[filter] = { items, ts: Date.now() };
    setTickets(items);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // ── Load replies for selected ticket ──────────────────────────────────────
  const loadReplies = useCallback(async (ticketId) => {
    if (isFresh(repliesCache, ticketId)) {
      setReplies(repliesCache[ticketId].items);
      setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    setRepliesLoading(true);
    const { data } = await supabase
      .from('support_ticket_replies')
      .select('id, message, sent_by, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    const items = data || [];
    repliesCache[ticketId] = { items, ts: Date.now() };
    setReplies(items);
    setRepliesLoading(false);
    setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  function handleSelect(ticket) {
    setSelected(ticket);
    setReplyText('');
    loadReplies(ticket.id);
  }

  // ── Send reply ─────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!replyText.trim() || sending || !selected) return;
    setSending(true);
    const uid = adminId || (await supabase.auth.getUser()).data.user.id;
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .insert({ ticket_id: selected.id, school_id: selected.school_id, sent_by: uid, message: replyText.trim() })
      .select('id, message, sent_by, created_at');
    setSending(false);
    const reply = Array.isArray(data) ? data[0] : data;
    if (!error && reply) {
      setReplies((p) => {
        const next = [...p, reply];
        repliesCache[selected.id] = { items: next, ts: Date.now() };
        return next;
      });
      setReplyText('');
      setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      // Notify ticket creator (fire-and-forget)
      if (selected.created_by && selected.created_by !== uid) {
        sendPush([selected.created_by], 'Support Ticket', 'Your support ticket has received a reply');
      }
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────────────
  async function handleToggleStatus() {
    if (!selected || toggling) return;
    setToggling(true);
    const newStatus = selected.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', selected.id);
    setToggling(false);
    if (!error) {
      const updated = { ...selected, status: newStatus };
      setSelected(updated);
      setTickets((p) => {
        const next = p.map((t) => t.id === selected.id ? updated : t);
        // Invalidate ticket caches since status changed
        Object.keys(ticketCache).forEach((k) => delete ticketCache[k]);
        ticketCache[filter] = { items: next, ts: Date.now() };
        return next;
      });
      if (selected.created_by && selected.created_by !== uid) {
        sendPush([selected.created_by], 'Support Ticket', 'Your support ticket status has been updated');
      }
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.5 }}>
          Support Tickets
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
          All tickets from schools
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* ── Left: ticket list ── */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${C.borderLight}`, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '12px 12px 0' }}>
            {['all', 'open', 'closed'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(null); }}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  backgroundColor: filter === f ? C.blue : C.canvas,
                  color: filter === f ? '#fff' : C.soft,
                  transition: 'background-color 0.12s',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Ticket count */}
          <div style={{ padding: '10px 16px 8px', fontSize: 11, color: C.muted, fontWeight: 500 }}>
            {loading ? '…' : `${filtered.length} ticket${filtered.length !== 1 ? 's' : ''}`}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 10 }}>
                    <Ticket size={32} color={C.border} />
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No tickets found</p>
                  </div>
                )
                : filtered.map((t) => (
                    <TicketRow key={t.id} ticket={t} selected={selected?.id === t.id} onClick={handleSelect} />
                  ))
            }
          </div>
        </div>

        {/* ── Right: ticket detail ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `1px solid ${C.borderLight}`, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden', minWidth: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={26} color={C.muted} />
              </div>
              <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Select a ticket to view</p>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: -0.3 }}>
                    {selected.title}
                  </h2>
                  {/* Creator row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar name={selected.profiles?.name} avatarUrl={selected.profiles?.avatar_url} size={26} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
                      {selected.profiles?.name || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{selected.profiles?.role}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[selected.priority], backgroundColor: PRIORITY_BG[selected.priority], borderRadius: 20, padding: '2px 8px' }}>
                      {PRIORITY_LABEL[selected.priority]}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: selected.status === 'open' ? C.green : C.muted, backgroundColor: selected.status === 'open' ? C.greenBg : C.canvas, borderRadius: 20, padding: '2px 8px' }}>
                      {selected.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted }}>{fmt(selected.created_at)}</span>
                  </div>
                </div>
                {/* Toggle status button */}
                <button
                  onClick={handleToggleStatus}
                  disabled={toggling}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
                    backgroundColor: selected.status === 'open' ? C.redBg : C.greenBg,
                    color: selected.status === 'open' ? C.red : C.green,
                    opacity: toggling ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {toggling ? '…' : selected.status === 'open' ? 'Close Ticket' : 'Reopen Ticket'}
                </button>
              </div>

              {/* Ticket body */}
              <div style={{ padding: '14px 20px', backgroundColor: C.canvas, borderBottom: `1px solid ${C.borderLight}` }}>
                <p style={{ fontSize: 13, color: C.ink, margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.message}</p>
              </div>

              {/* Replies */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {repliesLoading
                  ? <p style={{ color: C.muted, fontSize: 13 }}>Loading replies…</p>
                  : replies.length === 0
                    ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 16 }}>No replies yet. Be the first to respond.</p>
                    : replies.map((r) => <ReplyBubble key={r.id} reply={r} adminId={adminId} />)
                }
                <div ref={repliesEndRef} />
              </div>

              {/* Reply input — read-only if closed */}
              {selected.status === 'closed' ? (
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.canvas }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Ticket is closed. Reopen to reply.</p>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    style={{
                      flex: 1, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13,
                      padding: '9px 12px', color: C.ink, outline: 'none', resize: 'none',
                      fontFamily: 'inherit', lineHeight: '1.5',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = C.blue; }}
                    onBlur={(e)  => { e.target.style.borderColor = C.border; }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    style={{
                      width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                      backgroundColor: replyText.trim() && !sending ? C.blue : C.borderLight,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <Send size={16} color={replyText.trim() && !sending ? '#fff' : C.muted} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
