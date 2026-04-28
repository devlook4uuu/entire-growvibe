import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C, Card, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, Toggle, SaveBtn, CancelBtn, FormError,
  SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import { invalidateSelectorSessionCache } from '../../components/shared/BranchSessionSelector';
import Plus     from '../../assets/icons/Plus';
import Pen      from '../../assets/icons/Pen';
import Calendar from '../../assets/icons/Calendar';

// ─── Module-level cache (keyed by branchId|query) ────────────────────────────
const cache = makePageCache();
export function invalidateSessionPageCache(branchId) { cache.invalidate(branchId); }

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ height: 14, width: '55%', borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 18, width: 55, borderRadius: 999, backgroundColor: C.borderLight }} />
      </div>
      <div style={{ height: 10, width: '65%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 14 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 28, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ item, onEdit }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {item.is_active && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
          )}
          <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.session_name}
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, flexShrink: 0,
          backgroundColor: item.is_active ? '#ECFDF5' : C.borderLight,
          color: item.is_active ? '#15803D' : C.muted,
        }}>
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Date range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 14px' }}>
        <Calendar size={12} color={C.muted} strokeWidth={1.8} />
        <span style={{ fontSize: 12, color: C.soft }}>
          {fmtDate(item.session_start)} — {fmtDate(item.session_end)}
        </span>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 12 }}>
        <button
          onClick={() => onEdit(item)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            backgroundColor: hov ? C.canvas : C.white, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, color: C.soft,
            transition: 'background-color 0.12s',
          }}
        >
          <Pen size={13} color={C.soft} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── Session form (inside SlideOver) ─────────────────────────────────────────
function SessionForm({ session, branchId, schoolId, onClose, onSaved }) {
  const isEdit = !!session;

  const [name,      setName]      = useState(session?.session_name  ?? '');
  const [start,     setStart]     = useState(session?.session_start ?? '');
  const [end,       setEnd]       = useState(session?.session_end   ?? '');
  const [isActive,  setIsActive]  = useState(session?.is_active     ?? true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [nameErr,   setNameErr]   = useState('');
  const [startErr,  setStartErr]  = useState('');
  const [endErr,    setEndErr]    = useState('');

  function validate() {
    let ok = true;
    setNameErr(''); setStartErr(''); setEndErr('');
    if (!name.trim() || name.trim().length < 2) { setNameErr('At least 2 characters required.'); ok = false; }
    if (!start) { setStartErr('Start date is required.'); ok = false; }
    if (!end)   { setEndErr('End date is required.'); ok = false; }
    else if (start && end < start) { setEndErr('End date must be after or equal to start date.'); ok = false; }
    return ok;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError('');

    try {
      if (!isEdit) {
        // Deactivate any currently active session for this branch first
        if (isActive) {
          await supabase
            .from('sessions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('branch_id', branchId)
            .eq('is_active', true);
        }

        const { error: err } = await supabase.from('sessions').insert({
          school_id:     schoolId,
          branch_id:     branchId,
          session_name:  name.trim(),
          session_start: start,
          session_end:   end,
          is_active:     isActive,
        });
        if (err) throw new Error(err.message);

      } else {
        // Activating — deactivate others first
        if (isActive && !session.is_active) {
          await supabase
            .from('sessions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('branch_id', session.branch_id)
            .eq('is_active', true)
            .neq('id', session.id);
        }

        const { error: err } = await supabase
          .from('sessions')
          .update({
            session_name:  name.trim(),
            session_start: start,
            session_end:   end,
            is_active:     isActive,
            updated_at:    new Date().toISOString(),
          })
          .eq('id', session.id);
        if (err) throw new Error(err.message);
      }

      // Invalidate both caches
      invalidateSessionPageCache(branchId);
      invalidateSelectorSessionCache(branchId);
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

      <Field label="Session Name" error={nameErr}>
        <TextInput
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr(''); }}
          placeholder="e.g. 2025–2026"
        />
      </Field>

      <Field label="Start Date" error={startErr}>
        <input
          type="date"
          value={start}
          onChange={(e) => { setStart(e.target.value); setStartErr(''); setEndErr(''); }}
          style={{
            width: '100%', height: 40, borderRadius: 8, fontSize: 13, color: C.ink,
            backgroundColor: C.white, outline: 'none', boxSizing: 'border-box',
            padding: '0 12px', border: `1.5px solid ${startErr ? C.red : C.border}`,
          }}
        />
      </Field>

      <Field label="End Date" error={endErr}>
        <input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(e) => { setEnd(e.target.value); setEndErr(''); }}
          style={{
            width: '100%', height: 40, borderRadius: 8, fontSize: 13, color: C.ink,
            backgroundColor: C.white, outline: 'none', boxSizing: 'border-box',
            padding: '0 12px', border: `1.5px solid ${endErr ? C.red : C.border}`,
          }}
        />
      </Field>

      <Field label="Status">
        <Toggle
          value={isActive}
          onChange={setIsActive}
          label={isActive ? 'Active' : 'Inactive'}
          hint={isActive
            ? 'Activating will deactivate any other active session for this branch.'
            : 'Session will be archived.'}
        />
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <SaveBtn loading={saving} onClick={handleSave} label={isEdit ? 'Save Changes' : 'Create Session'} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Sessions Page ────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId } = useSelector((s) => s.app);

  const schoolId = profile?.school_id;
  const branchId = selectedBranchId;

  const [slideOpen,    setSlideOpen]    = useState(false);
  const [editSession,  setEditSession]  = useState(null);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } =
    usePageList({
      cache,
      scope: branchId ?? '',
      pageSize: PAGE_SIZE,
      buildQuery: (sb, scope, query, from, to) => {
        let q = sb
          .from('sessions')
          .select('id, branch_id, school_id, session_name, session_start, session_end, is_active, created_at')
          .eq('branch_id', scope)
          .order('session_start', { ascending: false })
          .range(from, to);
        if (query) q = q.ilike('session_name', `%${query}%`);
        return q;
      },
    });

  function openCreate() { setEditSession(null); setSlideOpen(true); }
  function openEdit(s)  { setEditSession(s);    setSlideOpen(true); }
  function closeSlide() { setSlideOpen(false); setEditSession(null); }

  function handleSaved() {
    closeSlide();
    reload();
  }

  if (!branchId) {
    return (
      <div>
        <PageHeader title="Sessions" subtitle="Select a branch from the dashboard first." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <p style={{ color: C.muted, fontSize: 13 }}>No branch selected. Go to the dashboard and pick a branch.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Sessions"
        subtitle="Academic sessions for the selected branch"
        actions={<ActionBtn icon={Plus} label="New Session" primary onClick={openCreate} />}
      />

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions…" />

      {loading ? (
        <CardGrid>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </CardGrid>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyBlock
          title={search ? `No results for "${search}"` : 'No sessions yet'}
          subtitle={search ? 'Try a different search term.' : 'Create a session to get started.'}
          onClear={search ? () => setSearch('') : undefined}
        />
      ) : (
        <>
          <CardGrid>
            {items.map((s) => <SessionCard key={s.id} item={s} onEdit={openEdit} />)}
          </CardGrid>
          {hasMore && <LoadMoreBtn loading={loadingMore} onClick={loadMore} />}
        </>
      )}

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editSession ? 'Edit Session' : 'New Session'}
      >
        {slideOpen && (
          <SessionForm
            session={editSession}
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
