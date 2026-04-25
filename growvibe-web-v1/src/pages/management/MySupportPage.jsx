/**
 * MySupportPage.jsx
 *
 * Non-admin view: lists the current user's own support tickets.
 * Can create new tickets and view/reply to existing ones.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { C } from '../dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import Ticket from '../../assets/icons/Ticket';
import Send   from '../../assets/icons/Send';
import Plus   from '../../assets/icons/Plus';

// ── Module-level caches keyed by userId / ticketId ───────────────────────────
const CACHE_TTL    = 30_000;
const ticketCache  = {}; // key: userId
const repliesCache = {}; // key: ticketId
function isFresh(cache, key) { const e = cache[key]; return e && Date.now() - e.ts < CACHE_TTL; }
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { low: C.green,  medium: C.yellow,  high: C.red    };
const PRIORITY_BG    = { low: C.greenBg, medium: C.yellowBg, high: C.redBg };
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITIES     = ['low', 'medium', 'high'];

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
      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: isOpen ? C.green : C.border }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmt(ticket.created_at)}</div>
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
function ReplyBubble({ reply, myId }) {
  const isMine = reply.sent_by === myId;
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
        <div style={{ height: 10, width: '40%', borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ── NewTicketForm ─────────────────────────────────────────────────────────────
function NewTicketForm({ profile, onCreated, onCancel }) {
  const [title,    setTitle]    = useState('');
  const [message,  setMessage]  = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit() {
    if (!title.trim())   { setError('Title is required.'); return; }
    if (!message.trim()) { setError('Message is required.'); return; }
    setSaving(true); setError('');
    const { data, error: err } = await supabase.from('support_tickets').insert({
      school_id: profile.school_id, created_by: profile.id,
      role: profile.role, title: title.trim(), message: message.trim(), priority,
    }).select('id, title, message, priority, status, created_at').single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated(data);
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>New Support Ticket</h3>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.soft, display: 'block', marginBottom: 6 }}>Title</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          placeholder="Brief summary of the issue"
          style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, paddingInline: 10, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
          onFocus={(e) => { e.target.style.borderColor = C.blue; }}
          onBlur={(e)  => { e.target.style.borderColor = C.border; }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.soft, display: 'block', marginBottom: 6 }}>Priority</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                backgroundColor: priority === p ? PRIORITY_COLOR[p] : PRIORITY_BG[p],
                color: priority === p ? '#fff' : PRIORITY_COLOR[p],
                transition: 'background-color 0.12s',
              }}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.soft, display: 'block', marginBottom: 6 }}>Message</label>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue in detail…" rows={5}
          style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, padding: '9px 10px', color: C.ink, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' }}
          onFocus={(e) => { e.target.style.borderColor = C.blue; }}
          onBlur={(e)  => { e.target.style.borderColor = C.border; }}
        />
      </div>

      {error && <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.soft, backgroundColor: '#fff' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit} disabled={saving}
          style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: C.blue, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Submitting…' : 'Submit Ticket'}
        </button>
      </div>
    </div>
  );
}

// ── MySupportPage ─────────────────────────────────────────────────────────────
export default function MySupportPage() {
  const profile = useSelector((s) => s.auth.profile);

  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState(null);
  const [replies,        setReplies]        = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [sending,        setSending]        = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const repliesEndRef = useRef(null);

  const loadTickets = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) return;
    if (isFresh(ticketCache, uid)) {
      setTickets(ticketCache[uid].items);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id, title, message, priority, status, created_at, profiles(name, avatar_url)')
      .eq('created_by', uid)
      .order('created_at', { ascending: false });
    const items = data || [];
    ticketCache[uid] = { items, ts: Date.now() };
    setTickets(items);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

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
    setShowForm(false);
    loadReplies(ticket.id);
  }

  async function handleSend() {
    if (!replyText.trim() || sending || !selected) return;
    setSending(true);
    const { data, error } = await supabase
      .from('support_ticket_replies')
      .insert({ ticket_id: selected.id, school_id: selected.school_id || profile.school_id, sent_by: profile.id, message: replyText.trim() })
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
    }
  }

  function handleCreated(ticket) {
    // Invalidate ticket list cache so next load fetches fresh
    delete ticketCache[profile.id];
    setTickets((p) => [ticket, ...p]);
    setShowForm(false);
    handleSelect(ticket);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.5 }}>Support</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Your support tickets</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSelected(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: C.blue }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          New Ticket
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Left: ticket list */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${C.borderLight}`, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px 8px', fontSize: 11, color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.borderLight}` }}>
            {loading ? '…' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : tickets.length === 0
                ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 10 }}>
                    <Ticket size={28} color={C.border} />
                    <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'center' }}>No tickets yet.<br />Click "New Ticket" to create one.</p>
                  </div>
                )
                : tickets.map((t) => (
                    <TicketRow key={t.id} ticket={t} selected={selected?.id === t.id} onClick={handleSelect} />
                  ))
            }
          </div>
        </div>

        {/* Right: detail / form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `1px solid ${C.borderLight}`, borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden', minWidth: 0 }}>
          {showForm ? (
            <NewTicketForm profile={profile} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          ) : !selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={26} color={C.muted} />
              </div>
              <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Select a ticket or create a new one</p>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}` }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: -0.3 }}>{selected.title}</h2>
                {/* Creator row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Avatar name={selected.profiles?.name || profile.name} avatarUrl={selected.profiles?.avatar_url || null} size={24} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{selected.profiles?.name || profile.name || 'You'}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{fmt(selected.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[selected.priority], backgroundColor: PRIORITY_BG[selected.priority], borderRadius: 20, padding: '2px 8px' }}>
                    {PRIORITY_LABEL[selected.priority]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: selected.status === 'open' ? C.green : C.muted, backgroundColor: selected.status === 'open' ? C.greenBg : C.canvas, borderRadius: 20, padding: '2px 8px' }}>
                    {selected.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
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
                    ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 16 }}>No replies yet.</p>
                    : replies.map((r) => <ReplyBubble key={r.id} reply={r} myId={profile.id} />)
                }
                <div ref={repliesEndRef} />
              </div>

              {/* Reply input */}
              {selected.status === 'closed' ? (
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.canvas }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>This ticket is closed.</p>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Write a reply… (Enter to send)"
                    rows={2}
                    style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, padding: '9px 12px', color: C.ink, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }}
                    onFocus={(e) => { e.target.style.borderColor = C.blue; }}
                    onBlur={(e)  => { e.target.style.borderColor = C.border; }}
                  />
                  <button
                    onClick={handleSend} disabled={!replyText.trim() || sending}
                    style={{ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, backgroundColor: replyText.trim() && !sending ? C.blue : C.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.15s' }}
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
