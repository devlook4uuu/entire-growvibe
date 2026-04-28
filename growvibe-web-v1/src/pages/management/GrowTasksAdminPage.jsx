/**
 * GrowTasksAdminPage.jsx
 *
 * Admin-only page to view and edit GrowTask coin rewards.
 * Admin can change coins_reward and toggle is_active for any task.
 * Tasks are fixed (seeded at DB level) — no create/delete.
 *
 * Route: /growtasks-admin  (admin only)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { C, PageHeader } from '../dashboard/AdminDashboard';
import { SlideOver, Field, SaveBtn, CancelBtn, FormError, ErrorBlock } from '../../components/shared/webListHelpers';
import Pen  from '../../assets/icons/Pen';
import Coin from '../../assets/icons/Coin';
import Task from '../../assets/icons/Task';

// ─── Category metadata ────────────────────────────────────────────────────────
const CATEGORY_META = {
  attendance_weekly:  { label: 'Weekly Attendance',  cycle: 'Weekly',  color: C.blue,   bg: C.blueBg   },
  attendance_monthly: { label: 'Monthly Attendance', cycle: 'Monthly', color: C.purple, bg: '#F5F3FF'  },
  discipline:         { label: 'Discipline',         cycle: 'Weekly',  color: C.green,  bg: C.greenBg  },
  cleanliness:        { label: 'Cleanliness',        cycle: 'Weekly',  color: C.sky,    bg: '#F0F9FF'  },
  study:              { label: 'Study',              cycle: 'Weekly',  color: C.orange, bg: '#FFF7ED'  },
};

function categoryMeta(cat) {
  return CATEGORY_META[cat] || { label: cat, cycle: '—', color: C.muted, bg: C.canvas };
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.borderLight, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 13, width: '50%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 7 }} />
          <div style={{ height: 10, width: '30%', borderRadius: 5, backgroundColor: C.borderLight }} />
        </div>
      </div>
      <div style={{ height: 1, backgroundColor: C.borderLight, marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ height: 11, width: '35%', borderRadius: 5, backgroundColor: C.borderLight }} />
        <div style={{ height: 28, width: 60, borderRadius: 6, backgroundColor: C.borderLight }} />
      </div>
    </div>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit }) {
  const [hov, setHov] = useState(false);
  const meta = categoryMeta(task.category);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white, borderRadius: 14,
        border: `1px solid ${hov ? meta.color : C.border}`,
        padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? `0 2px 14px ${meta.color}22` : 'none',
      }}
    >
      {/* Header: icon + name + active badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Coin size={22} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.name}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {meta.cycle} · {task.category}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px', flexShrink: 0,
          backgroundColor: task.is_active ? C.greenBg  : C.canvas,
          color:           task.is_active ? C.green     : C.muted,
        }}>
          {task.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Coins reward */}
      <div style={{ backgroundColor: C.canvas, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: C.soft, fontWeight: 500 }}>Coins Reward</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: meta.color }}>{task.coins_reward}</span>
      </div>

      {/* Footer: edit button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: `1px solid ${C.borderLight}` }}>
        <button
          onClick={() => onEdit(task)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 30, paddingInline: 12, borderRadius: 7,
            border: `1px solid ${C.border}`,
            backgroundColor: hov ? meta.bg : C.white,
            cursor: 'pointer', fontSize: 12, fontWeight: 600, color: meta.color,
            transition: 'background-color 0.15s',
          }}
        >
          <Pen size={11} color={meta.color} /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────
function TaskEditForm({ task, onSaved, onClose }) {
  const meta = categoryMeta(task.category);

  const [coins,    setCoins]    = useState(String(task.coins_reward));
  const [isActive, setIsActive] = useState(task.is_active);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSave() {
    const n = parseInt(coins, 10);
    if (!coins || isNaN(n) || n < 1) return setError('Enter a valid coin amount (minimum 1).');
    if (n > 10000)                   return setError('Coin amount cannot exceed 10,000.');
    setError(''); setSaving(true);
    try {
      const { error: err } = await supabase
        .from('grow_tasks')
        .update({ coins_reward: n, is_active: isActive })
        .eq('id', task.id);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Read-only task info */}
      <div style={{ backgroundColor: C.canvas, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Coin size={18} color={meta.color} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{task.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{meta.cycle} · {task.category}</div>
        </div>
      </div>

      <FormError message={error} />

      <Field label="Coins Reward">
        <input
          type="number"
          min="1"
          max="10000"
          value={coins}
          onChange={(e) => { setCoins(e.target.value); setError(''); }}
          style={{
            width: '100%', height: 40, paddingInline: 12, borderRadius: 8,
            border: `1.5px solid ${C.border}`, fontSize: 15, fontWeight: 700,
            color: meta.color, outline: 'none', boxSizing: 'border-box',
            backgroundColor: C.white,
          }}
          onFocus={(e) => { e.target.style.borderColor = meta.color; }}
          onBlur={(e)  => { e.target.style.borderColor = C.border; }}
        />
      </Field>

      <Field label="Status">
        <div style={{ display: 'flex', gap: 8 }}>
          {[true, false].map((val) => (
            <button
              key={String(val)}
              onClick={() => setIsActive(val)}
              style={{
                flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
                backgroundColor: isActive === val ? (val ? C.green : C.red) : C.canvas,
                color:           isActive === val ? '#fff' : C.soft,
              }}
            >
              {val ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <SaveBtn label="Save Changes" loading={saving} onClick={handleSave} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── GrowTasksAdminPage ───────────────────────────────────────────────────────
export default function GrowTasksAdminPage() {
  const [tasks,     setTasks]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [editTask,  setEditTask]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('grow_tasks')
      .select('id, name, category, coins_reward, cycle, is_active')
      .order('cycle')
      .order('category');
    if (err) { setError(err.message); }
    else     { setTasks(data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved() {
    setEditTask(null);
    load();
  }

  // Group by cycle for display
  const weekly  = tasks.filter((t) => t.cycle === 'weekly');
  const monthly = tasks.filter((t) => t.cycle === 'monthly');

  return (
    <div>
      <PageHeader
        greeting="GrowTask Rewards"
        subtitle="Set the coin rewards for each task type. Changes take effect on the next award cycle."
      />

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Weekly tasks */}
          {weekly.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Task size={16} color={C.blue} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.2 }}>Weekly Tasks</h2>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>Awarded every Saturday</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {weekly.map((t) => (
                  <TaskCard key={t.id} task={t} onEdit={setEditTask} />
                ))}
              </div>
            </section>
          )}

          {/* Monthly tasks */}
          {monthly.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Task size={16} color={C.purple} />
                <h2 style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.2 }}>Monthly Tasks</h2>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>Awarded on the last day of each month</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {monthly.map((t) => (
                  <TaskCard key={t.id} task={t} onEdit={setEditTask} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      <SlideOver
        open={!!editTask}
        onClose={() => setEditTask(null)}
        title="Edit Task Reward"
      >
        {editTask && (
          <TaskEditForm
            task={editTask}
            onSaved={handleSaved}
            onClose={() => setEditTask(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
