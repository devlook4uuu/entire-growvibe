import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { C, Card, CardHeader } from '../dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import Task  from '../../assets/icons/Task';
import Check from '../../assets/icons/Check';
import Notes from '../../assets/icons/Notes';

const MAX_SELECT = 5;

// ISO week label: '2026-W16'
function currentCycleLabel() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weekNum = Math.round((monday - startOfWeek1) / (7 * 86400000)) + 1;
  return `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// 'Week of Apr 14–20'
function weekRangeLabel() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${fmt(mon)}–${fmt(sun)}`;
}

const PANELS = [
  { key: 'discipline',  label: 'Discipline',  color: C.purple, bg: '#F5F3FF', Icon: Task  },
  { key: 'cleanliness', label: 'Cleanliness', color: C.green,  bg: C.greenBg, Icon: Check },
  { key: 'study',       label: 'Study',        color: C.blue,   bg: C.blueBg,  Icon: Notes },
];

export default function GrowTasksPage() {
  const profile    = useSelector((s) => s.auth.profile);
  const cycleLabel = currentCycleLabel();
  const weekLabel  = weekRangeLabel();

  const [loading,   setLoading]   = useState(true);
  const [students,  setStudents]  = useState([]);
  const [tasks,     setTasks]     = useState({});     // category → { id, coins_reward }
  const [submitted, setSubmitted] = useState({});     // category → bool
  const [selected,  setSelected]  = useState({        // category → Set<id>
    discipline: new Set(), cleanliness: new Set(), study: new Set(),
  });
  const [saving,    setSaving]    = useState({});     // category → bool
  const [error,     setError]     = useState({});     // category → string

  const load = useCallback(async () => {
    if (!profile?.class_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [studRes, taskRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name')
          .eq('class_id', profile.class_id)
          .eq('role', 'student')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('grow_tasks')
          .select('id, category, coins_reward')
          .in('category', ['discipline', 'cleanliness', 'study'])
          .eq('is_active', true),
      ]);

      const studs   = studRes.data || [];
      const taskMap = {};
      for (const t of (taskRes.data || [])) taskMap[t.category] = t;

      setStudents(studs);
      setTasks(taskMap);

      // Check which panels this teacher already submitted this cycle
      const taskIds = Object.values(taskMap).map((t) => t.id);
      if (taskIds.length > 0) {
        const { data: subs } = await supabase
          .from('grow_task_submissions')
          .select('grow_task_id')
          .in('grow_task_id', taskIds)
          .eq('cycle_label', cycleLabel)
          .eq('awarded_by', profile.id);

        const doneIds = new Set((subs || []).map((s) => s.grow_task_id));
        const submittedMap = {};
        for (const [cat, task] of Object.entries(taskMap)) {
          submittedMap[cat] = doneIds.has(task.id);
        }
        setSubmitted(submittedMap);
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id, cycleLabel]);

  useEffect(() => { load(); }, [load]);

  function toggleStudent(category, studentId) {
    setSelected((prev) => {
      const next = new Set(prev[category]);
      if (next.has(studentId)) next.delete(studentId);
      else if (next.size < MAX_SELECT) next.add(studentId);
      return { ...prev, [category]: next };
    });
  }

  async function handleSubmit(category) {
    const task = tasks[category];
    if (!task) return;
    const ids = [...selected[category]];
    if (ids.length === 0) {
      setError((e) => ({ ...e, [category]: 'Select at least 1 student.' }));
      return;
    }
    setSaving((s) => ({ ...s, [category]: true }));
    setError((e) => ({ ...e, [category]: '' }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-growtask`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ grow_task_id: task.id, student_ids: ids, cycle_label: cycleLabel }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setSubmitted((s) => ({ ...s, [category]: true }));
      setSelected((s) => ({ ...s, [category]: new Set() }));
    } catch (e) {
      setError((ev) => ({ ...ev, [category]: e.message }));
    } finally {
      setSaving((s) => ({ ...s, [category]: false }));
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <p style={{ fontSize: 14, color: C.muted }}>Loading…</p>
      </div>
    );
  }

  if (!profile?.class_id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <p style={{ fontSize: 14, color: C.muted }}>You are not assigned as incharge of any class.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.5 }}>
          GrowTask Awards
        </h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>{weekLabel}</p>
      </div>

      {/* 3 panels side by side on wide, stacked on narrow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {PANELS.map((panel) => {
          const task       = tasks[panel.key];
          const isLocked   = submitted[panel.key] === true;
          const isSaving   = saving[panel.key]    === true;
          const panelSel   = selected[panel.key]  || new Set();
          const panelError = error[panel.key]      || '';

          return (
            <Card key={panel.key} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    backgroundColor: panel.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <panel.Icon size={20} color={panel.color} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>
                      {panel.label} Improved
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>
                      {task ? `${task.coins_reward} coins each` : '—'}
                    </p>
                  </div>
                </div>
                {isLocked && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: C.green,
                    backgroundColor: C.greenBg, borderRadius: 20,
                    padding: '3px 10px',
                  }}>
                    Submitted
                  </span>
                )}
              </div>

              {isLocked ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: C.canvas, borderRadius: 10, padding: '12px 14px',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                    Already submitted for {weekLabel}
                  </p>
                </div>
              ) : (
                <>
                  {/* Selection count */}
                  <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px' }}>
                    {panelSel.size} / {MAX_SELECT} selected
                  </p>

                  {/* Student list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
                    {students.length === 0 ? (
                      <p style={{ fontSize: 13, color: C.muted }}>No students in your class.</p>
                    ) : students.map((student, idx) => {
                      const isChecked  = panelSel.has(student.id);
                      const isDisabled = !isChecked && panelSel.size >= MAX_SELECT;
                      return (
                        <div
                          key={student.id}
                          onClick={() => !isDisabled && toggleStudent(panel.key, student.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 4px',
                            borderBottom: idx < students.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            userSelect: 'none',
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${isChecked ? panel.color : C.border}`,
                            backgroundColor: isChecked ? panel.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}>
                            {isChecked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: 13, color: C.ink, fontWeight: isChecked ? 600 : 400 }}>
                            {student.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Error */}
                  {panelError && (
                    <p style={{ fontSize: 12, color: C.red, margin: '0 0 10px' }}>{panelError}</p>
                  )}

                  {/* Submit button */}
                  <SubmitButton
                    label={`Submit ${panel.label}`}
                    color={panel.color}
                    loading={isSaving}
                    onPress={() => handleSubmit(panel.key)}
                  />
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SubmitButton({ label, color, loading, onPress }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onPress}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, color: '#fff',
        backgroundColor: hov && !loading ? color + 'CC' : color,
        opacity: loading ? 0.65 : 1,
        transition: 'opacity 0.15s, background-color 0.15s',
      }}
    >
      {loading ? 'Submitting…' : label}
    </button>
  );
}
