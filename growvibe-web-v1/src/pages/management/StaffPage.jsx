/**
 * StaffPage.jsx
 *
 * Manages principal, coordinator, and teacher for the selected branch.
 * Role is passed as a URL search param: /staff?role=principal
 *
 * - Principal & coordinator: one per branch — add button hidden when one exists.
 * - Teacher: multiple allowed.
 * - Branch-scoped via Redux selectedBranchId.
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
import Plus from '../../assets/icons/Plus';
import Pen  from '../../assets/icons/Pen';

// ─── Role meta ────────────────────────────────────────────────────────────────
const ROLE_META = {
  principal: {
    label:      'Principal',
    singular:   'principal',
    subtitle:   'One principal per branch',
    singleOnly: true,
  },
  coordinator: {
    label:      'Coordinator',
    singular:   'coordinator',
    subtitle:   'One coordinator per branch',
    singleOnly: true,
  },
  teacher: {
    label:      'Teachers',
    singular:   'teacher',
    subtitle:   'Teaching staff for this branch',
    singleOnly: false,
  },
};

// ─── Module-level cache (keyed by role|branchId|query) ───────────────────────
const cache = makePageCache(30_000, (scope, q) => `${scope}|${q}`);

export function invalidateStaffPageCache(role, branchId) {
  const prefix = `${role}|${branchId}|`;
  // invalidate all entries for this role+branch
  cache.invalidate(`${role}|${branchId}`);
  // also catch __all__ key
  Object.keys(cache).forEach?.((k) => { if (k.startsWith(prefix)) delete cache[k]; });
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
      <div style={{ height: 10, width: '50%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 10, width: '40%', borderRadius: 6, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Staff card ───────────────────────────────────────────────────────────────
function StaffCard({ item, role, onEdit, onAttendance }) {
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

      {role === 'teacher' && (
        <div style={{ fontSize: 12, color: C.soft }}>
          <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>Class:</span>
          {item.class_name
            ? item.class_name
            : <em style={{ color: C.muted }}>Unassigned</em>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
        <span style={{ fontSize: 11, color: C.muted }}>Joined {joinDate}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {role === 'teacher' && (
            <button onClick={() => onAttendance(item)} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: '1px solid #FED7AA', backgroundColor: '#FFF7ED', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#C2410C' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Attendance
            </button>
          )}
          <button onClick={() => onEdit(item)} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}>
            <Pen size={11} color={C.blue} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Staff form (inside SlideOver) ───────────────────────────────────────────
function StaffForm({ staff, role, branchId, schoolId, onSave, onClose }) {
  const isEdit  = !!staff;
  const meta    = ROLE_META[role] ?? ROLE_META.teacher;

  const [name,        setName]        = useState(staff?.name        || '');
  const [email,       setEmail]       = useState(staff?.email       || '');
  const [password,    setPassword]    = useState('');
  const [biometricId, setBiometricId] = useState(staff?.biometric_id || '');
  const [isActive,    setIsActive]    = useState(staff?.is_active ?? true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  async function handleSubmit() {
    if (!name.trim())  return setError('Name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (!isEdit && password.length < 6) return setError('Password must be at least 6 characters.');
    setError(''); setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnName = isEdit ? 'update-user' : 'create-user';
      const body   = isEdit
        ? { user_id: staff.id, name: name.trim(), email: email.trim(), is_active: isActive, biometric_id: biometricId.trim() || null, ...(password ? { password } : {}) }
        : { name: name.trim(), email: email.trim(), password, role, school_id: schoolId, branch_id: branchId, biometric_id: biometricId.trim() || null };
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
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={`${meta.label}'s full name`} />
      </Field>
      <Field label="Email Address">
        <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" type="email" />
      </Field>
      <Field label="Biometric ID" optional>
        <TextInput value={biometricId} onChange={(e) => setBiometricId(e.target.value)} placeholder="Device biometric identifier" />
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
        <SaveBtn label={isEdit ? 'Save Changes' : `Add ${meta.label}`} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Staff Page ───────────────────────────────────────────────────────────────
export default function StaffPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const role    = searchParams.get('role') || 'teacher';
  const meta    = ROLE_META[role] ?? ROLE_META.teacher;

  const schoolId = profile?.school_id;
  const branchId = selectedBranchId;

  const [slideOver, setSlideOver] = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } = usePageList({
    cache,
    scope: `${role}|${branchId ?? ''}`,
    pageSize: PAGE_SIZE,
    buildQuery: (sb, _scope, query, from, to) => {
      if (!branchId) return null;
      let q = role === 'teacher'
        ? sb
            .from('teachers_with_class')
            .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, class_name, created_at, biometric_id')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to)
        : sb
            .from('profiles')
            .select('id, name, email, avatar_url, is_active, branch_id, school_id, class_id, created_at, biometric_id')
            .eq('role', role)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to);
      if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      return q;
    },
  });

  // Single-only: during loading we don't know yet — hide button.
  // After load: show button only if no record exists.
  const alreadyExists = meta.singleOnly && items.length > 0;
  const canAdd        = !loading && (!meta.singleOnly || !alreadyExists);

  function handleSaved() {
    cache.invalidate(`${role}|${branchId ?? ''}`);
    setSlideOver(null);
    reload();
  }

  function handleAttendance(staff) {
    navigate(
      `/teacher-attendance?teacherId=${staff.id}&teacherName=${encodeURIComponent(staff.name)}` +
      `&sessionId=${selectedSessionId ?? ''}&branchId=${branchId ?? ''}&schoolId=${schoolId ?? ''}`
    );
  }

  if (!branchId) {
    return (
      <div>
        <PageHeader title={meta.label} subtitle="Select a branch from the dashboard first." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <p style={{ color: C.muted, fontSize: 13 }}>No branch selected. Go to the dashboard and pick a branch.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={meta.label}
        subtitle={meta.subtitle}
        actions={
          canAdd
            ? <ActionBtn icon={Plus} label={`Add ${meta.label}`} primary onClick={() => setSlideOver('create')} />
            : null
        }
      />

      {/* One-per-branch info banner */}
      {alreadyExists && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: C.blueBg, border: `1px solid ${C.blue}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.blue }}>
          <span style={{ fontWeight: 600 }}>Note:</span>
          <span>This branch already has a {meta.singular}. Edit the existing record below.</span>
        </div>
      )}

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${meta.label.toLowerCase()}…`} />

      {loading ? (
        <CardGrid>
          {Array.from({ length: meta.singleOnly ? 1 : 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </CardGrid>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyBlock
          search={search}
          emptyText={`No ${meta.label.toLowerCase()} yet for this branch.`}
        />
      ) : (
        <>
          <CardGrid>
            {items.map((item) => (
              <StaffCard key={item.id} item={item} role={role} onEdit={() => setSlideOver(item)} onAttendance={handleAttendance} />
            ))}
          </CardGrid>
          {hasMore && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
        </>
      )}

      <SlideOver
        open={!!slideOver}
        onClose={() => setSlideOver(null)}
        title={slideOver === 'create' ? `Add ${meta.label}` : `Edit ${meta.label}`}
      >
        {slideOver && (
          <StaffForm
            staff={slideOver === 'create' ? null : slideOver}
            role={role}
            branchId={branchId}
            schoolId={schoolId}
            onSave={handleSaved}
            onClose={() => setSlideOver(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
