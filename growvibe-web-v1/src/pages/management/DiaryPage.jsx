import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { C, PageHeader } from '../dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, SaveBtn, CancelBtn, FormError,
  SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Diary from '../../assets/icons/Diary';
import Plus  from '../../assets/icons/Plus';
import Pen   from '../../assets/icons/Pen';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = makePageCache(30_000, (scope, q) => `${scope}|${q || '__all__'}`);
const PAGE_SIZE = 12;

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.borderLight, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
          <div style={{ height: 10, width: '80%', borderRadius: 6, backgroundColor: C.borderLight }} />
        </div>
      </div>
      <div style={{ height: 10, width: '35%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ height: 24, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 24, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ─── Diary Card ───────────────────────────────────────────────────────────────
function DiaryCard({ item, onEdit, onToggleExpired, toggling }) {
  const [hov, setHov] = useState(false);
  const dateExpired = isExpired(item.expire_date);
  const manualExpired = item.is_expired;
  const showExpiredBadge = dateExpired || manualExpired;
  const subjects = item.subjects || [];

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white, borderRadius: 12,
        border: `1px solid ${hov ? C.blue : C.border}`,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none',
        opacity: showExpiredBadge ? 0.7 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          backgroundColor: C.blueBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Diary size={18} color={C.blue} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: C.soft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </div>
          )}
        </div>
        {/* Expire badge */}
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flexShrink: 0,
          color:           showExpiredBadge ? C.red   : C.green,
          backgroundColor: showExpiredBadge ? C.redBg : C.greenBg,
        }}>
          {manualExpired ? 'Expired (manual)' : dateExpired ? `Expired ${fmtDate(item.expire_date)}` : `Expires ${fmtDate(item.expire_date)}`}
        </span>
      </div>

      {/* Subjects */}
      {subjects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subjects.map((s, i) => (
            <div
              key={i}
              style={{
                borderRadius: 8, padding: '8px 12px',
                backgroundColor: C.canvas,
                borderLeft: `3px solid ${C.blue}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{s.subject_name || '—'}</div>
              {s.todo && <div style={{ fontSize: 12, color: C.soft, marginTop: 2 }}>{s.todo}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: `1px solid ${C.borderLight}`,
      }}>
        <span style={{ fontSize: 11, color: C.muted }}>Created {fmtDate(item.created_at)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* is_expired toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{manualExpired ? 'Expired' : 'Active'}</span>
            <button
              onClick={() => !toggling && onToggleExpired(item)}
              title={manualExpired ? 'Mark as active' : 'Mark as expired'}
              style={{
                width: 36, height: 20, borderRadius: 999, border: 'none',
                cursor: toggling ? 'not-allowed' : 'pointer', padding: 0,
                backgroundColor: manualExpired ? C.red : C.green,
                opacity: toggling ? 0.5 : 1,
                transition: 'background-color 0.2s', position: 'relative', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2,
                left: manualExpired ? 2 : 16,
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <button
            onClick={() => onEdit(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 28, paddingInline: 10, borderRadius: 6,
              border: `1px solid ${C.border}`,
              backgroundColor: hov ? C.blueBg : C.white,
              cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue,
              transition: 'background-color 0.15s',
            }}
          >
            <Pen size={11} color={C.blue} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subject row inside the form ──────────────────────────────────────────────
function SubjectRow({ subject, index, onChange, onRemove, isOnly }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'flex-start' }}>
      <input
        placeholder="Subject name"
        value={subject.subject_name}
        onChange={(e) => onChange(index, 'subject_name', e.target.value)}
        style={{
          padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
          fontSize: 13, color: C.ink, outline: 'none', backgroundColor: C.white,
        }}
      />
      <textarea
        placeholder="Task / todo"
        value={subject.todo}
        onChange={(e) => onChange(index, 'todo', e.target.value)}
        rows={2}
        style={{
          padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
          fontSize: 13, color: C.ink, outline: 'none', resize: 'vertical',
          backgroundColor: C.white, fontFamily: 'inherit',
        }}
      />
      <button
        onClick={() => onRemove(index)}
        disabled={isOnly}
        style={{
          padding: 8, borderRadius: 8, border: `1px solid ${C.border}`,
          cursor: isOnly ? 'not-allowed' : 'pointer',
          backgroundColor: 'transparent',
          color: isOnly ? C.muted : C.red,
          opacity: isOnly ? 0.4 : 1, marginTop: 2, fontSize: 16, lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Diary form (inside SlideOver) ────────────────────────────────────────────
const EMPTY_SUBJECT = { subject_name: '', todo: '' };

function DiaryForm({ diary, classId, schoolId, branchId, profile, onSave, onClose }) {
  const isEdit = !!diary?.id;

  const [title,       setTitle]       = useState(diary?.title       || '');
  const [description, setDescription] = useState(diary?.description || '');
  const [expireDate,  setExpireDate]  = useState(diary?.expire_date  || '');
  const [subjects,    setSubjects]    = useState(
    diary?.subjects?.length ? diary.subjects : [{ ...EMPTY_SUBJECT }]
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function addSubject() { setSubjects((s) => [...s, { ...EMPTY_SUBJECT }]); }
  function updateSubject(idx, field, val) {
    setSubjects((s) => s.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  }
  function removeSubject(idx) { setSubjects((s) => s.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (!title.trim())  { setError('Title is required.'); return; }
    if (!expireDate)    { setError('Expire date is required.'); return; }
    const subs = subjects.filter((s) => s.subject_name.trim());
    setError(''); setSaving(true);
    try {
      if (isEdit) {
        const { error: err } = await supabase.from('class_diary').update({
          title: title.trim(), description: description.trim() || null,
          expire_date: expireDate, subjects: subs,
        }).eq('id', diary.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('class_diary').insert({
          school_id: schoolId, branch_id: branchId, class_id: classId,
          created_by: profile.id,
          title: title.trim(), description: description.trim() || null,
          expire_date: expireDate, subjects: subs,
        });
        if (err) throw err;
      }
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div>
      <FormError message={error} />
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily Homework — April 24" />
      </Field>
      <Field label="Description" optional>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="General notes or instructions for students…"
          rows={3}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            fontSize: 13, color: C.ink, outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: C.white,
          }}
        />
      </Field>
      <Field label="Expire Date">
        <input
          type="date"
          value={expireDate}
          min={minDate}
          onChange={(e) => setExpireDate(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            fontSize: 13, color: C.ink, outline: 'none', backgroundColor: C.white,
          }}
        />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Diary hidden from students after this date.</div>
      </Field>

      {/* Subjects */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.soft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subjects</label>
          <AddSubjectBtn onClick={addSubject} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subjects.map((s, i) => (
            <SubjectRow
              key={i} subject={s} index={i}
              onChange={updateSubject} onRemove={removeSubject}
              isOnly={subjects.length === 1}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Create Diary'} loading={saving} onClick={handleSave} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

function AddSubjectBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        borderRadius: 8, border: `1px solid ${C.border}`,
        cursor: 'pointer', fontSize: 12, fontWeight: 600,
        color: C.blue, backgroundColor: hov ? C.blueBg : 'transparent',
        transition: 'background-color 0.15s',
      }}
    >
      <Plus size={13} color={C.blue} strokeWidth={2} /> Add Subject
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const classId  = profile?.class_id;
  const schoolId = profile?.school_id;
  const branchId = profile?.branch_id;

  const [slideOpen,    setSlideOpen]    = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);   // null = create, object = edit
  const [togglingId,   setTogglingId]   = useState(null);   // id of entry being toggled
  const [showExpired,  setShowExpired]  = useState(false);

  // Encode showExpired into scope so usePageList re-fetches automatically when it changes.
  // Cache keys will be `classId:0|query` vs `classId:1|query` — separate buckets per filter.
  const scope = classId ? `${classId}:${showExpired ? 1 : 0}` : '';

  const buildQuery = useCallback((sb, sc, query, from, to) => {
    // sc is the composite scope — extract classId and showExpired flag from it
    const [cid, expiredFlag] = sc.split(':');
    const includeExpired = expiredFlag === '1';
    const today = new Date().toISOString().split('T')[0];
    let q = sb
      .from('class_diary')
      .select('id, title, description, subjects, expire_date, is_expired, created_at, created_by')
      .eq('class_id', cid)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (!includeExpired) q = q.eq('is_expired', false).gte('expire_date', today);
    if (query) q = q.ilike('title', `%${query}%`);
    return q;
  }, []);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } =
    usePageList({ cache, scope, pageSize: PAGE_SIZE, buildQuery });

  function openCreate() { setEditEntry(null); setSlideOpen(true); }
  function openEdit(entry) { setEditEntry(entry); setSlideOpen(true); }

  function invalidateBothScopes() {
    // Invalidate both filter buckets (showExpired=0 and showExpired=1)
    cache.invalidate(`${classId}:0`);
    cache.invalidate(`${classId}:1`);
  }

  function handleSaved() {
    setSlideOpen(false);
    invalidateBothScopes();
    reload();
  }

  async function handleToggleExpired(item) {
    setTogglingId(item.id);
    const { error: err } = await supabase
      .from('class_diary')
      .update({ is_expired: !item.is_expired })
      .eq('id', item.id);
    setTogglingId(null);
    if (err) return;
    invalidateBothScopes();
    reload();
  }

  // No class assigned
  if (!classId) {
    return (
      <div>
        <PageHeader greeting="Class Diary" subtitle="Manage daily diary entries for your class." />
        <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.yellowBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Diary size={24} color={C.yellow} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: 0 }}>No class assigned</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'center' }}>
            You need to be assigned as incharge teacher of a class to create diary entries.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        greeting="Class Diary"
        subtitle="Create and manage daily diary entries for your students."
        actions={<AddBtn onClick={openCreate} />}
      />

      {/* Filter + Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search diary entries…" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <FilterChip label="Include expired" active={showExpired} onClick={() => setShowExpired((v) => !v)} />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading ? (
        <CardGrid skeletonCount={6} SkeletonCard={SkeletonCard} />
      ) : items.length === 0 ? (
        <EmptyBlock search={search} emptyText="No diary entries yet. Create your first entry." />
      ) : (
        <>
          <CardGrid>
            {items.map((entry) => (
              <DiaryCard
                key={entry.id}
                item={entry}
                onEdit={openEdit}
                onToggleExpired={handleToggleExpired}
                toggling={togglingId === entry.id}
              />
            ))}
          </CardGrid>
          {hasMore && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
        </>
      )}

      {/* Create / Edit SlideOver — key forces DiaryForm to remount on each open/entry change */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editEntry ? 'Edit Diary Entry' : 'New Diary Entry'}
        width={500}
      >
        <DiaryForm
          key={editEntry?.id ?? 'new'}
          diary={editEntry}
          classId={classId}
          schoolId={schoolId}
          branchId={branchId}
          profile={profile}
          onSave={handleSaved}
          onClose={() => setSlideOpen(false)}
        />
      </SlideOver>

    </div>
  );
}

function AddBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 10, border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
        backgroundColor: hov ? '#2563EB' : C.blue,
        transition: 'background-color 0.15s',
      }}
    >
      <Plus size={15} color="#fff" strokeWidth={2} />
      New Diary Entry
    </button>
  );
}

function FilterChip({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
        fontWeight: active ? 600 : 400, border: `1px solid ${active ? C.blue : C.border}`,
        color: active ? C.blue : C.soft,
        backgroundColor: active ? C.blueBg : (hov ? C.canvas : C.white),
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
