import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C, Card, CardHeader, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Users      from '../../assets/icons/Users';
import Attendence from '../../assets/icons/Attendence';
import Money      from '../../assets/icons/Money';
import Crown      from '../../assets/icons/Crown';

function HoverRow({ children, style }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...style, backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s' }}
    >
      {children}
    </div>
  );
}

function SkeletonRows({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 8, backgroundColor: C.borderLight }} />
      ))}
    </div>
  );
}

function EmptyMsg({ text }) {
  return <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0', margin: 0 }}>{text}</p>;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function monthLabel() {
  return new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

export default function PrincipalDashboard() {
  const bp       = useBreakpoint();
  const profile  = useSelector((s) => s.auth.profile);
  const branchId = profile?.branch_id;
  const schoolId = profile?.school_id;
  const today    = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  // ── Stats ────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!branchId || !schoolId) return;
    const td = todayISO();
    async function load() {
      const [
        { count: students },
        { count: classes },
        { data: attData },
        { data: feeData },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('role', 'student').eq('is_active', true),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
        supabase.from('attendance').select('status, class_id').eq('branch_id', branchId).eq('role', 'student').eq('date', td),
        supabase.from('student_fee_records').select('payment_status, fee_amount, amount_paid').eq('branch_id', branchId).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const attRows   = attData ?? [];
      const present   = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
      const attPct    = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;
      const markedClassIds = new Set(attRows.map((r) => r.class_id).filter(Boolean));

      const feeRows   = feeData ?? [];
      const collected = feeRows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
      const unpaid    = feeRows.filter((r) => r.payment_status === 'unpaid' || r.payment_status === 'partial').length;

      // Count unmarked classes
      let unmarkedCount = 0;
      if (classes) {
        const { data: allClasses } = await supabase.from('classes').select('id').eq('branch_id', branchId);
        unmarkedCount = (allClasses ?? []).filter((c) => !markedClassIds.has(c.id)).length;
      }

      setStats({ students: students ?? 0, classes: classes ?? 0, attPct, present, collected, unpaid, unmarkedCount });
    }
    load();
  }, [branchId, schoolId]);

  // ── Class attendance today ───────────────────────────────────
  const [classAtt, setClassAtt] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    const td = todayISO();
    async function load() {
      const { data: classes } = await supabase
        .from('classes')
        .select('id, class_name, teacher_id')
        .eq('branch_id', branchId)
        .order('class_name');

      if (!classes?.length) { setClassAtt([]); return; }

      // Fetch teacher names
      const teacherIds = [...new Set(classes.map((c) => c.teacher_id).filter(Boolean))];
      const teacherMap = {};
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', teacherIds);
        (teachers ?? []).forEach((t) => { teacherMap[t.id] = t.name; });
      }

      // Fetch today's attendance per class
      const { data: attData } = await supabase
        .from('attendance')
        .select('class_id, status')
        .eq('branch_id', branchId)
        .eq('role', 'student')
        .eq('date', td);

      const attByClass = {};
      (attData ?? []).forEach((r) => {
        if (!attByClass[r.class_id]) attByClass[r.class_id] = [];
        attByClass[r.class_id].push(r.status);
      });

      setClassAtt(classes.map((c) => {
        const rows    = attByClass[c.id] ?? [];
        const marked  = rows.length > 0;
        const present = rows.filter((s) => s === 'present' || s === 'late').length;
        return {
          id: c.id, name: c.class_name,
          teacher: teacherMap[c.teacher_id] || '—',
          marked, present, total: rows.length,
        };
      }));
    }
    load();
  }, [branchId]);

  // ── Unmarked classes today ───────────────────────────────────
  const [unmarked, setUnmarked] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    const td = todayISO();
    async function load() {
      const { data: classes } = await supabase.from('classes').select('id, class_name').eq('branch_id', branchId);
      if (!classes?.length) { setUnmarked([]); return; }
      const { data: marked } = await supabase.from('attendance').select('class_id').eq('branch_id', branchId).eq('role', 'student').eq('date', td);
      const markedIds = new Set((marked ?? []).map((r) => r.class_id));
      setUnmarked(classes.filter((c) => !markedIds.has(c.id)));
    }
    load();
  }, [branchId]);

  // ── GrowCoins leaderboard ────────────────────────────────────
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    supabase
      .from('profiles')
      .select('id, name, class_id, grow_coins')
      .eq('branch_id', branchId)
      .eq('role', 'student')
      .eq('is_active', true)
      .order('grow_coins', { ascending: false })
      .limit(5)
      .then(async ({ data: students }) => {
        if (!students?.length) { setLeaderboard([]); return; }
        const classIds = [...new Set(students.map((s) => s.class_id).filter(Boolean))];
        const classMap = {};
        if (classIds.length > 0) {
          const { data: classes } = await supabase.from('classes').select('id, class_name').in('id', classIds);
          (classes ?? []).forEach((c) => { classMap[c.id] = c.class_name; });
        }
        setLeaderboard(students.map((s, i) => ({
          rank: i + 1, id: s.id, name: s.name,
          className: classMap[s.class_id] || '—',
          coins: s.grow_coins ?? 0,
        })));
      });
  }, [branchId]);

  // ── Class attendance this week (lowest 5) ────────────────────
  const [weakClasses, setWeakClasses] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    const td  = todayISO();
    const wk  = weekAgoISO();
    async function load() {
      const { data: classes } = await supabase.from('classes').select('id, class_name').eq('branch_id', branchId);
      if (!classes?.length) { setWeakClasses([]); return; }

      const { data: attData } = await supabase
        .from('attendance')
        .select('class_id, status')
        .eq('branch_id', branchId)
        .eq('role', 'student')
        .gte('date', wk)
        .lte('date', td);

      const attByClass = {};
      (attData ?? []).forEach((r) => {
        if (!attByClass[r.class_id]) attByClass[r.class_id] = { present: 0, total: 0 };
        attByClass[r.class_id].total++;
        if (r.status === 'present' || r.status === 'late') attByClass[r.class_id].present++;
      });

      const ranked = classes
        .map((c) => {
          const d   = attByClass[c.id];
          const pct = d && d.total > 0 ? Math.round((d.present / d.total) * 100) : null;
          return { id: c.id, name: c.class_name, pct };
        })
        .filter((c) => c.pct !== null)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 5);

      setWeakClasses(ranked);
    }
    load();
  }, [branchId]);

  return (
    <div>
      <PageHeader
        greeting={`Welcome, ${profile?.name || 'Principal'}`}
        subtitle={today}
      />

      <BannerCarousel />

      {/* Unmarked alert */}
      {unmarked && unmarked.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 14,
          backgroundColor: C.yellowBg, padding: '12px 18px', marginBottom: 20,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.yellow, flexShrink: 0, marginTop: 5 }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: C.yellow, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>{unmarked.length} {unmarked.length === 1 ? 'class has' : 'classes have'}</span> not marked attendance today:{' '}
            <span style={{ fontWeight: 600 }}>{unmarked.map((c) => c.class_name).join(', ')}</span>
          </p>
        </div>
      )}

      <StatsGrid cols={statCols}>
        <StatCard
          icon={Users} iconColor={C.blue} iconBg={C.blueBg}
          title="Branch Students" value={stats?.students ?? '—'}
          badge={stats ? `${stats.classes} classes` : '…'} badgeColor={{ text: C.blue, bg: C.blueBg }}
          loading={!stats}
        />
        <StatCard
          icon={Attendence} iconColor="#fff" iconBg={C.sky}
          title="Today's Attendance" value={stats ? `${stats.attPct}%` : '—'}
          badge={stats ? `${stats.unmarkedCount} unmarked` : '…'}
          badgeColor={stats?.unmarkedCount > 0 ? { text: C.yellow, bg: C.yellowBg } : { text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
        <StatCard
          icon={Money} iconColor="#fff" iconBg={C.green}
          title={`Fees Collected — ${monthLabel()}`} value={stats ? fmtPKR(stats.collected) : '—'}
          badge={stats ? `${stats.unpaid} unpaid` : '…'} badgeColor={{ text: C.yellow, bg: C.yellowBg }}
          loading={!stats}
        />
        <StatCard
          icon={Crown} iconColor={C.yellow} iconBg={C.yellowBg}
          title="GrowCoins Leader" value={leaderboard?.[0]?.coins ?? '—'}
          badge={leaderboard?.[0]?.name || '…'} badgeColor={{ text: C.yellow, bg: C.yellowBg }}
          loading={leaderboard === null}
        />
      </StatsGrid>

      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAtt} />
          <GrowCoinsCard students={leaderboard} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAtt} />
          <GrowCoinsCard students={leaderboard} />
        </SingleCol>
      )}

      {weakClasses && weakClasses.length > 0 && (
        <WeakClassesCard rows={weakClasses} />
      )}
    </div>
  );
}

function ClassAttendanceCard({ rows }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Class Attendance — Today" />
      {rows === null ? (
        <SkeletonRows count={5} />
      ) : rows.length === 0 ? (
        <EmptyMsg text="No classes found" />
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 4, padding: '0 8px',
            }}>
              <span>Class</span><span>Teacher</span><span>Present</span><span>Status</span>
            </div>
          )}
          {rows.map((c, i) => (
            isMobile ? (
              <div key={c.id} style={{ padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{c.name}</span>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: c.marked ? '#15803D' : '#DC2626', backgroundColor: c.marked ? '#ECFDF5' : '#FEF2F2' }}>{c.marked ? 'Marked' : 'Missing'}</span>
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{c.teacher}{c.marked ? ` · ${c.present}/${c.total} present` : ''}</span>
              </div>
            ) : (
              <HoverRow key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: 8,
                alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: C.ink }}>{c.name}</span>
                <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacher}</span>
                <span style={{ color: C.soft }}>{c.marked ? `${c.present}/${c.total}` : '—'}</span>
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: c.marked ? '#15803D' : '#DC2626', backgroundColor: c.marked ? '#ECFDF5' : '#FEF2F2' }}>
                  {c.marked ? 'Marked' : 'Missing'}
                </span>
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

function GrowCoinsCard({ students }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="GrowCoins Leaderboard" />
      {students === null ? (
        <SkeletonRows count={5} />
      ) : students.length === 0 ? (
        <EmptyMsg text="No students found" />
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 4, padding: '0 8px',
            }}>
              <span>#</span><span>Student</span><span>Class</span><span style={{ textAlign: 'right' }}>Coins</span>
            </div>
          )}
          {students.map((s, i) => (
            isMobile ? (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <span style={{ width: 24, flexShrink: 0, textAlign: 'center' }}>
                  {s.rank === 1 ? <Crown size={16} color="#F59E0B" strokeWidth={1.6} /> : <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>#{s.rank}</span>}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.soft }}>{s.className}</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.yellow, backgroundColor: C.yellowBg, flexShrink: 0 }}>{s.coins}</span>
              </div>
            ) : (
              <HoverRow key={s.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px', gap: 8,
                alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span>
                  {s.rank === 1
                    ? <Crown size={16} color="#F59E0B" strokeWidth={1.6} />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>#{s.rank}</span>}
                </span>
                <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: C.soft, fontSize: 12 }}>{s.className}</span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.yellow, backgroundColor: C.yellowBg }}>{s.coins}</span>
                </span>
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

function WeakClassesCard({ rows }) {
  return (
    <Card style={{ marginTop: 16 }}>
      <CardHeader title="Lowest Attendance This Week" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((c) => (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{c.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.pct < 60 ? C.red : C.yellow }}>{c.pct}%</span>
            </div>
            <div style={{ height: 6, backgroundColor: C.borderLight, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.pct}%`, backgroundColor: c.pct < 60 ? C.red : C.yellow, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
