import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, Card, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, Toggle, SaveBtn, CancelBtn, FormError,
  StatusPill, SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus from '../../assets/icons/Plus';
import Pen  from '../../assets/icons/Pen';

// ─── Module-level cache (keyed by schoolId|query) ─────────────────────────────
const cache = makePageCache();
export function invalidateBranchCache(schoolId) { cache.invalidate(schoolId); }

// ─── Off-days constants ───────────────────────────────────────────────────────
const ALL_DAYS = [
  { key: 'monday', label: 'Mon' }, { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' }, { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' }, { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];
const OFF_DAY_PRESETS = [
  { label: 'Fri – Sun', days: ['friday', 'saturday', 'sunday'] },
  { label: 'Sat – Sun', days: ['saturday', 'sunday'] },
  { label: 'Sun only',  days: ['sunday'] },
];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ height: 14, width: '55%', borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 18, width: 55, borderRadius: 999, backgroundColor: C.borderLight }} />
      </div>
      <div style={{ height: 10, width: '40%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 8 }} />
      <div style={{ height: 10, width: '60%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 14 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 28, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Off-days picker ──────────────────────────────────────────────────────────
function OffDaysPicker({ selected, onChange }) {
  function toggleDay(key) {
    onChange(selected.includes(key) ? selected.filter((d) => d !== key) : [...selected, key]);
  }
  function applyPreset(days) {
    const same = days.length === selected.length && days.every((d) => selected.includes(d));
    onChange(same ? [] : [...days]);
  }
  const DAY_NAMES = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };
  const summary = selected.length === 0 ? 'No off days' : selected.map((d) => DAY_NAMES[d]).join(', ');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {OFF_DAY_PRESETS.map((preset) => {
          const active = preset.days.length === selected.length && preset.days.every((d) => selected.includes(d));
          return (
            <button key={preset.label} type="button" onClick={() => applyPreset(preset.days)}
              style={{ height: 30, paddingInline: 12, borderRadius: 6, fontSize: 12, fontWeight: 500, border: `1.5px solid ${active ? C.blue : C.border}`, backgroundColor: active ? C.blueBg : C.white, color: active ? C.blue : C.soft, cursor: 'pointer' }}
            >{preset.label}</button>
          );
        })}
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            style={{ height: 30, paddingInline: 12, borderRadius: 6, fontSize: 12, fontWeight: 500, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, cursor: 'pointer' }}
          >Clear</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ALL_DAYS.map(({ key, label }) => {
          const on = selected.includes(key);
          return (
            <button key={key} type="button" onClick={() => toggleDay(key)}
              style={{ height: 32, width: 44, borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${on ? '#EA580C' : C.border}`, backgroundColor: on ? '#FFF7ED' : C.white, color: on ? '#EA580C' : C.soft, cursor: 'pointer' }}
            >{label}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{summary}</div>
    </div>
  );
}

// ─── Branch form ──────────────────────────────────────────────────────────────
function BranchForm({ schoolId, branch, onSave, onClose }) {
  const isEdit = !!branch;
  const [name,     setName]     = useState(branch?.name               || '');
  const [address,  setAddress]  = useState(branch?.branch_address     || '');
  const [contact,  setContact]  = useState(branch?.branch_contact     || '');
  const [fee,      setFee]      = useState(branch?.branch_subscription_fee != null ? String(branch.branch_subscription_fee) : '');
  const [isActive, setIsActive] = useState(branch?.is_active ?? true);
  const [offDays,  setOffDays]  = useState(() => Array.isArray(branch?.off_days) ? branch.off_days : []);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function handleSubmit() {
    if (!name.trim()) return setError('Branch name is required.');
    setError(''); setSaving(true);
    try {
      if (!isEdit) {
        const { data: newBranch, error: insertErr } = await supabase.from('branches')
          .insert({ school_id: schoolId, name: name.trim(), branch_address: address || null, branch_contact: contact || null, branch_subscription_fee: Number(fee) || 0, is_active: isActive })
          .select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        if (offDays.length > 0) {
          const { error: offErr } = await supabase.from('branch_off_days')
            .insert(offDays.map((day) => ({ branch_id: newBranch.id, school_id: schoolId, day_of_week: day })));
          if (offErr) throw new Error(offErr.message);
        }
      } else {
        const { error: updateErr } = await supabase.from('branches')
          .update({ name: name.trim(), branch_address: address || null, branch_contact: contact || null, branch_subscription_fee: Number(fee) || 0, is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', branch.id);
        if (updateErr) throw new Error(updateErr.message);
        const { error: delErr } = await supabase.from('branch_off_days').delete().eq('branch_id', branch.id);
        if (delErr) throw new Error(delErr.message);
        if (offDays.length > 0) {
          const { error: offErr } = await supabase.from('branch_off_days')
            .insert(offDays.map((day) => ({ branch_id: branch.id, school_id: schoolId, day_of_week: day })));
          if (offErr) throw new Error(offErr.message);
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
      <Field label="Branch Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Campus" /></Field>
      <Field label="Address" optional><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city…" /></Field>
      <Field label="Contact" optional><TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></Field>
      <Field label="Monthly Fee (PKR)" optional><TextInput value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" /></Field>
      <Field label="Off Days" optional><OffDaysPicker selected={offDays} onChange={setOffDays} /></Field>
      {isEdit && (
        <Field label="Status">
          <Toggle value={isActive} onChange={setIsActive} label={isActive ? 'Active' : 'Inactive'} />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Add Branch'} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Branch card ──────────────────────────────────────────────────────────────
function BranchCard({ branch, onEdit }) {
  const [hov, setHov] = useState(false);
  const offDays = Array.isArray(branch.off_days) ? branch.off_days : [];
  const fee = branch.branch_subscription_fee
    ? `PKR ${Number(branch.branch_subscription_fee).toLocaleString()}`
    : null;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{branch.name || '—'}</div>
        <StatusPill active={branch.is_active} />
      </div>

      {branch.branch_address && (
        <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.branch_address}</div>
      )}

      {fee && (
        <div style={{ fontSize: 12, color: C.soft }}>
          <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>Fee:</span>{fee}
        </div>
      )}

      {offDays.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {offDays.map((d) => (
            <span key={d} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#FFF7ED', color: '#EA580C' }}>
              {DAY_LABELS[d] || d}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}>
          <Pen size={11} color={C.blue} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── BranchesPage ─────────────────────────────────────────────────────────────
export default function BranchesPage() {
  const { schoolId } = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();
  const schoolName   = location.state?.schoolName || 'School';
  const [slideOver, setSlideOver] = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } = usePageList({
    cache,
    scope:    schoolId,
    pageSize: 20,
    buildQuery: (supabase, scope, query, from, to) => {
      let q = supabase
        .from('branches_with_off_days')
        .select('id, school_id, name, branch_address, branch_contact, branch_subscription_fee, is_active, off_days')
        .eq('school_id', scope)
        .order('name', { ascending: true })
        .range(from, to);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      return q;
    },
  });

  function handleSaved() {
    invalidateBranchCache(schoolId);
    setSlideOver(null);
    reload();
  }

  return (
    <div>
      <PageHeader
        greeting="Branches"
        subtitle={schoolName}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('/schools')} style={{ height: 36, paddingInline: 16, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.soft, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              ← Back to Schools
            </button>
            <ActionBtn icon={Plus} label="Add Branch" primary onClick={() => setSlideOver('create')} />
          </div>
        }
      />

      <Card>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by branch name…" />

        {loading ? (
          <CardGrid SkeletonCard={SkeletonCard} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyBlock search={search} emptyText="No branches yet. Add one to get started." />
        ) : (
          <CardGrid>
            {items.map((branch) => (
              <BranchCard key={branch.id} branch={branch} onEdit={() => setSlideOver(branch)} />
            ))}
          </CardGrid>
        )}

        {hasMore && !loading && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <SlideOver open={!!slideOver} onClose={() => setSlideOver(null)} title={slideOver === 'create' ? 'Add Branch' : 'Edit Branch'}>
        {slideOver && (
          <BranchForm schoolId={schoolId} branch={slideOver === 'create' ? null : slideOver} onSave={handleSaved} onClose={() => setSlideOver(null)} />
        )}
      </SlideOver>
    </div>
  );
}
