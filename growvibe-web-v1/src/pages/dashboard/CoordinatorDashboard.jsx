import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C, Card, CardHeader, Badge, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Attendence from '../../assets/icons/Attendence';
import Money      from '../../assets/icons/Money';
import Users      from '../../assets/icons/Users';

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

function monthLabel() {
  return new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

export default function CoordinatorDashboard() {
  const bp       = useBreakpoint();
  const profile  = useSelector((s) => s.auth.profile);
  const branchId = profile?.branch_id;
  const today    = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 3 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  // ── Stats ────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    const td = todayISO();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    async function load() {
      const [
        { data: attData },
        { data: feeData },
      ] = await Promise.all([
        supabase.from('attendance').select('status').eq('branch_id', branchId).eq('role', 'student').eq('date', td),
        supabase.from('student_fee_records').select('payment_status, fee_amount, amount_paid').eq('branch_id', branchId).gte('created_at', monthStart),
      ]);

      const attRows = attData ?? [];
      const present = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
      const attPct  = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;

      const feeRows      = feeData ?? [];
      const unpaid       = feeRows.filter((r) => r.payment_status === 'unpaid' || r.payment_status === 'partial').length;
      const pendingAmount = feeRows.reduce((s, r) => s + Math.max(0, (Number(r.fee_amount) || 0) - (Number(r.amount_paid) || 0)), 0);

      setStats({ attPct, present, unpaid, pendingAmount });
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

      const teacherIds = [...new Set(classes.map((c) => c.teacher_id).filter(Boolean))];
      const teacherMap = {};
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase.from('profiles').select('id, name').in('id', teacherIds);
        (teachers ?? []).forEach((t) => { teacherMap[t.id] = t.name; });
      }

      const { data: attData } = await supabase
        .from('attendance').select('class_id, status')
        .eq('branch_id', branchId).eq('role', 'student').eq('date', td);

      const attByClass = {};
      (attData ?? []).forEach((r) => {
        if (!attByClass[r.class_id]) attByClass[r.class_id] = [];
        attByClass[r.class_id].push(r.status);
      });

      setClassAtt(classes.map((c) => {
        const rows    = attByClass[c.id] ?? [];
        const marked  = rows.length > 0;
        const present = rows.filter((s) => s === 'present' || s === 'late').length;
        return { id: c.id, name: c.class_name, teacher: teacherMap[c.teacher_id] || '—', marked, present, total: rows.length };
      }));
    }
    load();
  }, [branchId]);

  // ── Unpaid fees by class ─────────────────────────────────────
  const [unpaidByClass, setUnpaidByClass] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    async function load() {
      const { data: classes } = await supabase.from('classes').select('id, class_name').eq('branch_id', branchId).order('class_name');
      if (!classes?.length) { setUnpaidByClass([]); return; }

      const { data: fees } = await supabase
        .from('student_fee_records')
        .select('class_id, payment_status, fee_amount, amount_paid')
        .eq('branch_id', branchId)
        .in('payment_status', ['unpaid', 'partial'])
        .gte('created_at', monthStart);

      const byClass = {};
      (fees ?? []).forEach((r) => {
        if (!byClass[r.class_id]) byClass[r.class_id] = { count: 0, amount: 0 };
        byClass[r.class_id].count++;
        byClass[r.class_id].amount += Math.max(0, (Number(r.fee_amount) || 0) - (Number(r.amount_paid) || 0));
      });

      const rows = classes
        .map((c) => ({ id: c.id, name: c.class_name, count: byClass[c.id]?.count || 0, amount: byClass[c.id]?.amount || 0 }))
        .filter((c) => c.count > 0);

      setUnpaidByClass(rows);
    }
    load();
  }, [branchId]);

  // ── Students absent 3+ consecutive days ─────────────────────
  const [chronicallyAbsent, setChronicallyAbsent] = useState(null);

  useEffect(() => {
    if (!branchId) return;
    async function load() {
      // Fetch last 7 days of attendance for this branch
      const td  = todayISO();
      const ago = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })();

      const { data: attData } = await supabase
        .from('attendance')
        .select('person_id, date, status')
        .eq('branch_id', branchId)
        .eq('role', 'student')
        .gte('date', ago)
        .lte('date', td)
        .order('date', { ascending: false });

      // Group by person
      const byPerson = {};
      (attData ?? []).forEach((r) => {
        if (!byPerson[r.person_id]) byPerson[r.person_id] = [];
        byPerson[r.person_id].push({ date: r.date, status: r.status });
      });

      // Count consecutive absent streak from most recent
      const absentIds = [];
      for (const [personId, records] of Object.entries(byPerson)) {
        const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
        let streak = 0;
        for (const r of sorted) {
          if (r.status === 'absent') streak++;
          else break;
        }
        if (streak >= 3) absentIds.push({ personId, streak });
      }

      if (!absentIds.length) { setChronicallyAbsent([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, class_id')
        .in('id', absentIds.map((a) => a.personId));

      const classIds = [...new Set((profiles ?? []).map((p) => p.class_id).filter(Boolean))];
      const classMap = {};
      if (classIds.length > 0) {
        const { data: classes } = await supabase.from('classes').select('id, class_name').in('id', classIds);
        (classes ?? []).forEach((c) => { classMap[c.id] = c.class_name; });
      }

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setChronicallyAbsent(
        absentIds
          .map((a) => {
            const p = profileMap[a.personId];
            return p ? { id: a.personId, name: p.name, className: classMap[p.class_id] || '—', streak: a.streak } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.streak - a.streak)
      );
    }
    load();
  }, [branchId]);

  return (
    <div>
      <PageHeader
        greeting={`Welcome, ${profile?.name || 'Coordinator'}`}
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
          icon={Attendence} iconColor="#fff" iconBg={C.sky}
          title="Today's Attendance" value={stats ? `${stats.attPct}%` : '—'}
          badge={stats ? `${stats.present} present` : '…'} badgeColor={{ text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
        <StatCard
          icon={Money} iconColor="#fff" iconBg={C.red}
          title={`Unpaid Fees — ${monthLabel()}`} value={stats?.unpaid ?? '—'}
          badge={stats ? fmtPKR(stats.pendingAmount) : '…'} badgeColor={{ text: C.red, bg: C.redBg }}
          loading={!stats}
        />
        <StatCard
          icon={Users} iconColor={C.orange} iconBg={C.orangeBg}
          title="Absent 3+ Days" value={chronicallyAbsent?.length ?? '—'}
          badge={chronicallyAbsent?.length > 0 ? 'needs attention' : 'all clear'}
          badgeColor={chronicallyAbsent?.length > 0 ? { text: C.red, bg: C.redBg } : { text: C.green, bg: C.greenBg }}
          loading={chronicallyAbsent === null}
        />
      </StatsGrid>

      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAtt} />
          <UnpaidFeesCard rows={unpaidByClass} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAtt} />
          <UnpaidFeesCard rows={unpaidByClass} />
        </SingleCol>
      )}

      {chronicallyAbsent && chronicallyAbsent.length > 0 && (
        <AbsentStudentsCard students={chronicallyAbsent} />
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
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 8,
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
                  <Badge status={c.marked ? 'marked' : 'missing'} />
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{c.teacher}{c.marked ? ` · ${c.present}/${c.total} present` : ''}</span>
              </div>
            ) : (
              <HoverRow key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 8,
                alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: C.ink }}>{c.name}</span>
                <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacher}</span>
                <span style={{ color: C.soft }}>{c.marked ? `${c.present}/${c.total}` : '—'}</span>
                <Badge status={c.marked ? 'marked' : 'missing'} />
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

function UnpaidFeesCard({ rows }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  const label    = monthLabel();
  return (
    <Card>
      <CardHeader title={`Unpaid Fees by Class — ${label}`} />
      {rows === null ? (
        <SkeletonRows count={4} />
      ) : rows.length === 0 ? (
        <EmptyMsg text="No unpaid fees this month" />
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 4, padding: '0 8px',
            }}>
              <span>Class</span><span>Students</span><span style={{ textAlign: 'right' }}>Amount</span>
            </div>
          )}
          {rows.map((f, i) => (
            isMobile ? (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink }}>{f.name}</p>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.red, backgroundColor: C.redBg, marginTop: 3 }}>{f.count} unpaid</span>
                </div>
                <span style={{ fontWeight: 600, color: C.ink, fontSize: 13, flexShrink: 0 }}>{fmtPKR(f.amount)}</span>
              </div>
            ) : (
              <HoverRow key={f.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: C.ink }}>{f.name}</span>
                <span>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.red, backgroundColor: C.redBg }}>{f.count} unpaid</span>
                </span>
                <span style={{ textAlign: 'right', fontWeight: 500, color: C.ink }}>{fmtPKR(f.amount)}</span>
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

function AbsentStudentsCard({ students }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card style={{ marginTop: 16 }}>
      <CardHeader title="Students Absent 3+ Consecutive Days" />
      {!isMobile && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8,
          fontSize: 10, fontWeight: 500, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          marginBottom: 4, padding: '0 8px',
        }}>
          <span>Student</span><span>Class</span><span style={{ textAlign: 'center' }}>Days</span>
        </div>
      )}
      {students.map((s, i) => (
        isMobile ? (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.soft }}>{s.className}</p>
            </div>
            <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.red, backgroundColor: C.redBg, flexShrink: 0 }}>{s.streak}d</span>
          </div>
        ) : (
          <HoverRow key={s.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8,
            alignItems: 'center', padding: '9px 8px', borderRadius: 8,
            borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, color: C.ink }}>{s.name}</span>
            <span style={{ color: C.soft }}>{s.className}</span>
            <span style={{ textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.red, backgroundColor: C.redBg }}>{s.streak}d</span>
            </span>
          </HoverRow>
        )
      ))}
    </Card>
  );
}
