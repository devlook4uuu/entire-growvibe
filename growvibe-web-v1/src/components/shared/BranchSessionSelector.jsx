/**
 * BranchSessionSelector (web)
 *
 * Two horizontal pill rows for the owner dashboard:
 *   Row 1 — branches for the owner's school
 *   Row 2 — sessions for the selected branch
 *
 * Both branches and sessions are cached at module level (30s TTL).
 * The component remounts on every route visit in React Router, so
 * module-level caches are the only way to survive navigation.
 * Cache is invalidated by SessionsPage after a successful save.
 */

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { setSelectedBranch, setSelectedSession } from '../../store/appSlice';
import { C } from '../../pages/dashboard/AdminDashboard';

// ─── Module-level caches (survive component remount) ─────────────────────────
const TTL = 30_000;

const branchCache = {};   // keyed by schoolId
const sessionCache = {};  // keyed by branchId

function isFresh(cache, key) {
  const e = cache[key];
  return !!(e && Date.now() - e.ts < TTL);
}
function readC(cache, key)       { return cache[key]?.data ?? null; }
function writeC(cache, key, data) { cache[key] = { data, ts: Date.now() }; }

export function invalidateSelectorSessionCache(branchId) {
  if (branchId) delete sessionCache[branchId];
  else Object.keys(sessionCache).forEach((k) => delete sessionCache[k]);
}

// ─── Pill button ──────────────────────────────────────────────────────────────
function Pill({ label, active, dot, color, onClick }) {
  const [hov, setHov] = useState(false);
  const bg     = active ? (color?.bg     ?? '#EFF6FF') : hov ? C.canvas : C.white;
  const border = active ? (color?.border ?? '#3B82F6') : C.border;
  const text   = active ? (color?.text   ?? '#3B82F6') : C.soft;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 13px', borderRadius: 999,
        border: `1.5px solid ${border}`, backgroundColor: bg,
        cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
        color: text, whiteSpace: 'nowrap',
        transition: 'background-color 0.12s, border-color 0.12s',
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
      )}
      {label}
    </button>
  );
}

function CreateBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 12px', borderRadius: 999, border: 'none',
        backgroundColor: hov ? '#2563EB' : C.blue,
        color: '#fff', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: 'background-color 0.12s',
      }}
    >
      + Create Session
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BranchSessionSelector({ onCreateSession }) {
  const dispatch = useDispatch();
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);

  const schoolId = profile?.school_id;

  const [branches,       setBranches]       = useState([]);
  const [sessions,       setSessions]       = useState([]);
  const [branchLoading,  setBranchLoading]  = useState(!isFresh(branchCache, schoolId));
  const [sessionLoading, setSessionLoading] = useState(false);
  const [branchError,    setBranchError]    = useState(null);

  const didInit = useRef(false);

  // ── Load sessions for a branch (cache-first, no loading if cached) ──────────
  async function loadSessions(branchId) {
    if (!branchId) return;

    if (isFresh(sessionCache, branchId)) {
      const cached = readC(sessionCache, branchId);
      setSessions(cached);
      const active = cached.find((s) => s.is_active) ?? cached[0] ?? null;
      dispatch(setSelectedSession(active?.id ?? null));
      return;
    }

    setSessionLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('id, session_name, session_start, session_end, is_active')
      .eq('branch_id', branchId)
      .eq('school_id', schoolId)
      .order('session_start', { ascending: false });

    setSessionLoading(false);
    if (error || !data) return;

    writeC(sessionCache, branchId, data);
    setSessions(data);
    const active = data.find((s) => s.is_active) ?? data[0] ?? null;
    dispatch(setSelectedSession(active?.id ?? null));
  }

  // ── Load branches (cache-first) ─────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId || didInit.current) return;
    didInit.current = true;

    // Branch cache hit — apply instantly, then load sessions
    if (isFresh(branchCache, schoolId)) {
      const cached = readC(branchCache, schoolId);
      setBranches(cached);
      setBranchLoading(false);

      const bid = selectedBranchId ?? cached[0]?.id ?? null;
      if (bid) {
        if (!selectedBranchId) dispatch(setSelectedBranch(bid));
        loadSessions(bid);
      }
      return;
    }

    // Branch cache miss — fetch
    (async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) { setBranchError('Could not load branches.'); setBranchLoading(false); return; }

      writeC(branchCache, schoolId, data || []);
      setBranches(data || []);
      setBranchLoading(false);

      const first = data?.[0];
      const bid   = selectedBranchId ?? first?.id ?? null;
      if (bid) {
        if (!selectedBranchId) dispatch(setSelectedBranch(bid));
        loadSessions(bid);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // ── Branch pill tap ────────────────────────────────────────────────────────
  function handleBranchSelect(branch) {
    if (branch.id === selectedBranchId) return;
    dispatch(setSelectedBranch(branch.id));
    setSessions([]);
    loadSessions(branch.id);
  }

  // ── Session pill tap ───────────────────────────────────────────────────────
  function handleSessionSelect(session) {
    dispatch(setSelectedSession(session.id));
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (branchLoading) {
    return (
      <div style={S.root}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[80, 100, 70].map((w, i) => (
            <div key={i} style={{ height: 28, width: w, borderRadius: 999, backgroundColor: C.borderLight }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[90, 110].map((w, i) => (
            <div key={i} style={{ height: 28, width: w, borderRadius: 999, backgroundColor: C.borderLight }} />
          ))}
        </div>
      </div>
    );
  }

  if (branchError) {
    return (
      <div style={S.root}>
        <span style={{ fontSize: 12, color: C.red }}>{branchError}</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div style={S.root}>
        <span style={{ fontSize: 12, color: C.muted }}>No active branches found.</span>
      </div>
    );
  }

  const branchColor = { bg: '#EFF6FF', border: '#3B82F6', text: '#3B82F6' };
  const sessionColor = { bg: C.purpleBg, border: C.purple, text: C.purple };

  return (
    <div style={S.root}>
      {/* ── Branch pills ── */}
      <div style={S.row}>
        <span style={S.rowLabel}>Branch</span>
        <div style={S.pills}>
          {branches.map((b) => (
            <Pill
              key={b.id}
              label={b.name}
              active={b.id === selectedBranchId}
              color={branchColor}
              onClick={() => handleBranchSelect(b)}
            />
          ))}
        </div>
      </div>

      {/* ── Session pills ── */}
      <div style={S.row}>
        <span style={S.rowLabel}>Session</span>
        {sessionLoading ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {[90, 110].map((w, i) => (
              <div key={i} style={{ height: 28, width: w, borderRadius: 999, backgroundColor: C.borderLight }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: C.muted }}>No session for this branch</span>
            <CreateBtn onClick={onCreateSession} />
          </div>
        ) : (
          <div style={S.pills}>
            {sessions.map((s) => (
              <Pill
                key={s.id}
                label={s.session_name}
                active={s.id === selectedSessionId}
                dot={s.is_active}
                color={sessionColor}
                onClick={() => handleSessionSelect(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    backgroundColor: C.white,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flexShrink: 0,
    width: 52,
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
};
