/**
 * StudentsPage.jsx
 *
 * Class-scoped student management for the web dashboard.
 * Receives classId + className via URL search params: /students?classId=…&className=…
 *
 * Create: calls create-user edge function with role='student', class_id, student_fee.
 * Edit  : calls update-user edge function with student_fee + is_active.
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, Toggle, SaveBtn, CancelBtn, FormError,
  StatusPill, SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus    from '../../assets/icons/Plus';
import Pen     from '../../assets/icons/Pen';
import Receipt from '../../assets/icons/Receipt';
// Receipt imported for the Fee button icon on StudentCard

function buildMonthOptions() {
  const now = new Date();
  const opts = [];
  for (let i = -2; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    opts.push({ value, label });
  }
  return opts;
}
export const MONTH_OPTIONS = buildMonthOptions();

// ─── Module-level cache (keyed by classId|query) ─────────────────────────────
const cache = makePageCache(30_000, (scope, q) => `${scope}|${q}`);

export function invalidateStudentPageCache(classId) {
  cache.invalidate(classId);
}

const PAGE_SIZE = 12;

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 36 }) {
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
        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: C.borderLight, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
          <div style={{ height: 10, width: '80%', borderRadius: 6, backgroundColor: C.borderLight }} />
        </div>
      </div>
      <div style={{ height: 10, width: '40%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 10, width: '35%', borderRadius: 6, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Student card ─────────────────────────────────────────────────────────────
function StudentCard({ item, onEdit, onFee }) {
  const [hov, setHov] = useState(false);
  const joinDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar name={item.name} url={item.avatar_url} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '—'}</div>
            <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email || '—'}</div>
          </div>
        </div>
        <StatusPill active={item.is_active} />
      </div>

      <div style={{ fontSize: 12, color: C.soft }}>
        <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>Monthly Fee:</span>
        PKR {item.student_fee != null ? Number(item.student_fee).toLocaleString() : '0'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
        <span style={{ fontSize: 11, color: C.muted }}>Joined {joinDate}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onFee(item)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: 'none', backgroundColor: C.greenBg, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.green }}
          >
            <Receipt size={11} color={C.green} /> Fee
          </button>
          <button
            onClick={() => onEdit(item)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}
          >
            <Pen size={11} color={C.blue} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Student form (inside SlideOver) ─────────────────────────────────────────
function StudentForm({ student, classId, branchId, schoolId, onSave, onClose }) {
  const isEdit = !!student;

  const [name,       setName]       = useState(student?.name        || '');
  const [email,      setEmail]      = useState(student?.email       || '');
  const [password,   setPassword]   = useState('');
  const [studentFee, setStudentFee] = useState(student?.student_fee != null ? String(student.student_fee) : '0');
  const [isActive,   setIsActive]   = useState(student?.is_active   ?? true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit() {
    if (!name.trim())  return setError('Name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (!isEdit && password.length < 6) return setError('Password must be at least 6 characters.');
    if (studentFee === '' || isNaN(Number(studentFee)) || Number(studentFee) < 0) return setError('Enter a valid fee amount.');

    setError(''); setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnName = isEdit ? 'update-user' : 'create-user';
      const body   = isEdit
        ? { user_id: student.id, name: name.trim(), email: email.trim(), is_active: isActive, student_fee: Number(studentFee), ...(password ? { password } : {}) }
        : { name: name.trim(), email: email.trim(), password, role: 'student', school_id: schoolId, branch_id: branchId, class_id: classId, student_fee: Number(studentFee) };

      const res = await supabase.functions.invoke(fnName, {
        body,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error || res.data?.error) throw new Error(res.error?.message || res.data?.error);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <FormError message={error} />
      <Field label="Full Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's full name" />
      </Field>
      <Field label="Email Address">
        <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" />
      </Field>
      <Field label="Student Fee">
        <TextInput value={studentFee} onChange={(e) => setStudentFee(e.target.value)} placeholder="0" type="number" />
      </Field>
      <Field label={isEdit ? 'New Password' : 'Password'} optional={isEdit}>
        <TextInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 6 characters'} type="password" />
      </Field>
      {isEdit && (
        <Field label="Status">
          <Toggle value={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive'} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Add Student'} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Students Page ────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const classId   = searchParams.get('classId');
  const className = searchParams.get('className') || 'Students';

  const schoolId  = profile?.school_id;
  const branchId  = selectedBranchId;
  const sessionId = selectedSessionId;

  // 'create' | student-object (edit)
  const [slideOver, setSlideOver] = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } = usePageList({
    cache,
    scope: classId ?? '',
    pageSize: PAGE_SIZE,
    buildQuery: (sb, scope, query, from, to) => {
      let q = sb
        .from('profiles')
        .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, student_fee, created_at')
        .eq('role', 'student')
        .eq('class_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      return q;
    },
  });

  function handleSaved() {
    cache.invalidate(classId ?? '');
    setSlideOver(null);
    reload();
  }

  function handleFee(item) {
    const params = new URLSearchParams({
      studentId:   item.id,
      studentName: item.name || '',
      studentFee:  item.student_fee != null ? String(item.student_fee) : '0',
      classId:     classId || '',
      className:   className || '',
    });
    navigate(`/fee-records?${params.toString()}`);
  }

  const isEditSlide = slideOver && slideOver !== 'create';
  const slideTitle  = slideOver === 'create' ? 'Add Student' : 'Edit Student';

  if (!classId) {
    return (
      <div>
        <PageHeader greeting="Students" subtitle="Open from a class card to view its students." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <p style={{ color: C.muted, fontSize: 13 }}>No class selected. Go to Classes and click the Students button on a class card.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        greeting={className}
        subtitle="Class students"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ height: 36, paddingInline: 14, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: C.soft }}
            >
              ← Back to Classes
            </button>
            <ActionBtn icon={Plus} label="Add Student" primary onClick={() => setSlideOver('create')} />
          </div>
        }
      />

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" />

      {loading ? (
        <CardGrid>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </CardGrid>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyBlock search={search} emptyText="No students yet for this class." />
      ) : (
        <>
          <CardGrid>
            {items.map((item) => (
              <StudentCard
                key={item.id}
                item={item}
                onEdit={() => setSlideOver(item)}
                onFee={() => handleFee(item)}
              />
            ))}
          </CardGrid>
          {hasMore && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
        </>
      )}

      <SlideOver open={!!slideOver} onClose={() => setSlideOver(null)} title={slideTitle}>
        {slideOver === 'create' && (
          <StudentForm
            student={null}
            classId={classId} branchId={branchId} schoolId={schoolId}
            onSave={handleSaved} onClose={() => setSlideOver(null)}
          />
        )}
        {isEditSlide && (
          <StudentForm
            student={slideOver}
            classId={classId} branchId={branchId} schoolId={schoolId}
            onSave={handleSaved} onClose={() => setSlideOver(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
