import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, Card, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, Toggle, SaveBtn, CancelBtn, FormError,
  StatusPill, SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus from '../../assets/icons/Plus';
import Pen  from '../../assets/icons/Pen';

// ─── Module-level cache ───────────────────────────────────────────────────────
const cache = makePageCache();
export function invalidateOwnerCache() { cache.invalidateAll(); }

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

// ─── Owner form ───────────────────────────────────────────────────────────────
function OwnerForm({ owner, onSave, onClose }) {
  const isEdit = !!owner;
  const [name,     setName]     = useState(owner?.name  || '');
  const [email,    setEmail]    = useState(owner?.email || '');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(owner?.is_active ?? true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit() {
    if (!name.trim())  return setError('Name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (!isEdit && password.length < 6) return setError('Password must be at least 6 characters.');
    setError(''); setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnName = isEdit ? 'update-user' : 'create-user';
      const body   = isEdit
        ? { user_id: owner.id, name: name.trim(), email: email.trim(), is_active: isActive, ...(password ? { password } : {}) }
        : { name: name.trim(), email: email.trim(), password, role: 'owner' };
      const res = await supabase.functions.invoke(fnName, { body, headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (res.error || res.data?.error) throw new Error(res.error?.message || res.data?.error);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <FormError message={error} />
      <Field label="Full Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Owner's full name" /></Field>
      <Field label="Email Address"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" type="email" /></Field>
      <Field label={isEdit ? 'New Password' : 'Password'} optional={isEdit}>
        <TextInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 6 characters'} type="password" />
      </Field>
      {isEdit && (
        <Field label="Status">
          <Toggle value={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive'} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Add Owner'} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Owner card ───────────────────────────────────────────────────────────────
function OwnerCard({ owner, onEdit }) {
  const [hov, setHov] = useState(false);
  const joinDate = owner.created_at
    ? new Date(owner.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar name={owner.name} url={owner.avatar_url} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.name || '—'}</div>
            <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.email || '—'}</div>
          </div>
        </div>
        <StatusPill active={owner.is_active} />
      </div>

      <div style={{ fontSize: 12, color: C.soft }}>
        <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>School:</span>
        {owner.school_name || <em style={{ color: C.muted }}>No school</em>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
        <span style={{ fontSize: 11, color: C.muted }}>Joined {joinDate}</span>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}>
          <Pen size={11} color={C.blue} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── OwnersPage ───────────────────────────────────────────────────────────────
export default function OwnersPage() {
  const [slideOver, setSlideOver] = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } = usePageList({
    cache,
    scope:    '',
    pageSize: 7,
    buildQuery: (supabase, _scope, query, from, to) => {
      let q = supabase
        .from('owners_with_school')
        .select('id, name, email, avatar_url, is_active, created_at, school_id, school_name')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      return q;
    },
  });

  function handleSaved() {
    invalidateOwnerCache();
    setSlideOver(null);
    reload();
  }

  return (
    <div>
      <PageHeader
        greeting="Owners"
        subtitle="Manage all owner accounts"
        actions={<ActionBtn icon={Plus} label="Add Owner" primary onClick={() => setSlideOver('create')} />}
      />

      <Card>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />

        {loading ? (
          <CardGrid SkeletonCard={SkeletonCard} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => reload()} />
        ) : items.length === 0 ? (
          <EmptyBlock search={search} emptyText="No owners yet." />
        ) : (
          <CardGrid>
            {items.map((owner) => (
              <OwnerCard key={owner.id} owner={owner} onEdit={() => setSlideOver(owner)} />
            ))}
          </CardGrid>
        )}

        {hasMore && !loading && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <SlideOver open={!!slideOver} onClose={() => setSlideOver(null)} title={slideOver === 'create' ? 'Add Owner' : 'Edit Owner'}>
        {slideOver && (
          <OwnerForm owner={slideOver === 'create' ? null : slideOver} onSave={handleSaved} onClose={() => setSlideOver(null)} />
        )}
      </SlideOver>
    </div>
  );
}
