import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, Card, PageHeader, ActionBtn } from '../dashboard/AdminDashboard';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, SaveBtn, CancelBtn, FormError,
  SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Plus from '../../assets/icons/Plus';
import Pen  from '../../assets/icons/Pen';

// ─── Module-level cache (keyed by schoolId|query) ─────────────────────────────
const cache = makePageCache();
export function invalidatePaymentCache(schoolId) { cache.invalidate(schoolId); }

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { key: 'cash',          label: 'Cash' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
  { key: 'cheque',        label: 'Cheque' },
  { key: 'online',        label: 'Online' },
];

const PAYMENT_STATUSES = [
  { key: 'paid',    label: 'Paid',    color: C.green,  bg: C.greenBg },
  { key: 'partial', label: 'Partial', color: C.yellow, bg: C.yellowBg },
  { key: 'unpaid',  label: 'Unpaid',  color: C.red,    bg: C.redBg },
];

function statusStyle(s) {
  return PAYMENT_STATUSES.find((p) => p.key === s) || { color: C.muted, bg: C.canvas, label: s };
}

function fmtPKR(n) {
  return 'PKR ' + Number(n ?? 0).toLocaleString();
}

// ─── Status pill (payment-specific) ──────────────────────────────────────────
function PaymentStatusPill({ status }) {
  const st = statusStyle(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, backgroundColor: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: st.color }} />
      {st.label}
    </span>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ height: 14, width: '40%', borderRadius: 6, backgroundColor: C.borderLight }} />
        <div style={{ height: 18, width: 55, borderRadius: 999, backgroundColor: C.borderLight }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[1,2,3].map((i) => <div key={i} style={{ height: 40, flex: 1, borderRadius: 8, backgroundColor: C.borderLight }} />)}
      </div>
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 12 }} />
      <div style={{ height: 28, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
    </div>
  );
}

// ─── Chip selector ────────────────────────────────────────────────────────────
function ChipSelector({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active      = value === o.key;
        const activeColor = o.color || C.blue;
        const activeBg    = o.bg    || C.blueBg;
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, paddingInline: 14, borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${active ? activeColor : C.border}`, backgroundColor: active ? activeBg : C.white, color: active ? activeColor : C.soft, transition: 'all 0.15s' }}
          >
            {o.color && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: active ? o.color : C.muted }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Payment form ─────────────────────────────────────────────────────────────
function PaymentForm({ schoolId, payment, onSave, onClose }) {
  const isEdit = !!payment;
  const [month,       setMonth]       = useState(payment?.payment_month       || '');
  const [fee,         setFee]         = useState(payment?.fee != null          ? String(payment.fee)           : '');
  const [amountPaid,  setAmountPaid]  = useState(payment?.amount_paid != null  ? String(payment.amount_paid)   : '');
  const [remaining,   setRemaining]   = useState(payment?.remaining_due != null ? String(payment.remaining_due) : '');
  const [method,      setMethod]      = useState(payment?.payment_method  || 'cash');
  const [status,      setStatus]      = useState(payment?.payment_status  || 'unpaid');
  const [description, setDescription] = useState(payment?.payment_description || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function handleFeeChange(val) {
    setFee(val);
    const f = Number(val) || 0;
    const p = Number(amountPaid) || 0;
    setRemaining(String(Math.max(0, f - p)));
  }
  function handleAmountPaidChange(val) {
    setAmountPaid(val);
    const f = Number(fee) || 0;
    const p = Number(val) || 0;
    setRemaining(String(Math.max(0, f - p)));
    if (p === 0) setStatus('unpaid');
    else if (p >= f && f > 0) setStatus('paid');
    else setStatus('partial');
  }

  async function handleSubmit() {
    if (!month.trim()) return setError('Payment month is required.');
    if (fee === '' || isNaN(Number(fee))) return setError('Enter a valid fee.');
    setError(''); setSaving(true);
    try {
      const record = {
        school_id: schoolId, payment_month: month.trim(),
        fee: Number(fee) || 0, amount_paid: Number(amountPaid) || 0,
        remaining_due: Number(remaining) || 0,
        payment_method: method || null, payment_status: status,
        payment_description: description.trim() || null,
      };
      if (!isEdit) {
        const { error: err } = await supabase.from('subscription_payments').insert(record);
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await supabase.from('subscription_payments')
          .update({ ...record, updated_at: new Date().toISOString() }).eq('id', payment.id);
        if (err) throw new Error(err.message);
      }
      invalidatePaymentCache(schoolId);
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <FormError message={error} />
      <Field label="Payment Month"><TextInput value={month} onChange={(e) => setMonth(e.target.value)} placeholder="e.g. April 2026" /></Field>
      <Field label="Total Fee (PKR)"><TextInput value={fee} onChange={(e) => handleFeeChange(e.target.value)} placeholder="0" /></Field>
      <Field label="Amount Paid (PKR)"><TextInput value={amountPaid} onChange={(e) => handleAmountPaidChange(e.target.value)} placeholder="0" /></Field>
      <Field label="Remaining Due (PKR)"><TextInput value={remaining} onChange={(e) => setRemaining(e.target.value)} placeholder="0" /></Field>
      <Field label="Payment Method"><ChipSelector options={PAYMENT_METHODS} value={method} onChange={setMethod} /></Field>
      <Field label="Payment Status"><ChipSelector options={PAYMENT_STATUSES} value={status} onChange={setStatus} /></Field>
      <Field label="Description" optional><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any notes about this payment…" /></Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Add Payment'} loading={saving} onClick={handleSubmit} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Payment card ─────────────────────────────────────────────────────────────
function PaymentCard({ payment, onEdit }) {
  const [hov, setHov] = useState(false);
  const methodLabel = PAYMENT_METHODS.find((m) => m.key === payment.payment_method)?.label;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${hov ? C.blue : C.border}`, padding: 16, transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{payment.payment_month || '—'}</div>
        <PaymentStatusPill status={payment.payment_status} />
      </div>

      <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {[
          { label: 'Fee',  value: fmtPKR(payment.fee),           color: C.ink },
          { label: 'Paid', value: fmtPKR(payment.amount_paid),   color: C.green },
          { label: 'Due',  value: fmtPKR(payment.remaining_due), color: Number(payment.remaining_due) > 0 ? C.red : C.muted },
        ].map((item, i) => (
          <div key={item.label} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', backgroundColor: C.canvas }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {methodLabel && (
        <div style={{ fontSize: 12, color: C.soft }}>
          <span style={{ color: C.muted, fontWeight: 500, marginRight: 4 }}>Method:</span>{methodLabel}
        </div>
      )}

      {payment.payment_description && (
        <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {payment.payment_description}
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

// ─── PaymentsPage ─────────────────────────────────────────────────────────────
export default function PaymentsPage() {
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
        .from('subscription_payments')
        .select('id, school_id, payment_month, fee, amount_paid, remaining_due, payment_method, payment_status, payment_description, created_at')
        .eq('school_id', scope)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (query.trim()) q = q.ilike('payment_month', `%${query.trim()}%`);
      return q;
    },
  });

  function handleSaved() {
    setSlideOver(null);
    reload();
  }

  return (
    <div>
      <PageHeader
        greeting="Payments"
        subtitle={schoolName}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => navigate('/schools')} style={{ height: 36, paddingInline: 16, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.soft, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              ← Back to Schools
            </button>
            <ActionBtn icon={Plus} label="Add Payment" primary onClick={() => setSlideOver('create')} />
          </div>
        }
      />

      <Card>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by month…" />

        {loading ? (
          <CardGrid SkeletonCard={SkeletonCard} />
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyBlock search={search} emptyText="No payments recorded yet." />
        ) : (
          <CardGrid>
            {items.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} onEdit={() => setSlideOver(payment)} />
            ))}
          </CardGrid>
        )}

        {hasMore && !loading && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <SlideOver open={!!slideOver} onClose={() => setSlideOver(null)} title={slideOver === 'create' ? 'Add Payment' : 'Edit Payment'} width={460}>
        {slideOver && (
          <PaymentForm schoolId={schoolId} payment={slideOver === 'create' ? null : slideOver} onSave={handleSaved} onClose={() => setSlideOver(null)} />
        )}
      </SlideOver>
    </div>
  );
}
