import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { C, Card, CardHeader, Badge, ActionBtn, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Users       from '../../assets/icons/Users';
import Attendence  from '../../assets/icons/Attendence';
import Money       from '../../assets/icons/Money';
import Branch      from '../../assets/icons/Branch';
import Application from '../../assets/icons/Application';
import BranchSessionSelector from '../../components/shared/BranchSessionSelector';
import { ownerData } from '../../data/mockData';

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

function AppItem({ a }) {
  const [hovReview, setHovReview] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{a.type} · {a.classBranch}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Badge status={a.status} />
        <button
          onMouseEnter={() => setHovReview(true)} onMouseLeave={() => setHovReview(false)}
          style={{
            borderRadius: 8, padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            backgroundColor: hovReview ? '#2563EB' : C.blue, color: '#fff', transition: 'background-color 0.15s',
          }}
        >
          Review
        </button>
      </div>
    </div>
  );
}

function ActivityItem({ a }) {
  const [hov, setHov] = useState(false);
  return (
    <li
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderRadius: 8,
        listStyle: 'none', backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
      }}
    >
      <div style={{
        width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
        backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: C.blue, marginTop: 1,
      }}>
        {a.actor.charAt(0)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, color: C.ink, margin: 0 }}>
          <span style={{ fontWeight: 600 }}>{a.actor}</span>
          {' '}
          <span style={{ color: C.soft }}>{a.action}</span>
        </p>
        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{a.timeAgo}</p>
      </div>
    </li>
  );
}

export default function OwnerDashboard() {
  const bp       = useBreakpoint();
  const navigate = useNavigate();
  const { stats, branchAttendance, feeCollection, recentActivity, pendingApplications } = ownerData;
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const feeChartData = feeCollection.map((b) => ({
    name: b.branch.replace(' Branch', '').replace(' Campus', ''),
    Collected: b.collected,
    Remaining: b.total - b.collected,
  }));

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  return (
    <div>
      <PageHeader
        greeting="Good morning, Hassan 👋"
        subtitle={`${today} · ${ownerData.schoolName} · ${ownerData.branches} Branches`}
        actions={<ActionBtn icon={Application} label="Applications" primary />}
      />

      <BannerCarousel />

      {/* ── Branch & Session Selector ── */}
      <BranchSessionSelector onCreateSession={() => navigate('/sessions')} />

      <StatsGrid cols={statCols}>
        <StatCard icon={Users}      iconColor={C.blue}   iconBg={C.blueBg}   title="Total Students"     value={stats.totalStudents.count.toLocaleString()}           badge="all branches"                                        badgeColor={{ text: C.blue,   bg: C.blueBg }} />
        <StatCard icon={Attendence} iconColor="#fff"      iconBg={C.sky}      title="Today's Attendance" value={`${stats.todayAttendance.percentage}%`}                badge={`${stats.todayAttendance.present} present`}          badgeColor={{ text: C.green,  bg: C.greenBg }} />
        <StatCard icon={Money}      iconColor="#fff"      iconBg={C.green}    title="Fees Collected"     value={fmtPKR(stats.feesCollected.amount)}                   badge={`${stats.feesCollected.unpaid} unpaid`}              badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={Branch}     iconColor={C.purple}  iconBg={C.purpleBg} title="Active Staff"       value={stats.activeStaff.count}                              badge="teachers & staff"                                    badgeColor={{ text: C.purple, bg: C.purpleBg }} />
      </StatsGrid>

      {/* Branch Attendance + Fee Chart */}
      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <BranchAttendanceCard rows={branchAttendance} />
          <FeeChartCard feeChartData={feeChartData} feeCollection={feeCollection} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <BranchAttendanceCard rows={branchAttendance} />
          <FeeChartCard feeChartData={feeChartData} feeCollection={feeCollection} />
        </SingleCol>
      )}

      {/* Applications + Activity */}
      {useTwoCol ? (
        <TwoColGrid>
          <Card>
            <CardHeader title="Pending Applications" action="View All" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingApplications.map((a, i) => <AppItem key={i} a={a} />)}
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent Activity" />
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentActivity.map((a, i) => <ActivityItem key={i} a={a} />)}
            </ul>
          </Card>
        </TwoColGrid>
      ) : (
        <SingleCol>
          <Card>
            <CardHeader title="Pending Applications" action="View All" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingApplications.map((a, i) => <AppItem key={i} a={a} />)}
            </div>
          </Card>
          <Card>
            <CardHeader title="Recent Activity" />
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentActivity.map((a, i) => <ActivityItem key={i} a={a} />)}
            </ul>
          </Card>
        </SingleCol>
      )}
    </div>
  );
}

function BranchAttendanceCard({ rows }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Branch Attendance — Today" action="Detailed View" />
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
          <div key={b.branch} style={{ padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{b.branch}</span>
              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: b.percentage >= 90 ? '#15803D' : '#B45309', backgroundColor: b.percentage >= 90 ? '#ECFDF5' : '#FFFBEB' }}>{b.percentage}%</span>
            </div>
            <span style={{ fontSize: 11, color: C.soft }}>{b.present} present · {b.absent} absent</span>
          </div>
        ) : (
          <HoverRow key={b.branch} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
            alignItems: 'center', padding: '10px 8px', borderRadius: 8,
            borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, color: C.ink }}>{b.branch}</span>
            <span style={{ color: C.soft }}>{b.present}</span>
            <span style={{ color: C.soft }}>{b.absent}</span>
            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: b.percentage >= 90 ? '#15803D' : '#B45309', backgroundColor: b.percentage >= 90 ? '#ECFDF5' : '#FFFBEB' }}>
              {b.percentage}%
            </span>
          </HoverRow>
        )
      ))}
    </Card>
  );
}

function FeeChartCard({ feeChartData, feeCollection }) {
  return (
    <Card>
      <CardHeader title="Fee Collection — April 2026" action="Full Report" />
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={feeChartData} barGap={4} barCategoryGap="32%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtPKR} width={56} />
          <Tooltip formatter={(v) => [`PKR ${v.toLocaleString()}`, '']} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} cursor={{ fill: '#F8FAFC' }} />
          <Bar dataKey="Collected" fill={C.green}  radius={[5, 5, 0, 0]} />
          <Bar dataKey="Remaining" fill={C.border} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {feeCollection.map((b) => (
          <div key={b.branch} style={{
            flex: '1 1 120px', borderRadius: 10, backgroundColor: C.canvas, padding: '10px 12px',
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>{b.branch}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '4px 0 0' }}>{fmtPKR(b.collected)}</p>
            <p style={{ fontSize: 11, color: C.yellow, fontWeight: 500, margin: '2px 0 0' }}>{b.unpaid} unpaid</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
