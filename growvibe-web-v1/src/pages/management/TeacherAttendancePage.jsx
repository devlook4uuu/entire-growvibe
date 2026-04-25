/**
 * TeacherAttendancePage.jsx
 *
 * Calendar view of a teacher's attendance for a session.
 * Route: /teacher-attendance?teacherId=…&teacherName=…&sessionId=…
 *
 * Managers (owner/principal/coordinator): can click any past day to mark/edit.
 * Teacher role: read-only.
 *
 * The page resolves sessionId from the teacher's class if not in the URL.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, PageHeader, useBreakpoint } from '../dashboard/AdminDashboard';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLOR  = { present: '#22C55E', absent: '#EF4444', late: '#F59E0B', leave: '#8B5CF6' };
const STATUS_BG     = { present: '#ECFDF5', absent: '#FEF2F2', late: '#FFFBEB', leave: '#F5F3FF' };
const STATUS_LABEL  = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'Leave' };
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];
const MONTH_NAMES   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TTL   = 60_000;
const cache = {};
function cacheKey(tid, sid, y, m) { return `${tid}|${sid}|${y}-${String(m+1).padStart(2,'0')}`; }
function isFresh(k) { return cache[k] && Date.now() - cache[k].ts < TTL; }

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m)    { return new Date(y, m, 1).getDay(); }
function toStr(y, m, d)       { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

// ─── Mark Modal ───────────────────────────────────────────────────────────────
function MarkModal({ date, record, onSave, onClose, saving }) {
  const [status, setStatus] = useState(record?.status || 'present');
  const displayDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div style={{ backgroundColor: C.white, borderRadius: 16, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{record ? 'Edit Attendance' : 'Mark Attendance'}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{displayDate}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: C.muted, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                backgroundColor: status === s ? STATUS_COLOR[s] : STATUS_BG[s],
                color: status === s ? '#fff' : STATUS_COLOR[s],
                transition: 'all 0.15s',
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onSave(status)}
            disabled={saving}
            style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', backgroundColor: C.blue, color: '#fff', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{ height: 38, paddingInline: 16, borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.ink, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, recordsByDate, canEdit, onDayClick, todayStr }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.muted, padding: '6px 0' }}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const dateStr  = toStr(year, month, day);
          const record   = recordsByDate[dateStr];
          const isToday  = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          const bg    = record ? STATUS_BG[record.status]    : (isFuture ? 'transparent' : '#F8FAFC');
          const color = record ? STATUS_COLOR[record.status] : '#94A3B8';
          const border = isToday ? `2px solid ${C.blue}` : `1px solid ${record ? STATUS_COLOR[record.status] + '40' : C.borderLight}`;

          return (
            <div
              key={dateStr}
              onClick={() => canEdit && !isFuture && onDayClick(dateStr, record)}
              style={{
                backgroundColor: bg, border, borderRadius: 8,
                padding: '6px 4px', textAlign: 'center',
                cursor: canEdit && !isFuture ? 'pointer' : 'default',
                minHeight: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                transition: 'box-shadow 0.12s',
              }}
              onMouseEnter={(e) => { if (canEdit && !isFuture) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? C.blue : C.ink }}>{day}</span>
              {record && (
                <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[record.status] }}>
                  {STATUS_LABEL[record.status].slice(0, 3)}
                </span>
              )}
              {!record && !isFuture && (
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherAttendancePage() {
  const bp = useBreakpoint();
  const navigate     = useNavigate();
  const profile      = useSelector((s) => s.auth.profile);
  const [searchParams] = useSearchParams();
  const teacherId      = searchParams.get('teacherId')   || '';
  const teacherName    = searchParams.get('teacherName') || 'Teacher';
  const paramSessionId = searchParams.get('sessionId')  || '';
  const paramBranchId  = searchParams.get('branchId')   || '';
  const paramSchoolId  = searchParams.get('schoolId')   || '';

  const canEdit = ['owner', 'principal', 'coordinator'].includes(profile?.role);

  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [branchId,  setBranchId]  = useState(paramBranchId  || profile?.branch_id || null);
  const schoolId = paramSchoolId || profile?.school_id || null;
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const today = new Date();
  const todayStr = (() => {
    const d = today;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [modal, setModal]   = useState(null); // { date, record }
  const [saving, setSaving] = useState(false);

  // Resolve sessionId (and branchId if missing) from teacher's class
  useEffect(() => {
    if ((paramSessionId && paramBranchId) || !teacherId) return;
    supabase
      .from('classes').select('session_id, branch_id').eq('teacher_id', teacherId).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id && !paramSessionId) setSessionId(data.session_id);
        if (data?.branch_id  && !branchId)       setBranchId(data.branch_id);
      });
  }, [teacherId, paramSessionId, paramBranchId]);

  const fetchRecords = useCallback(async (force = false) => {
    if (!teacherId || !sessionId) return;
    const key = cacheKey(teacherId, sessionId, viewYear, viewMonth);
    if (!force && isFresh(key)) { setRecords(cache[key].records); setLoading(false); return; }

    const monthStart = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`;
    const lastDay    = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthEnd   = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    setLoading(true); setError('');
    try {
      const { data, error: err } = await supabase
        .from('attendance')
        .select('*')
        .eq('person_id', teacherId)
        .eq('role', 'teacher')
        .eq('session_id', sessionId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (err) throw err;
      const list = data || [];
      cache[key] = { records: list, ts: Date.now() };
      setRecords(list);
    } catch (e) {
      setError(e.message || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  }, [teacherId, sessionId, viewYear, viewMonth]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const recordsByDate = {};
  for (const r of records) recordsByDate[r.date] = r;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewYear === today.getFullYear() && viewMonth >= today.getMonth()) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }
  const atCurrent = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  async function handleSave(status) {
    if (!modal || !schoolId || !branchId || !sessionId) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.rpc('upsert_teacher_attendance', {
        p_school_id:  schoolId,
        p_branch_id:  branchId,
        p_session_id: sessionId,
        p_teacher_id: teacherId,
        p_date:       modal.date,
        p_status:     status,
        p_note:       null,
      });
      if (err) throw err;
      delete cache[cacheKey(teacherId, sessionId, viewYear, viewMonth)];
      await fetchRecords(true);
      setModal(null);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  // Monthly summary counts
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const counts = { present: 0, absent: 0, late: 0, leave: 0, notMarked: 0 };
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toStr(viewYear, viewMonth, d);
    if (ds > todayStr) continue;
    const r = recordsByDate[ds];
    if (r) counts[r.status]++;
    else counts.notMarked++;
  }

  return (
    <div>
      <PageHeader
        title={teacherName}
        subtitle="Attendance History"
        actions={
          <button
            onClick={() => navigate(-1)}
            style={{ height: 36, paddingInline: 14, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.ink, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
          >
            ← Back
          </button>
        }
      />

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: bp === 'xs' ? '1fr' : '1fr 280px', gap: 20, alignItems: 'start' }}>
        {/* Calendar panel */}
        <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} disabled={atCurrent} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: atCurrent ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: atCurrent ? 0.4 : 1 }}>›</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted }}>Loading…</div>
          ) : (
            <CalendarGrid
              year={viewYear} month={viewMonth}
              recordsByDate={recordsByDate}
              canEdit={canEdit}
              onDayClick={(date, record) => setModal({ date, record: record || null })}
              todayStr={todayStr}
            />
          )}

          {canEdit && (
            <div style={{ marginTop: 12, fontSize: 11, color: C.muted }}>Click any past day to mark or edit attendance.</div>
          )}
        </div>

        {/* Summary panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Monthly summary */}
          <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>{MONTH_NAMES[viewMonth]} Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                counts[s] > 0 && (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: STATUS_COLOR[s] }} />
                      <span style={{ fontSize: 12, color: C.soft }}>{STATUS_LABEL[s]}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[s] }}>{counts[s]}</span>
                  </div>
                )
              ))}
              {counts.notMarked > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
                    <span style={{ fontSize: 12, color: C.soft }}>Not Marked</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{counts.notMarked}</span>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Legend</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STATUS_OPTIONS.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 20, borderRadius: 5, backgroundColor: STATUS_BG[s], border: `1px solid ${STATUS_COLOR[s]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[s] }}>{STATUS_LABEL[s].slice(0,3)}</span>
                  </div>
                  <span style={{ fontSize: 12, color: C.soft }}>{STATUS_LABEL[s]}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 20, borderRadius: 5, backgroundColor: '#F8FAFC', border: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, color: '#CBD5E1' }}>—</span>
                </div>
                <span style={{ fontSize: 12, color: C.soft }}>Not Marked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <MarkModal
          date={modal.date}
          record={modal.record}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
