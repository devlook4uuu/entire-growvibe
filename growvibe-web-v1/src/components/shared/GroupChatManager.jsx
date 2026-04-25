/**
 * GroupChatManager.jsx
 *
 * SlideOver panel for managing a class group chat's members.
 * Props:
 *   open       — boolean
 *   onClose    — fn
 *   chatId     — uuid
 *   classId    — uuid
 *   className  — string
 *   branchId   — uuid
 *   schoolId   — uuid
 *
 * Tabs: Members | Owner | Principal | Coordinator | Teacher | Students
 * Add member  : calls add_chat_member RPC
 * Remove      : deletes from chat_members
 * Toggle send : calls set_chat_member_send_permission RPC
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C } from '../../pages/dashboard/AdminDashboard';
import { SlideOver } from './webListHelpers';

const TABS = ['Members', 'Owner', 'Principal', 'Coordinator', 'Teacher', 'Students'];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 32 }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: C.blue }}>
      {initials}
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: C.borderLight, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 11, width: '50%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
        <div style={{ height: 9, width: '70%', borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, memberCount }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            backgroundColor: active === tab ? C.blue : C.canvas,
            color: active === tab ? '#fff' : C.soft,
            transition: 'background-color 0.12s',
          }}
        >
          {tab}
          {tab === 'Members' && memberCount > 0 && (
            <span style={{
              backgroundColor: active === tab ? 'rgba(255,255,255,0.25)' : C.border,
              color: active === tab ? '#fff' : C.soft,
              borderRadius: 10, padding: '0 5px', fontSize: 11, fontWeight: 600,
            }}>
              {memberCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Search input ─────────────────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${C.border}`,
        fontSize: 13, paddingInline: 10, color: C.ink, outline: 'none', boxSizing: 'border-box',
        marginBottom: 12,
      }}
      onFocus={(e) => { e.target.style.borderColor = C.blue; }}
      onBlur={(e)  => { e.target.style.borderColor = C.border; }}
    />
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────
function MemberRow({ item, chatId, onRemoved, onToggled }) {
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [hovDel,   setHovDel]   = useState(false);

  async function handleToggle(val) {
    setToggling(true);
    await supabase.rpc('set_chat_member_send_permission', {
      p_chat_id:    chatId,
      p_profile_id: item.profile_id,
      p_can_send:   val,
    });
    setToggling(false);
    onToggled(item.profile_id, val);
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${item.profiles?.name || 'this member'} from the group chat?`)) return;
    setRemoving(true);
    await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId)
      .eq('profile_id', item.profile_id);
    setRemoving(false);
    onRemoved(item.profile_id);
  }

  const name = item.profiles?.name || '—';
  const role = item.profiles?.role || '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.borderLight}` }}>
      <Avatar name={name} url={item.profiles?.avatar_url} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.profiles?.email || ''}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.blue, backgroundColor: C.blueBg, borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>{role}</span>
        </div>
      </div>

      {/* can_send_message toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: item.can_send_message ? C.green : C.muted, fontWeight: 500 }}>
          {item.can_send_message ? 'Can send' : 'View only'}
        </span>
        {toggling ? (
          <div style={{ width: 32, height: 18, borderRadius: 9, backgroundColor: C.borderLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.blue}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
          </div>
        ) : (
          <div
            onClick={() => handleToggle(!item.can_send_message)}
            style={{
              width: 32, height: 18, borderRadius: 9, cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
              backgroundColor: item.can_send_message ? C.green : C.borderLight,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: item.can_send_message ? 16 : 2,
              width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        onMouseEnter={() => setHovDel(true)}
        onMouseLeave={() => setHovDel(false)}
        style={{
          width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', flexShrink: 0,
          backgroundColor: hovDel ? '#FEE2E2' : C.canvas,
          color: hovDel ? '#EF4444' : C.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color 0.12s',
        }}
      >
        {removing ? '…' : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Class row (Students tab — class picker level) ───────────────────────────
function ClassRow({ cls, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onClick(cls.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', backgroundColor: hov ? C.canvas : 'transparent', transition: 'background-color 0.1s', marginBottom: 2 }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{cls.class_name}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{cls.teacher_name ? `Incharge: ${cls.teacher_name}` : 'No incharge teacher'}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ─── Add row ──────────────────────────────────────────────────────────────────
function AddRow({ item, memberIds, chatId, schoolId, isStudent, onAdded, extraLabel }) {
  const [adding, setAdding] = useState(false);
  const [hovAdd, setHovAdd] = useState(false);
  const isMember = memberIds.has(item.id);

  async function handleAdd() {
    if (isMember) return;
    setAdding(true);
    await supabase.rpc('add_chat_member', {
      p_chat_id:          chatId,
      p_profile_id:       item.id,
      p_school_id:        schoolId,
      p_can_send_message: !isStudent,
    });
    setAdding(false);
    onAdded(item.id);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.borderLight}` }}>
      <Avatar name={item.name} url={item.avatar_url} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '—'}</div>
        <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.email || ''}
          {extraLabel && <span style={{ marginLeft: 6, color: C.blue, fontWeight: 500 }}>{extraLabel}</span>}
        </div>
      </div>
      {isMember ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.green, fontWeight: 500, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Added
        </div>
      ) : (
        <button
          onClick={handleAdd}
          disabled={adding}
          onMouseEnter={() => setHovAdd(true)}
          onMouseLeave={() => setHovAdd(false)}
          style={{
            width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', flexShrink: 0,
            backgroundColor: hovAdd ? C.blue : C.blueBg,
            color: C.blue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.12s',
          }}
        >
          {adding ? '…' : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hovAdd ? '#fff' : C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ─── GroupChatManager ─────────────────────────────────────────────────────────
export default function GroupChatManager({ open, onClose, chatId, classId, className, branchId, schoolId }) {
  const [activeTab,     setActiveTab]     = useState('Members');
  const [members,       setMembers]       = useState([]);
  const [memberIds,     setMemberIds]     = useState(new Set());
  const [tabData,       setTabData]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [tabLoading,    setTabLoading]    = useState(false);
  const [search,        setSearch]        = useState('');

  // Students sub-level
  const [classes,       setClasses]       = useState([]);
  const [classLoading,  setClassLoading]  = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  // ── Load members ────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_members')
      .select('profile_id, can_send_message, joined_at, profiles(id, name, email, avatar_url, role)')
      .eq('chat_id', chatId)
      .order('joined_at', { ascending: true });
    if (data) {
      setMembers(data);
      setMemberIds(new Set(data.map((m) => m.profile_id)));
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    if (open) { loadMembers(); setActiveTab('Members'); setSearch(''); setSelectedClass(null); }
  }, [open, loadMembers]);

  // ── Load tab data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || activeTab === 'Members') return;
    if (activeTab === 'Students') { loadClasses(); return; }

    const roleMap = { Owner: 'owner', Principal: 'principal', Coordinator: 'coordinator', Teacher: 'teacher' };
    const role = roleMap[activeTab];
    if (!role) return;

    setTabLoading(true);
    setTabData([]);
    setSearch('');

    const q = activeTab === 'Teacher'
      ? supabase.from('teachers_with_class').select('id, name, email, avatar_url, class_name').eq('branch_id', branchId).order('name')
      : activeTab === 'Owner'
        ? supabase.from('profiles').select('id, name, email, avatar_url').eq('role', 'owner').eq('school_id', schoolId).order('name')
        : supabase.from('profiles').select('id, name, email, avatar_url').eq('role', role).eq('branch_id', branchId).order('name');

    q.then(({ data }) => { if (data) setTabData(data); setTabLoading(false); });
  }, [open, activeTab, branchId, schoolId]);

  async function loadClasses() {
    setClassLoading(true);
    setClasses([]);
    setSelectedClass(null);
    const { data } = await supabase
      .from('classes_with_teacher')
      .select('id, class_name, teacher_name')
      .eq('branch_id', branchId)
      .order('class_name');
    if (data) setClasses(data);
    setClassLoading(false);
  }

  // ── Load students for selected class ────────────────────────────────────────
  useEffect(() => {
    if (!open || activeTab !== 'Students' || !selectedClass) return;
    setTabLoading(true);
    setTabData([]);
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('role', 'student')
      .eq('class_id', selectedClass)
      .order('name')
      .then(({ data }) => { if (data) setTabData(data); setTabLoading(false); });
  }, [open, activeTab, selectedClass]);

  // ── Callbacks ───────────────────────────────────────────────────────────────
  function onMemberRemoved(profileId) {
    setMembers((p) => p.filter((m) => m.profile_id !== profileId));
    setMemberIds((p) => { const s = new Set(p); s.delete(profileId); return s; });
  }
  function onMemberToggled(profileId, val) {
    setMembers((p) => p.map((m) => m.profile_id === profileId ? { ...m, can_send_message: val } : m));
  }
  function onMemberAdded(profileId) {
    setMemberIds((p) => new Set([...p, profileId]));
    loadMembers();
  }

  const filtered = search.trim()
    ? tabData.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()))
    : tabData;

  return (
    <SlideOver open={open} onClose={onClose} title={`Group Chat — ${className || ''}`}>
      <TabBar active={activeTab} memberCount={members.length} onChange={(t) => { setActiveTab(t); setSearch(''); setSelectedClass(null); }} />

      {/* Members tab */}
      {activeTab === 'Members' && (
        loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : members.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32 }}>No members in this chat yet.</p>
        ) : (
          members.map((m) => (
            <MemberRow key={m.profile_id} item={m} chatId={chatId} onRemoved={onMemberRemoved} onToggled={onMemberToggled} />
          ))
        )
      )}

      {/* Students tab */}
      {activeTab === 'Students' && (
        selectedClass ? (
          <>
            <button
              onClick={() => { setSelectedClass(null); setSearch(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, fontSize: 13, fontWeight: 500, padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← All Classes
            </button>
            <SearchInput value={search} onChange={setSearch} placeholder="Search students…" />
            {tabLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>No students in this class.</p>
                : filtered.map((item) => (
                    <AddRow key={item.id} item={item} memberIds={memberIds} chatId={chatId} schoolId={schoolId} isStudent onAdded={onMemberAdded} />
                  ))
            }
          </>
        ) : (
          classLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : classes.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>No classes in this branch.</p>
          ) : (
            classes.map((cls) => (
              <ClassRow key={cls.id} cls={cls} onClick={setSelectedClass} />
            ))
          )
        )
      )}

      {/* Owner / Principal / Coordinator / Teacher tabs */}
      {!['Members', 'Students'].includes(activeTab) && (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${activeTab.toLowerCase()}s…`} />
          {tabLoading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>No {activeTab.toLowerCase()}s found.</p>
              : filtered.map((item) => (
                  <AddRow
                    key={item.id}
                    item={item}
                    memberIds={memberIds}
                    chatId={chatId}
                    schoolId={schoolId}
                    isStudent={false}
                    onAdded={onMemberAdded}
                    extraLabel={item.class_name ? item.class_name : undefined}
                  />
                ))
          }
        </>
      )}
    </SlideOver>
  );
}
