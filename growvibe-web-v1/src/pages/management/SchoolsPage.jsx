import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, Card, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, Toggle, SaveBtn, CancelBtn, FormError,
  StatusPill, SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus    from '../../assets/icons/Plus';
import Pen     from '../../assets/icons/Pen';
import Branch  from '../../assets/icons/Branch';
import Receipt from '../../assets/icons/Receipt';

// ─── Module-level cache ───────────────────────────────────────────────────────
const cache = makePageCache();
export function invalidateSchoolCache() { cache.invalidateAll(); }

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ height: 14, width: '55%', borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 18, width: 55, borderRadius: 999, backgroundColor: C.borderLight }} />
      </div>
      <div style={{ height: 10, width: '40%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 8 }} />
      <div style={{ height: 10, width: '65%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 14 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ height: 28, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 28, width: 80, borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ─── Owner picker dropdown ────────────────────────────────────────────────────
function OwnerPicker({ selectedId, currentOwner, availableOwners, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options = [{ id: null, name: 'No Owner', email: '' }];
  if (currentOwner && currentOwner.id !== null) {
    if (!availableOwners.some((o) => o.id === currentOwner.id)) options.push(currentOwner);
  }
  options.push(...availableOwners);

  const selected = options.find((o) => o.id === selectedId) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 13, color: selected.id ? C.ink : C.muted, backgroundColor: C.white, outline: 'none', boxSizing: 'border-box', padding: '0 36px 0 12px', border: `1.5px solid ${open ? C.blue : C.border}`, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.id ? selected.name : 'No Owner'}</span>
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
          {options.map((o) => (
            <div key={o.id ?? '__none__'} onClick={() => { onChange(o.id); setOpen(false); }}
              style={{ padding: '10px 12px', cursor: 'pointer', backgroundColor: o.id === selectedId ? C.blueBg : 'transparent', borderBottom: `1px solid ${C.borderLight}` }}
              onMouseEnter={(e) => { if (o.id !== selectedId) e.currentTarget.style.backgroundColor = C.canvas; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = o.id === selectedId ? C.blueBg : 'transparent'; }}
            >
              <div style={{ fontSize: 13, fontWeight: o.id === selectedId ? 600 : 400, color: o.id ? C.ink : C.muted }}>{o.name}</div>
              {o.email && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{o.email}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── School form ──────────────────────────────────────────────────────────────
function SchoolForm({ school, onSave, onClose }) {
  const isEdit = !!school;
  const [name,          setName]          = useState(school?.name           || '');
  const [address,       setAddress]       = useState(school?.school_address || '');
  const [contact,       setContact]       = useState(school?.school_contact || '');
  const [isActive,      setIsActive]      = useState(school?.is_active ?? true);
  const [selectedOwner, setSelectedOwner] = useState(isEdit ? (school.owner_id ?? null) : null);
  const [availableOwners,  setAvailableOwners]  = useState([]);
  const [loadingOwners,    setLoadingOwners]    = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  const currentOwner = isEdit && school.owner_id
    ? { id: school.owner_id, name: school.owner_name || 'Current Owner', email: school.owner_email || '' }
    : null;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('available_owners').select('id, name, email').order('name');
      setAvailableOwners(data ?? []);
      setLoadingOwners(false);
    })();
  }, []);

  async function handleSubmit() {
    if (!name.trim()) return setError('School name is required.');
    setError(''); setSaving(true);
    try {
      let schoolId = school?.id;
      if (!isEdit) {
        const { data: newSchool, error: insertErr } = await supabase.from('schools')
          .insert({ name: name.trim(), school_address: address || null, school_contact: contact || null, is_active: isActive })
          .select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        schoolId = newSchool.id;
        if (selectedOwner) {
          const { error: rpcErr } = await supabase.rpc('assign_school_owner', { p_school_id: schoolId, p_new_owner_id: selectedOwner, p_old_owner_id: null });
          if (rpcErr) throw new Error(rpcErr.message);
        }
      } else {
        const { error: updateErr } = await supabase.from('schools')
          .update({ name: name.trim(), school_address: address || null, school_contact: contact || null, is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', schoolId);
        if (updateErr) throw new Error(updateErr.message);
        if (selectedOwner !== (school.owner_id ?? null)) {
          const { error: rpcErr } = await supabase.rpc('assign_school_owner', { p_school_id: schoolId, p_new_owner_id: selectedOwner, p_old_owner_id: school.owner_id ?? null });
          if (rpcErr) throw new Error(rpcErr.message);
        }
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <FormError message={error} />
      <Field label="School Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Academy" /></Field>
      <Field label="Address" optional><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city…" /></Field>
      <Field label="Contact" optional><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></Field>
      <Field label="Owner" optional>
        {loadingOwners
          ? <div style={{ height: 40, borderRadius: 8, backgroundColor: C.borderLight, display: 'flex', alignItems: 'center', paddingInline: 12, fontSize: 13, color: C.muted }}>Loading owners…</div>
          : <OwnerPicker selectedId={selectedOwner} currentOwner={currentOwner} availableOwners={availableOwners} onChange={setSelectedOwner} />
        }
      </Field>
      {isEdit && (
        <Field label="Status">
          <Toggle value={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive'} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Add School'} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── School card ──────────────────────────────────────────────────────────────
function SchoolCard({ school, onEdit, onBranches, onPayments }) {
  const [hov, setHov] = useState(false);
  const fee = school.total_subscription_fee
    ? `PKR ${Number(school.total_subscription_fee).toLocaleString()}`
    : null;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{school.name || '—'}</div>
        <StatusPill active={school.is_active} />
      </div>

      <div style={{ fontSize: 12, color: C.soft }}>
        <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>Owner:</span>
        {school.owner_name || <em style={{ color: C.muted }}>No owner</em>}
      </div>

      {school.school_address && (
        <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {school.school_address}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, backgroundColor: C.blueBg, color: C.blue }}>
          {school.active_branch_count ?? 0} {school.active_branch_count === 1 ? 'branch' : 'branches'}
        </span>
        {fee && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, backgroundColor: C.greenBg, color: C.green }}>
            {fee}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, paddingInline: 12, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}>
          <Pen size={11} color={C.blue} /> Edit
        </button>
        <button onClick={onBranches} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, paddingInline: 12, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? '#F0FDF4' : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.green, transition: 'background-color 0.15s' }}>
          <Branch size={11} color={C.green} /> Branches
        </button>
        <button onClick={onPayments} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, paddingInline: 12, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.yellowBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.yellow, transition: 'background-color 0.15s' }}>
          <Receipt size={11} color={C.yellow} /> Payments
        </button>
      </div>
    </div>
  );
}

// ─── SchoolsPage ──────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const navigate = useNavigate();
  const [slideOver, setSlideOver] = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } = usePageList({
    cache,
    scope:    '',
    pageSize: 20,
    buildQuery: (supabase, _scope, query, from, to) => {
      let q = supabase
        .from('schools_with_details')
        .select('id, name, school_address, school_contact, is_active, owner_id, owner_name, owner_email, active_branch_count, total_subscription_fee')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      return q;
    },
  });

  function handleSaved() {
    invalidateSchoolCache();
    setSlideOver(null);
    reload();
  }

  return (
    <div>
      <PageHeader
        greeting="Schools"
        subtitle="Manage all schools and their owners"
        actions={<ActionBtn icon={Plus} label="Add School" primary onClick={() => setSlideOver('create')} />}
      />

      <Card>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by school name…" />

        {loading ? (
          <CardGrid SkeletonCard={SkeletonCard} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyBlock search={search} emptyText="No schools yet." />
        ) : (
          <CardGrid>
            {items.map((school) => (
              <SchoolCard
                key={school.id}
                school={school}
                onEdit={() => setSlideOver(school)}
                onBranches={() => navigate(`/schools/${school.id}/branches`, { state: { schoolName: school.name } })}
                onPayments={() => navigate(`/schools/${school.id}/payments`, { state: { schoolName: school.name } })}
              />
            ))}
          </CardGrid>
        )}

        {hasMore && !loading && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <SlideOver open={!!slideOver} onClose={() => setSlideOver(null)} title={slideOver === 'create' ? 'Add School' : 'Edit School'}>
        {slideOver && (
          <SchoolForm school={slideOver === 'create' ? null : slideOver} onSave={handleSaved} onClose={() => setSlideOver(null)} />
        )}
      </SlideOver>
    </div>
  );
}
