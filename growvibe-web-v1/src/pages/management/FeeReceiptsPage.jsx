/**
 * FeeReceiptsPage.jsx
 *
 * Flow:
 *   1. Select class (dropdown)
 *   2. Select month (dropdown)
 *   3. Shows only students who HAVE a fee record for that month
 *   4. Multiselect checkboxes on each card (Select All / deselect)
 *   5. Print selected receipts — 4-per-page, school-branded, compact
 *
 * Roles: owner, principal, coordinator
 */

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C, PageHeader } from '../dashboard/AdminDashboard';
import { MONTH_OPTIONS } from './StudentsPage';
import Receipt from '../../assets/icons/Receipt';

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

function monthLabel(ym) {
  return MONTH_OPTIONS.find((o) => o.value === ym)?.label ?? ym;
}

function fmtAmt(n) { return Number(n || 0).toLocaleString(); }

function methodLabel(val) {
  return FEE_METHODS.find((m) => m.value === val)?.label || '';
}

// ─── Receipt Card (screen) ────────────────────────────────────────────────────
function FeeCard({ row, selected, onToggle }) {
  const status    = STATUS_STYLE[row.payment_status] || STATUS_STYLE.unpaid;
  const remaining = Number(row.fee_amount) - Number(row.amount_paid);
  const initials  = (row.student_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      onClick={() => onToggle(row.student_id)}
      style={{
        backgroundColor: C.white,
        borderRadius: 12,
        border: `2px solid ${selected ? C.blue : C.border}`,
        padding: 16,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Checkbox top-right */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        width: 18, height: 18, borderRadius: 5,
        border: `2px solid ${selected ? C.blue : C.border}`,
        backgroundColor: selected ? C.blue : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Student info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 28 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          backgroundColor: C.blueBg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.blue,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.student_name || '—'}
          </div>
          <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.student_email || ''}
          </div>
        </div>
      </div>

      {/* Status */}
      <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: status.color, backgroundColor: status.bg, padding: '2px 10px', borderRadius: 12 }}>
        {status.label}
      </span>

      {/* Fee rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <MiniRow label="Fee"       value={`PKR ${fmtAmt(row.fee_amount)}`} />
        <MiniRow label="Paid"      value={`PKR ${fmtAmt(row.amount_paid)}`} />
        <MiniRow label="Remaining" value={`PKR ${fmtAmt(remaining)}`} color={remaining > 0 ? C.red : C.green} />
        {row.payment_method && <MiniRow label="Method" value={methodLabel(row.payment_method)} />}
      </div>

      {row.description && (
        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.description}
        </div>
      )}
    </div>
  );
}

function MiniRow({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || C.ink }}>{value}</div>
    </div>
  );
}

// ─── Print area (hidden) ───────────────────────────────────────────────────────
// Each row is a flat object from fee_records_with_details view.
// school_name, school_logo_url, student_name, student_email, class_name all
// come from the row itself — no separate fetch needed.
function PrintArea({ rows, month }) {
  if (!rows.length) return null;

  const mLabel   = monthLabel(month);
  const issuedOn = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div id="print-area" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '100%' }}>
      <style>{`
        @page { margin: 8mm; size: A4; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        #print-area {
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color: #111;
        }

        .pr-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5mm;
        }

        /* ── Card ── */
        .pr-card {
          border: 1.5px solid #222;
          border-radius: 10px;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
          background: #fff;
        }

        /* ── Header: solid dark bar ── */
        .pr-header {
          background: #111;
          padding: 12px 14px;
        }
        /* school name + receipt title on same row, space-between */
        .pr-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .pr-school-block {
          display: flex;
          align-items: flex-start;
          gap: 9px;
        }
        .pr-logo-box {
          width: 34px; height: 34px;
          border-radius: 7px;
          background: #333;
          border: 1.5px solid #555;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 900; color: #fff;
          flex-shrink: 0;
        }
        .pr-logo-img {
          width: 34px; height: 34px;
          border-radius: 7px;
          object-fit: contain;
          background: #333;
          border: 1.5px solid #555;
          flex-shrink: 0;
        }
        /* school name — no nowrap, no ellipsis, just wraps */
        .pr-school-name {
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          line-height: 1.25;
          margin-top: 1px;
          max-width: 130px;
        }
        .pr-school-sub {
          font-size: 8px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          margin-top: 3px;
        }

        /* right side of header: receipt type + month */
        .pr-receipt-block {
          text-align: right;
          flex-shrink: 0;
        }
        .pr-receipt-title {
          font-size: 10px;
          font-weight: 900;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .pr-receipt-month {
          font-size: 9px;
          color: #aaa;
          margin-top: 2px;
          font-weight: 500;
        }

        /* thin white divider line inside header */
        .pr-header-divider {
          height: 1px;
          background: #333;
          margin: 10px 0 0;
        }

        /* ── Student row ── */
        .pr-student {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-bottom: 1px solid #e5e5e5;
          background: #f9f9f9;
        }
        .pr-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: #ddd;
          border: 1.5px solid #bbb;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 900; color: #333;
          flex-shrink: 0;
        }
        .pr-student-name {
          font-size: 13px; font-weight: 800; color: #111;
          line-height: 1.2;
        }
        .pr-student-meta {
          font-size: 8.5px; color: #666; margin-top: 2px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* ── Body ── */
        .pr-body { padding: 10px 14px 12px; }

        /* fee table */
        .pr-table { width: 100%; border-collapse: collapse; margin-bottom: 9px; }
        .pr-table td { padding: 5px 0; border-bottom: 1px solid #eee; vertical-align: middle; }
        .pr-table tr:last-child td { border-bottom: none; }
        .pr-td-label {
          font-size: 9px; color: #888; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.4px;
          width: 48%;
        }
        .pr-td-value { font-size: 12px; font-weight: 700; color: #111; text-align: right; }

        /* balance box */
        .pr-balance {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1.5px solid #222;
          border-radius: 7px;
          padding: 8px 11px;
          margin-bottom: 9px;
          background: #f5f5f5;
        }
        .pr-balance-label { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
        .pr-balance-amount { font-size: 15px; font-weight: 900; color: #111; letter-spacing: -0.5px; }

        /* note */
        .pr-note {
          font-size: 8px; color: #666; font-style: italic;
          padding: 4px 8px;
          border-left: 2px solid #ccc;
          margin-bottom: 9px;
          background: #fafafa;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pr-note strong { font-style: normal; color: #333; }

        /* footer */
        .pr-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px dashed #bbb;
        }
        .pr-issued { font-size: 7.5px; color: #888; }
        .pr-issued strong { color: #444; font-weight: 700; }
        .pr-sig-wrap { text-align: center; }
        .pr-sig-line { width: 68px; height: 1px; background: #999; margin: 0 auto 2px; }
        .pr-sig-text { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }

        /* status stamp */
        .pr-stamp {
          font-size: 7.5px; font-weight: 900;
          padding: 2px 9px; border-radius: 20px;
          letter-spacing: 1px; text-transform: uppercase;
          border: 1.5px solid #555;
          color: #111;
          background: #eee;
          flex-shrink: 0;
        }
      `}</style>

      <div className="pr-grid">
        {rows.map((row) => {
          const remaining     = Number(row.fee_amount) - Number(row.amount_paid);
          const statusLabel   = STATUS_STYLE[row.payment_status]?.label || row.payment_status;
          const mth           = methodLabel(row.payment_method);
          const initials      = (row.student_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
          const schoolInitial = (row.school_name || 'S').charAt(0).toUpperCase();

          return (
            <div key={row.id} className="pr-card">

              {/* ── Header ── */}
              <div className="pr-header">
                <div className="pr-header-row">
                  {/* School logo + name — left side */}
                  <div className="pr-school-block">
                    {row.school_logo_url
                      ? <img src={row.school_logo_url} alt="" className="pr-logo-img" />
                      : <div className="pr-logo-box">{schoolInitial}</div>
                    }
                    <div>
                      <div className="pr-school-name">{row.school_name || '—'}</div>
                      <div className="pr-school-sub">Official Fee Receipt</div>
                    </div>
                  </div>
                  {/* Receipt type + month — right side */}
                  <div className="pr-receipt-block">
                    <div className="pr-receipt-title">Fee Receipt</div>
                    <div className="pr-receipt-month">{mLabel}</div>
                  </div>
                </div>
                <div className="pr-header-divider" />
              </div>

              {/* ── Student ── */}
              <div className="pr-student">
                <div className="pr-avatar">{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pr-student-name">{row.student_name || '—'}</div>
                  <div className="pr-student-meta">
                    Class: {row.class_name || '—'}{row.student_email ? `  ·  ${row.student_email}` : ''}
                  </div>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="pr-body">

                <table className="pr-table">
                  <tbody>
                    <tr>
                      <td className="pr-td-label">Monthly Fee</td>
                      <td className="pr-td-value">PKR {fmtAmt(row.fee_amount)}</td>
                    </tr>
                    <tr>
                      <td className="pr-td-label">Amount Paid</td>
                      <td className="pr-td-value">PKR {fmtAmt(row.amount_paid)}</td>
                    </tr>
                    {mth && (
                      <tr>
                        <td className="pr-td-label">Payment Via</td>
                        <td className="pr-td-value">{mth}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="pr-balance">
                  <span className="pr-balance-label">Balance Due</span>
                  <span className="pr-balance-amount">PKR {fmtAmt(Math.max(0, remaining))}</span>
                </div>

                {row.description && (
                  <div className="pr-note"><strong>Note:</strong> {row.description}</div>
                )}

                <div className="pr-footer">
                  <div className="pr-issued">Issued: <strong>{issuedOn}</strong></div>
                  <div className="pr-sig-wrap">
                    <div className="pr-sig-line" />
                    <div className="pr-sig-text">Authorised Signature</div>
                  </div>
                  <div className="pr-stamp">{statusLabel}</div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeeReceiptsPage() {
  const profile = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);

  const branchId  = selectedBranchId;
  const sessionId = selectedSessionId;

  // ── Selectors ─────────────────────────────────────────────────────────────
  const [classes,        setClasses]        = useState([]);
  const [selectedClass,  setSelectedClass]  = useState('');
  const [selectedMonth,  setSelectedMonth]  = useState(currentMonth());
  const [classesLoading, setClassesLoading] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  // Each row is one flat object from fee_records_with_details view.
  // Fields: all sfr columns + school_name, school_logo_url, student_name,
  //         student_email, student_avatar_url, class_name
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(new Set()); // Set of student_id

  // ── Fetch classes ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !branchId) return;
    setClassesLoading(true);
    supabase
      .from('classes')
      .select('id, class_name')
      .eq('session_id', sessionId)
      .eq('branch_id', branchId)
      .order('class_name', { ascending: true })
      .then(({ data }) => {
        setClassesLoading(false);
        const list = data || [];
        setClasses(list);
        if (list.length > 0) setSelectedClass(list[0].id);
      });
  }, [sessionId, branchId]);

  // ── Fetch from view (one query — all data including school name) ──────────
  const loadData = useCallback(async () => {
    if (!selectedClass || !selectedMonth || !sessionId) { setRows([]); return; }
    setLoading(true);
    setError(null);
    setSelected(new Set());

    const { data, error: err } = await supabase
      .from('fee_records_with_details')
      .select('*')
      .eq('class_id', selectedClass)
      .eq('session_id', sessionId)
      .eq('month', selectedMonth)
      .order('student_name', { ascending: true });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setRows(data || []);
  }, [selectedClass, selectedMonth, sessionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function toggleOne(studentId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  }

  function selectAll()   { setSelected(new Set(rows.map((r) => r.student_id))); }
  function deselectAll() { setSelected(new Set()); }

  const allSelected  = rows.length > 0 && selected.size === rows.length;
  const noneSelected = selected.size === 0;

  // ── Print ─────────────────────────────────────────────────────────────────
  function handlePrint() {
    const style = document.createElement('style');
    style.id = '__fee-print-style__';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  }

  const selectedRows   = rows.filter((r) => selected.has(r.student_id));
  const selectedClass_ = classes.find((c) => c.id === selectedClass);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!sessionId || !branchId) {
    return (
      <div>
        <PageHeader greeting="Fee Receipts" subtitle="Select a class and month to view fee records." />
        <div style={{ textAlign: 'center', paddingTop: 60, color: C.muted, fontSize: 14 }}>
          Please select a branch and session from the dashboard first.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader greeting="Fee Receipts" subtitle="Select a class and month to view and print fee records." />

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          disabled={classesLoading}
          style={{ height: 36, paddingInline: 10, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, fontSize: 13, color: selectedClass ? C.ink : C.muted, cursor: 'pointer', outline: 'none', minWidth: 160 }}
        >
          <option value="">Select class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ height: 36, paddingInline: 10, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, fontSize: 13, color: C.ink, cursor: 'pointer', outline: 'none', minWidth: 170 }}
        >
          {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, height: 160 }}>
              <div style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 10 }} />
              <div style={{ height: 10, width: '80%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 8 }} />
              <div style={{ height: 10, width: '45%', borderRadius: 6, backgroundColor: C.borderLight }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', paddingTop: 40, color: C.red, fontSize: 14 }}>{error}</div>
      ) : !selectedClass ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Select a class</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Choose a class above to see fee records for the selected month.</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>No fee records</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            No fee records found for <strong>{selectedClass_?.class_name}</strong> in <strong>{monthLabel(selectedMonth)}</strong>.
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Go to Students page and use the Fee button on each student card to add records.</div>
        </div>
      ) : (
        <>
          {/* ── Selection toolbar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={allSelected ? deselectAll : selectAll}
                style={{
                  width: 18, height: 18, borderRadius: 5, cursor: 'pointer',
                  border: `2px solid ${allSelected ? C.blue : C.border}`,
                  backgroundColor: allSelected ? C.blue : C.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {allSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {!allSelected && selected.size > 0 && (
                  <div style={{ width: 8, height: 2, backgroundColor: C.blue, borderRadius: 1 }} />
                )}
              </div>
              <span style={{ fontSize: 13, color: C.soft }}>
                {noneSelected
                  ? `${rows.length} record${rows.length !== 1 ? 's' : ''} — select to print`
                  : `${selected.size} of ${rows.length} selected`}
              </span>
            </div>

            {!noneSelected && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={deselectAll}
                  style={{ height: 32, paddingInline: 12, borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.soft }}
                >
                  Deselect All
                </button>
                <button
                  onClick={handlePrint}
                  style={{ height: 32, paddingInline: 14, borderRadius: 7, border: 'none', backgroundColor: C.blue, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.white, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Receipt size={13} color={C.white} />
                  Print {selected.size} Receipt{selected.size !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>

          {/* ── Cards grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {rows.map((row) => (
              <FeeCard
                key={row.id}
                row={row}
                selected={selected.has(row.student_id)}
                onToggle={toggleOne}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Hidden print area ── */}
      <PrintArea rows={selectedRows} month={selectedMonth} />
    </div>
  );
}
