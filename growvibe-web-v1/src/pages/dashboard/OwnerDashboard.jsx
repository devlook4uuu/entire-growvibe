import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, Card, CardHeader, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import BranchSessionSelector from '../../components/shared/BranchSessionSelector';
import Users      from '../../assets/icons/Users';
import Attendence from '../../assets/icons/Attendence';
import Money      from '../../assets/icons/Money';
import Branch     from '../../assets/icons/Branch';

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

export default function OwnerDashboard() {
  const bp       = useBreakpoint();
  const navigate = useNavigate();
  const profile  = useSelector((s) => s.auth.profile);
  const schoolId = profile?.school_id;
  const today    = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  // ── Stats ────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    const td = todayISO();
    async function load() {
      const [
        { count: students },
        { count: staff },
        { data: attData },
        { data: feeData },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student').eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).in('role', ['principal', 'coordinator', 'teacher']).eq('is_active', true),
        supabase.from('attendance').select('status').eq('school_id', schoolId).eq('role', 'student').eq('date', td),
        supabase.from('student_fee_records').select('amount_paid, fee_amount, payment_status').eq('school_id', schoolId).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const attRows    = attData ?? [];
      const present    = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
      const attPct     = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;

      const feeRows    = feeData ?? [];
      const collected  = feeRows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
      const unpaid     = feeRows.filter((r) => r.payment_status === 'unpaid' || r.payment_status === 'partial').length;

      setStats({
        students:  students ?? 0,
        staff:     staff    ?? 0,
        attPct,
        present,
        collected,
        unpaid,
      });
    }
    load();
  }, [schoolId]);

  // ── Branch attendance ────────────────────────────────────────
  const [branchAtt, setBranchAtt] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    const td = todayISO();
    async function load() {
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');

      if (!branches?.length) { setBranchAtt([]); return; }

      const rows = await Promise.all(branches.map(async (b) => {
        const { data: att } = await supabase
          .from('attendance')
          .select('status')
          .eq('branch_id', b.id)
          .eq('role', 'student')
          .eq('date', td);
        const attRows = att ?? [];
        const present = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
        const absent  = attRows.filter((r) => r.status === 'absent').length;
        const pct     = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;
        return { id: b.id, name: b.name, present, absent, total: attRows.length, pct };
      }));
      setBranchAtt(rows);
    }
    load();
  }, [schoolId]);

  // ── Fee collection by branch ─────────────────────────────────
  const [feeBranches, setFeeBranches] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    async function load() {
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');

      if (!branches?.length) { setFeeBranches([]); return; }

      const rows = await Promise.all(branches.map(async (b) => {
        const { data: fees } = await supabase
          .from('student_fee_records')
          .select('fee_amount, amount_paid, payment_status')
          .eq('branch_id', b.id)
          .gte('created_at', monthStart);
        const feeRows  = fees ?? [];
        const total     = feeRows.reduce((s, r) => s + (Number(r.fee_amount)   || 0), 0);
        const collected = feeRows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
        const unpaid    = feeRows.filter((r) => r.payment_status === 'unpaid' || r.payment_status === 'partial').length;
        const pct       = total > 0 ? Math.round((collected / total) * 100) : 0;
        return { id: b.id, name: b.name, total, collected, unpaid, pct };
      }));
      setFeeBranches(rows);
    }
    load();
  }, [schoolId]);

  // ── Unmarked classes today ───────────────────────────────────
  const [unmarked, setUnmarked] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    const td = todayISO();
    async function load() {
      const { data: classes } = await supabase
        .from('classes')
        .select('id, class_name')
        .eq('school_id', schoolId);

      if (!classes?.length) { setUnmarked([]); return; }

      const { data: markedClasses } = await supabase
        .from('attendance')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('date', td)
        .eq('role', 'student');

      const markedIds = new Set((markedClasses ?? []).map((r) => r.class_id));
      setUnmarked(classes.filter((c) => !markedIds.has(c.id)));
    }
    load();
  }, [schoolId]);

  return (
    <div>
      <PageHeader
        greeting={`Welcome, ${profile?.name || 'Owner'}`}
        subtitle={today}
      />

      <BannerCarousel />

      <BranchSessionSelector onCreateSession={() => navigate('/sessions')} />

      <StatsGrid cols={statCols}>
        <StatCard
          icon={Users} iconColor={C.blue} iconBg={C.blueBg}
          title="Active Students" value={stats?.students.toLocaleString() ?? '—'}
          badge="all branches" badgeColor={{ text: C.blue, bg: C.blueBg }}
          loading={!stats}
        />
        <StatCard
          icon={Attendence} iconColor="#fff" iconBg={C.sky}
          title="Today's Attendance" value={stats ? `${stats.attPct}%` : '—'}
          badge={stats ? `${stats.present} present` : '…'} badgeColor={{ text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
        <StatCard
          icon={Money} iconColor="#fff" iconBg={C.green}
          title={`Fees Collected — ${monthLabel()}`} value={stats ? fmtPKR(stats.collected) : '—'}
          badge={stats ? `${stats.unpaid} unpaid` : '…'} badgeColor={{ text: C.yellow, bg: C.yellowBg }}
          loading={!stats}
        />
        <StatCard
          icon={Branch} iconColor={C.purple} iconBg={C.purpleBg}
          title="Active Staff" value={stats?.staff ?? '—'}
          badge="teachers & staff" badgeColor={{ text: C.purple, bg: C.purpleBg }}
          loading={!stats}
        />
      </StatsGrid>

      {/* Unmarked classes alert */}
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

      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <BranchAttendanceCard rows={branchAtt} />
          <FeeProgressCard rows={feeBranches} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <BranchAttendanceCard rows={branchAtt} />
          <FeeProgressCard rows={feeBranches} />
        </SingleCol>
      )}
    </div>
  );
}

function BranchAttendanceCard({ rows }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Branch Attendance — Today" />
      {rows === null ? (
        <SkeletonRows count={3} />
      ) : rows.length === 0 ? (
        <EmptyMsg text="No attendance data for today" />
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 4, padding: '0 8px',
            }}>
              <span>Branch</span><span>Present</span><span>Absent</span><span>Rate</span>
            </div>
          )}
          {rows.map((b, i) => (
            isMobile ? (
              <div key={b.id} style={{ padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{b.name}</span>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: b.pct >= 80 ? '#15803D' : '#B45309', backgroundColor: b.pct >= 80 ? '#ECFDF5' : '#FFFBEB' }}>{b.pct}%</span>
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{b.present} present · {b.absent} absent</span>
              </div>
            ) : (
              <HoverRow key={b.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
                alignItems: 'center', padding: '10px 8px', borderRadius: 8,
                borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: C.ink }}>{b.name}</span>
                <span style={{ color: C.soft }}>{b.present}</span>
                <span style={{ color: C.soft }}>{b.absent}</span>
                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: b.pct >= 80 ? '#15803D' : '#B45309', backgroundColor: b.pct >= 80 ? '#ECFDF5' : '#FFFBEB' }}>
                  {b.pct}%
                </span>
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

function FeeProgressCard({ rows }) {
  const label = monthLabel();
  return (
    <Card>
      <CardHeader title={`Fee Collection — ${label}`} />
      {rows === null ? (
        <SkeletonRows count={3} />
      ) : rows.length === 0 ? (
        <EmptyMsg text="No fee data for this month" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((b) => (
            <div key={b.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{b.name}</span>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {fmtPKR(b.collected)} / {fmtPKR(b.total)}
                  {b.unpaid > 0 && <span style={{ marginLeft: 8, color: C.yellow, fontWeight: 600 }}>{b.unpaid} unpaid</span>}
                </span>
              </div>
              <div style={{ height: 8, backgroundColor: C.borderLight, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(b.pct, 100)}%`,
                  backgroundColor: b.pct >= 80 ? C.green : b.pct >= 50 ? C.yellow : C.red,
                  borderRadius: 999,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{b.pct}% collected</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
