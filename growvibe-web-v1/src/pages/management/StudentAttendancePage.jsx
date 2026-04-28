/**
 * StudentAttendancePage.jsx
 *
 * Shows all students in a class for a selected date with their attendance status.
 * Route: /student-attendance?classId=…&className=…&sessionId=…
 *
 * Managers: can mark / edit attendance for any date.
 * Teacher: read-only for past dates (teachers mark via the app).
 */

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, PageHeader, useBreakpoint } from '../dashboard/AdminDashboard';

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

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLOR   = { present: '#22C55E', absent: '#EF4444', late: '#F59E0B', leave: '#8B5CF6' };
const STATUS_BG      = { present: '#ECFDF5', absent: '#FEF2F2', late: '#FFFBEB', leave: '#F5F3FF' };
const STATUS_LABEL   = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'Leave' };
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 34 }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: C.blue }}>
      {initials}
    </div>
  );
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ student, localStatus, onStatusChange, canEdit }) {
  const activeStatus = localStatus ?? student.attendance?.status ?? null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
      <Avatar name={student.name} url={student.avatar_url} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name || '—'}</div>
        {!activeStatus && <div style={{ fontSize: 11, color: C.muted }}>Not Marked</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => canEdit && onStatusChange(student.id, s)}
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              backgroundColor: activeStatus === s ? STATUS_COLOR[s] : STATUS_BG[s],
              color: activeStatus === s ? '#fff' : STATUS_COLOR[s],
              fontWeight: 700, fontSize: 11,
              cursor: canEdit ? 'pointer' : 'default',
              transition: 'all 0.12s',
              title: STATUS_LABEL[s],
            }}
            title={STATUS_LABEL[s]}
          >
            {STATUS_LABEL[s][0]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentAttendancePage() {
  const bp = useBreakpoint();
  const navigate     = useNavigate();
  const profile      = useSelector((s) => s.auth.profile);
  const [searchParams] = useSearchParams();

  const classId        = searchParams.get('classId')   || '';
  const className      = searchParams.get('className') || 'Class';
  const paramSessionId = searchParams.get('sessionId') || '';

  const isManager = ['owner', 'principal', 'coordinator'].includes(profile?.role);
  const isTeacher = profile?.role === 'teacher';

  // Resolve sessionId + branchId from class record.
  // Always fetch from DB — owners have no branch_id on their profile,
  // and sessionId in URL params may not include branchId.
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [branchId,  setBranchId]  = useState(profile?.branch_id || null);
  const [resolving, setResolving] = useState(!!classId);

  useEffect(() => {
    if (!classId) { setResolving(false); return; }
    supabase
      .from('classes').select('session_id, branch_id').eq('id', classId).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id && !paramSessionId) setSessionId(data.session_id);
        if (data?.branch_id)  setBranchId(data.branch_id);
        setResolving(false);
      });
  }, [classId, paramSessionId]);

  // Use local date string to avoid UTC/timezone mismatch
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [localStatuses, setLocalStatuses] = useState({});

  // ── Fetch roster + attendance for selected date ───────────────────────────
  const fetchData = useCallback(async () => {
    if (!classId || !sessionId) return;
    setLoading(true); setError('');
    try {
      const [rosterRes, attRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('class_id', classId)
          .eq('role', 'student')
          .order('name', { ascending: true }),
        supabase
          .from('attendance')
          .select('*')
          .eq('role', 'student')
          .eq('class_id', classId)
          .eq('session_id', sessionId)
          .eq('date', selectedDate),
      ]);
      if (rosterRes.error) throw rosterRes.error;
      if (attRes.error)    throw attRes.error;

      const byStudent = {};
      for (const r of (attRes.data || [])) byStudent[r.person_id] = r;
      setStudents((rosterRes.data || []).map((s) => ({ ...s, attendance: byStudent[s.id] || null })));
    } catch (e) {
      setError(e.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [classId, sessionId, selectedDate]);

  useEffect(() => { setLocalStatuses({}); fetchData(); }, [fetchData]);

  function shiftDate(delta) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (next > todayStr) return;
    setSelectedDate(next);
  }

  function handleStatusChange(studentId, status) {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSubmit() {
    const records = students.map((s) => {
      const status = localStatuses[s.id] ?? s.attendance?.status;
      return status ? { student_id: s.id, status, note: null } : null;
    }).filter(Boolean);

    if (records.length === 0) return;
    if (!profile?.school_id || !branchId || !sessionId) {
      setError('Missing school, branch, or session information.'); return;
    }
    setSubmitting(true); setError('');
    try {
      const { error: err } = await supabase.rpc('upsert_class_attendance', {
        p_school_id:  profile.school_id,
        p_branch_id:  branchId,
        p_session_id: sessionId,
        p_class_id:   classId,
        p_date:       selectedDate,
        p_records:    records,
      });
      if (err) throw err;

      // Notify absent/late students (fire-and-forget)
      const absentIds = records.filter((r) => r.status === 'absent').map((r) => r.student_id);
      const lateIds   = records.filter((r) => r.status === 'late').map((r) => r.student_id);
      if (absentIds.length > 0) sendPush(absentIds, 'Attendance', 'Your attendance has been marked: Absent');
      if (lateIds.length > 0)   sendPush(lateIds,   'Attendance', 'Your attendance has been marked: Late');

      setLocalStatuses({});
      await fetchData();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  const hasChanges = Object.keys(localStatuses).length > 0;

  // Teachers can only edit today; managers can edit any past date
  const canEdit = isManager || (isTeacher && selectedDate === todayStr);

  // Summary counts
  const counts = {};
  let notMarked = 0;
  for (const s of students) {
    const st = localStatuses[s.id] ?? s.attendance?.status;
    if (st) counts[st] = (counts[st] || 0) + 1;
    else notMarked++;
  }

  if (resolving) {
    return (
      <div>
        <PageHeader title={className} subtitle="Student Attendance" actions={<button onClick={() => navigate(-1)} style={{ height: 36, paddingInline: 14, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.white, color: C.ink, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>← Back</button>} />
        <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={className}
        subtitle="Student Attendance"
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

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, width: 'fit-content' }}>
        <button onClick={() => shiftDate(-1)} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 240, textAlign: 'center' }}>{formatDate(selectedDate)}</span>
        <button
          onClick={() => shiftDate(1)}
          disabled={selectedDate >= todayStr}
          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: selectedDate >= todayStr ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: selectedDate >= todayStr ? 0.4 : 1 }}
        >›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: bp === 'xs' ? '1fr' : '1fr 240px', gap: 20, alignItems: 'start' }}>
        {/* Student list */}
        <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Legend row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, backgroundColor: C.canvas }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>Status pills:</span>
            {STATUS_OPTIONS.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: STATUS_BG[s], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[s] }}>{STATUS_LABEL[s][0]}</span>
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{STATUS_LABEL[s]}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No students in this class.</div>
          ) : (
            students.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                localStatus={localStatuses[s.id] ?? null}
                onStatusChange={handleStatusChange}
                canEdit={canEdit}
              />
            ))
          )}
        </div>

        {/* Summary + save */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary */}
          <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Summary</div>
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
              {notMarked > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
                    <span style={{ fontSize: 12, color: C.soft }}>Not Marked</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{notMarked}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save button (managers only) */}
          {canEdit && hasChanges && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', height: 40, borderRadius: 10, border: 'none',
                backgroundColor: C.blue, color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving…' : 'Save Attendance'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
