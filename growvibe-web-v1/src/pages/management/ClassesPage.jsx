/**
 * ClassesPage.jsx
 *
 * Session-scoped class management for the web dashboard.
 * Reads selectedBranchId + selectedSessionId from Redux.
 *
 * Create: calls create_class RPC (atomic: class + chat + optional teacher).
 * Edit  : updates class_name directly + calls update_class_teacher RPC if teacher changed.
 * Teacher picker: dropdown list matching the web OwnerPicker pattern from SchoolsPage.
 */

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, SaveBtn, CancelBtn, FormError,
  SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus  from '../../assets/icons/Plus';
import Pen   from '../../assets/icons/Pen';
import Users from '../../assets/icons/Users';
import GroupChatManager from '../../components/shared/GroupChatManager';

// ─── Module-level cache (keyed by sessionId|query) ───────────────────────────
const cache = makePageCache();
export function invalidateClassPageCache(sessionId) { cache.invalidate(sessionId); }

const PAGE_SIZE = 12;

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

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.borderLight, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
          <div style={{ height: 10, width: '70%', borderRadius: 6, backgroundColor: C.borderLight }} />
        </div>
      </div>
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ height: 28, width: 80, borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 28, width: 52, borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ─── Class card ───────────────────────────────────────────────────────────────
function ClassCard({ item, onEdit, onStudents, onGroupChat, onAttendance }) {
  const [hov, setHov] = useState(false);
  const hasTeacher = !!item.teacher_id;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Top: class icon + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.class_name || '—'}
          </div>
          <div style={{ fontSize: 12, color: hasTeacher ? C.soft : C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hasTeacher ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Avatar name={item.teacher_name} url={item.teacher_avatar} size={16} />
                {item.teacher_name}
              </span>
            ) : (
              <em>No incharge teacher</em>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
        <button
          onClick={() => onGroupChat(item)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Group Chat
        </button>
        <button
          onClick={() => onAttendance(item)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #FED7AA', backgroundColor: '#FFF7ED', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#C2410C' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Attendance
        </button>
        <button
          onClick={() => onStudents(item)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #EDE9FE', backgroundColor: '#F5F3FF', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#7C3AED' }}
        >
          <Users size={12} color="#7C3AED" strokeWidth={1.8} /> Students
        </button>
        <button
          onClick={() => onEdit(item)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}
        >
          <Pen size={11} color={C.blue} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── Teacher picker dropdown ──────────────────────────────────────────────────
// Matches the web OwnerPicker pattern: styled select-like trigger + dropdown list.
function TeacherPicker({ branchId, value, onChange, currentTeacher }) {
  const [open,     setOpen]     = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [query,    setQuery]    = useState('');

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: available } = await supabase
        .from('available_teachers')
        .select('id, name, email, avatar_url')
        .eq('branch_id', branchId)
        .order('name', { ascending: true });

      if (cancelled) return;

      let list = available ?? [];
      // Prepend current teacher if they have class_id set (won't appear in available_teachers)
      if (currentTeacher?.id) {
        const alreadyIn = list.some((t) => t.id === currentTeacher.id);
        if (!alreadyIn) list = [currentTeacher, ...list];
      }
      setTeachers(list);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [branchId, currentTeacher?.id]);

  const options = [
    { id: null, name: 'No Teacher', email: 'Leave class unassigned', avatar_url: null },
    ...teachers,
  ];

  const filtered = query.trim()
    ? options.filter((o) => o.id === null || o.name?.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find((o) => o.id === value) ?? options[0];

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, height: 42, paddingInline: 12, borderRadius: 8, border: `1.5px solid ${open ? C.blue : C.border}`, backgroundColor: C.white, cursor: 'pointer', userSelect: 'none', transition: 'border-color 0.12s' }}
      >
        {selected?.id
          ? <Avatar name={selected.name} url={selected.avatar_url} size={24} />
          : <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={13} color={C.muted} />
            </div>
        }
        <span style={{ flex: 1, fontSize: 13, color: selected?.id ? C.ink : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.name || 'Select teacher…'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.10)', zIndex: 50, maxHeight: 260, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.borderLight}` }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teachers…"
              style={{ width: '100%', height: 32, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, paddingInline: 8, color: C.ink, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Options */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: C.muted }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: C.muted }}>No teachers found</div>
            ) : filtered.map((t) => {
              const isSel = t.id === value || (t.id === null && value === null);
              return (
                <div
                  key={t.id ?? '__none__'}
                  onClick={() => { onChange(t.id); setOpen(false); setQuery(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', backgroundColor: isSel ? C.blueBg : 'transparent', transition: 'background-color 0.1s' }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = C.canvas; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {t.id
                    ? <Avatar name={t.name} url={t.avatar_url} size={28} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={13} color={C.muted} />
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, color: t.id ? C.ink : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</div>
                  </div>
                  {isSel && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Class form (inside SlideOver) ────────────────────────────────────────────
function ClassForm({ cls, sessionId, branchId, schoolId, onClose, onSaved }) {
  const isEdit = !!cls;

  const [className,  setClassName]  = useState(cls?.class_name  ?? '');
  const [teacherId,  setTeacherId]  = useState(cls?.teacher_id  ?? null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [nameErr,    setNameErr]    = useState('');

  // Current teacher object for prepending in edit mode
  const currentTeacher = isEdit && cls.teacher_id
    ? { id: cls.teacher_id, name: cls.teacher_name, avatar_url: cls.teacher_avatar, email: '' }
    : null;

  function validate() {
    setNameErr('');
    if (!className.trim() || className.trim().length < 2) {
      setNameErr('Class name must be at least 2 characters.');
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setError('');

    try {
      if (!isEdit) {
        const { error: err } = await supabase.rpc('create_class', {
          p_school_id:  schoolId,
          p_branch_id:  branchId,
          p_session_id: sessionId,
          p_class_name: className.trim(),
          p_teacher_id: teacherId || null,
        });
        if (err) throw new Error(err.message);

      } else {
        const oldTeacherId = cls.teacher_id ?? null;
        const newTeacherId = teacherId ?? null;
        const teacherChanged = oldTeacherId !== newTeacherId;
        const nameChanged    = className.trim() !== (cls.class_name ?? '');

        if (teacherChanged) {
          const { error: err } = await supabase.rpc('update_class_teacher', {
            p_class_id:       cls.id,
            p_new_teacher_id: newTeacherId,
            p_old_teacher_id: oldTeacherId,
          });
          if (err) throw new Error(err.message);
        }

        if (nameChanged) {
          const { error: err } = await supabase
            .from('classes')
            .update({ class_name: className.trim(), updated_at: new Date().toISOString() })
            .eq('id', cls.id);
          if (err) throw new Error(err.message);
        }
      }

      invalidateClassPageCache(sessionId);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <FormError message={error} />}

      <Field label="Class Name" error={nameErr}>
        <TextInput
          value={className}
          onChange={(e) => { setClassName(e.target.value); setNameErr(''); }}
          placeholder="e.g. Grade 5 – A"
        />
      </Field>

      <Field label="Incharge Teacher">
        <TeacherPicker
          branchId={branchId}
          value={teacherId}
          onChange={setTeacherId}
          currentTeacher={currentTeacher}
        />
        <p style={{ margin: '6px 0 0', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          {isEdit
            ? 'Changing the teacher updates their profile and group chat automatically.'
            : 'A group chat will be created for this class. The teacher will be added as a member.'}
        </p>
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <SaveBtn loading={saving} onClick={handleSave} label={isEdit ? 'Save Changes' : 'Create Class'} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Classes Page ─────────────────────────────────────────────────────────────
export default function ClassesPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);
  const navigate = useNavigate();

  const schoolId  = profile?.school_id;
  const branchId  = selectedBranchId;
  const sessionId = selectedSessionId;

  const [slideOpen,   setSlideOpen]   = useState(false);
  const [editCls,     setEditCls]     = useState(null);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatClass,   setChatClass]   = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } =
    usePageList({
      cache,
      scope: sessionId ?? '',
      pageSize: PAGE_SIZE,
      buildQuery: (sb, scope, query, from, to) => {
        let q = sb
          .from('classes_with_teacher')
          .select('id, school_id, branch_id, session_id, class_name, teacher_id, teacher_name, teacher_avatar, chat_id, created_at')
          .eq('session_id', scope)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (query) q = q.ilike('class_name', `%${query}%`);
        return q;
      },
    });

  function openCreate() { setEditCls(null); setSlideOpen(true); }
  function openEdit(c)  { setEditCls(c);    setSlideOpen(true); }
  function closeSlide() { setSlideOpen(false); setEditCls(null); }
  function handleSaved() { closeSlide(); reload(); }
  function handleStudents(c) {
    navigate(`/students?classId=${c.id}&className=${encodeURIComponent(c.class_name)}`);
  }
  function handleAttendance(c) {
    navigate(`/student-attendance?classId=${c.id}&className=${encodeURIComponent(c.class_name)}&sessionId=${sessionId ?? ''}`);
  }
  function handleGroupChat(c) {
    setChatClass(c);
    setChatOpen(true);
  }

  // Guard: need both branch and session selected
  if (!branchId || !sessionId) {
    return (
      <div>
        <PageHeader title="Classes" subtitle="Select a branch and session from the dashboard first." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <p style={{ color: C.muted, fontSize: 13 }}>
            {!branchId
              ? 'No branch selected. Go to the dashboard and pick a branch.'
              : 'No active session. Select or create a session for this branch.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle="Session-scoped classes and sections"
        actions={<ActionBtn icon={Plus} label="Add Class" primary onClick={openCreate} />}
      />

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes…" />

      {loading ? (
        <CardGrid>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </CardGrid>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyBlock search={search} emptyText="No classes yet for this session." />
      ) : (
        <>
          <CardGrid>
            {items.map((item) => (
              <ClassCard key={item.id} item={item} onEdit={() => openEdit(item)} onStudents={handleStudents} onGroupChat={handleGroupChat} onAttendance={handleAttendance} />
            ))}
          </CardGrid>

          {hasMore && (
            <LoadMoreBtn loading={loadingMore} onClick={loadMore} />
          )}
        </>
      )}

      <GroupChatManager
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatClass(null); }}
        chatId={chatClass?.chat_id}
        classId={chatClass?.id}
        className={chatClass?.class_name}
        branchId={chatClass?.branch_id ?? branchId}
        schoolId={chatClass?.school_id ?? schoolId}
      />

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editCls ? 'Edit Class' : 'New Class'}
      >
        {slideOpen && (
          <ClassForm
            cls={editCls}
            sessionId={sessionId}
            branchId={branchId}
            schoolId={schoolId}
            onClose={closeSlide}
            onSaved={handleSaved}
          />
        )}
      </SlideOver>
    </div>
  );
}
