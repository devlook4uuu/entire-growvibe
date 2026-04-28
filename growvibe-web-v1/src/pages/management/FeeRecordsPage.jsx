/**
 * FeeRecordsPage.jsx
 *
 * Per-student fee record listing page.
 * Navigated to from StudentsPage student card "Fee" button.
 *
 * URL: /fee-records?studentId=…&studentName=…&classId=…&className=…
 *
 * Shows all fee records for a student in the current session.
 * Add / Edit via slide-over.
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ─── Fire-and-forget push helper (web) ───────────────────────────────────────
async function sendPush(userIds, title, body) {
  if (!userIds || userIds.length === 0) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userIds, title, body }),
  }).catch(() => {});
}
import { C, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, SaveBtn, CancelBtn, FormError,
  CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus    from '../../assets/icons/Plus';
import Pen     from '../../assets/icons/Pen';
import Receipt from '../../assets/icons/Receipt';
import { MONTH_OPTIONS } from './StudentsPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FEE_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online' },
];

const STATUS_STYLE = {
  paid:    { color: C.green,  bg: C.greenBg,  label: 'Paid'    },
  partial: { color: C.yellow, bg: C.yellowBg, label: 'Partial' },
  unpaid:  { color: C.red,    bg: C.redBg,    label: 'Unpaid'  },
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtAmt(n) { return Number(n || 0).toLocaleString(); }

function monthLabel(val) {
  return MONTH_OPTIONS.find((o) => o.value === val)?.label ?? val;
}

function methodLabel(val) {
  return FEE_METHODS.find((m) => m.value === val)?.label ?? '';
}

// ─── Module-level cache (keyed by studentId|sessionId|query) ─────────────────
const cache = makePageCache(30_000, (scope, q) => `${scope}|${(q || '').trim().toLowerCase() || '__all__'}`);

const PAGE_SIZE = 20;

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ height: 13, width: '40%', borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 22, width: 60, borderRadius: 12, backgroundColor: C.borderLight }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div style={{ height: 9, width: '50%', borderRadius: 4, backgroundColor: C.borderLight, marginBottom: 5 }} />
            <div style={{ height: 12, width: '80%', borderRadius: 5, backgroundColor: C.borderLight }} />
          </div>
        ))}
      </div>
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 10 }} />
      <div style={{ height: 10, width: '35%', borderRadius: 5, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Fee record card ──────────────────────────────────────────────────────────
function FeeRecordCard({ item, onEdit }) {
  const [hov, setHov] = useState(false);
  const st        = STATUS_STYLE[item.payment_status] || STATUS_STYLE.unpaid;
  const remaining = Number(item.fee_amount) - Number(item.amount_paid);
  const mth       = methodLabel(item.payment_method);

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white, borderRadius: 12,
        border: `1px solid ${hov ? C.blue : C.border}`,
        padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Month + status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{monthLabel(item.month)}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '3px 10px', borderRadius: 12 }}>
          {st.label}
        </span>
      </div>

      {/* Amounts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Fee</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>PKR {fmtAmt(item.fee_amount)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Paid</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>PKR {fmtAmt(item.amount_paid)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Remaining</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: remaining > 0 ? C.red : C.green }}>PKR {fmtAmt(remaining)}</div>
        </div>
      </div>

      {/* Footer: method + edit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
        <span style={{ fontSize: 11, color: C.muted }}>{mth || '—'}</span>
        <button
          onClick={() => onEdit(item)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, paddingInline: 10, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: hov ? C.blueBg : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue, transition: 'background-color 0.15s' }}
        >
          <Pen size={11} color={C.blue} /> Edit
        </button>
      </div>

      {item.description && (
        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.description}
        </div>
      )}
    </div>
  );
}

// ─── Fee record form (inside SlideOver) ──────────────────────────────────────
function FeeRecordForm({ record, studentId, studentFee, sessionId, classId, branchId, schoolId, onSaved, onClose }) {
  const isEdit = !!record;

  const [month,       setMonth]       = useState(record?.month            ?? currentMonth());
  const [feeAmount,   setFeeAmount]   = useState(record?.fee_amount   != null ? String(record.fee_amount)  : (studentFee != null ? String(studentFee) : ''));
  const [amountPaid,  setAmountPaid]  = useState(record?.amount_paid  != null ? String(record.amount_paid) : '');
  const [payMethod,   setPayMethod]   = useState(record?.payment_method   ?? '');
  const [description, setDescription] = useState(record?.description      ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const fa        = parseFloat(feeAmount)  || 0;
  const ap        = parseFloat(amountPaid) || 0;
  const remaining = fa - ap;

  async function handleSave() {
    if (!month)               return setError('Month is required.');
    if (isNaN(fa) || fa < 0)  return setError('Enter a valid fee amount.');
    if (isNaN(ap) || ap < 0)  return setError('Enter a valid amount paid.');
    if (ap > fa)              return setError('Amount paid cannot exceed the fee amount.');
    setError(''); setSaving(true);
    try {
      const { error: err } = await supabase.rpc('upsert_fee_record', {
        p_school_id:      schoolId,
        p_branch_id:      branchId,
        p_session_id:     sessionId,
        p_class_id:       classId,
        p_student_id:     studentId,
        p_month:          month,
        p_fee_amount:     fa,
        p_amount_paid:    ap,
        p_payment_method: payMethod || null,
        p_description:    description.trim() || null,
      });
      if (err) throw new Error(err.message);
      // Notify student of new fee record (fire-and-forget, new records only)
      if (!isEdit) {
        sendPush([studentId], 'Fee Record', `${monthLabel(month)} fee record has been created`);
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormError message={error} />

      {/* Month — selector on add, read-only label on edit */}
      <Field label="Month">
        {isEdit ? (
          <div style={{ height: 40, paddingInline: 12, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.canvas, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: C.ink }}>
            {monthLabel(month)}
          </div>
        ) : (
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: '100%', height: 40, paddingInline: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, backgroundColor: C.white, outline: 'none' }}
          >
            {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </Field>

      <Field label="Fee Amount (PKR)">
        <TextInput type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g. 5000" />
      </Field>

      <Field label="Amount Paid (PKR)">
        <TextInput type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="e.g. 5000" />
      </Field>

      {feeAmount !== '' && amountPaid !== '' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.canvas, borderRadius: 8, padding: '10px 14px' }}>
          <span style={{ fontSize: 13, color: C.soft, fontWeight: 500 }}>Remaining</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: remaining > 0 ? C.red : C.green }}>
            PKR {fmtAmt(remaining)}
          </span>
        </div>
      )}

      <Field label="Payment Method (optional)">
        <select
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value)}
          style={{ width: '100%', height: 40, paddingInline: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: payMethod ? C.ink : C.muted, backgroundColor: C.white, outline: 'none' }}
        >
          <option value="">Select method…</option>
          {FEE_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>

      <Field label="Note (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Partial payment, scholarship…"
          rows={2}
          style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${C.border}`, padding: '8px 12px', fontSize: 13, color: C.ink, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <SaveBtn label={isEdit ? 'Update Record' : 'Add Record'} loading={saving} onClick={handleSave} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Fee Records Page ─────────────────────────────────────────────────────────
export default function FeeRecordsPage() {
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const studentId   = searchParams.get('studentId')   || '';
  const studentName = searchParams.get('studentName') || 'Student';
  const studentFee  = searchParams.get('studentFee');
  const classId     = searchParams.get('classId')     || '';
  const className   = searchParams.get('className')   || '';

  const schoolId  = profile?.school_id;
  const branchId  = selectedBranchId;
  const sessionId = selectedSessionId;

  // scope = studentId|sessionId so cache is isolated per student per session
  const scope = `${studentId}|${sessionId}`;

  const [slideOpen, setSlideOpen] = useState(false);
  const [editRec,   setEditRec]   = useState(null); // null = add, record = edit

  const { items, loading, loadingMore, hasMore, error, reload, loadMore } = usePageList({
    cache,
    scope,
    pageSize: PAGE_SIZE,
    buildQuery: (sb, _scope, _query, from, to) =>
      sb
        .from('student_fee_records')
        .select('*')
        .eq('student_id', studentId)
        .eq('session_id', sessionId)
        .order('month', { ascending: false })
        .range(from, to),
  });

  function openAdd()      { setEditRec(null);  setSlideOpen(true); }
  function openEdit(rec)  { setEditRec(rec);   setSlideOpen(true); }
  function closeSlide()   { setSlideOpen(false); setEditRec(null); }
  function handleSaved()  { cache.invalidate(scope); closeSlide(); reload(); }

  if (!studentId) {
    return (
      <div>
        <PageHeader greeting="Fee Records" subtitle="Open from a student card to view their fee records." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <p style={{ color: C.muted, fontSize: 13 }}>No student selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        greeting={studentName}
        subtitle={`Fee records${className ? ` · ${className}` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ height: 36, paddingInline: 14, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: C.soft }}
            >
              ← Back to Students
            </button>
            <ActionBtn icon={Plus} label="Add Record" primary onClick={openAdd} />
          </div>
        }
      />

      {loading ? (
        <CardGrid>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </CardGrid>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={24} color={C.muted} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>No fee records yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Tap "Add Record" to create the first fee record for {studentName}.</div>
        </div>
      ) : (
        <>
          <CardGrid>
            {items.map((item) => (
              <FeeRecordCard key={item.id} item={item} onEdit={openEdit} />
            ))}
          </CardGrid>
          {hasMore && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
        </>
      )}

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editRec ? `Edit — ${monthLabel(editRec.month)}` : 'Add Fee Record'}
      >
        {slideOpen && (
          <FeeRecordForm
            record={editRec}
            studentId={studentId}
            studentFee={studentFee != null ? Number(studentFee) : null}
            sessionId={sessionId}
            classId={classId}
            branchId={branchId}
            schoolId={schoolId}
            onSaved={handleSaved}
            onClose={closeSlide}
          />
        )}
      </SlideOver>
    </div>
  );
}
