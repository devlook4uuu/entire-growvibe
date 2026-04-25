import { useState } from 'react';
import { C, Card, CardHeader, Badge, ActionBtn, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Users       from '../../assets/icons/Users';
import Attendence  from '../../assets/icons/Attendence';
import Money       from '../../assets/icons/Money';
import Application from '../../assets/icons/Application';
import Crown       from '../../assets/icons/Crown';
import Notes       from '../../assets/icons/Notes';
import { principalData } from '../../data/mockData';

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

export default function PrincipalDashboard() {
  const bp = useBreakpoint();
  const { stats, classAttendance, pendingApplications, topGrowCoins, recentNotes } = principalData;
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  return (
    <div>
      <PageHeader
        greeting="Good morning, Dr. Fatima 👋"
        subtitle={`${today} · ${principalData.branchName} · ${principalData.schoolName}`}
        actions={<>
          <ActionBtn icon={Notes}       label="Post Announcement" />
          <ActionBtn icon={Application} label="View Applications" primary />
        </>}
      />

      <BannerCarousel />

      <StatsGrid cols={statCols}>
        <StatCard icon={Users}       iconColor={C.blue}   iconBg={C.blueBg}   title="Branch Students"      value={stats.branchStudents.count}                           badge={`${stats.branchStudents.classes} classes`}       badgeColor={{ text: C.blue,   bg: C.blueBg }} />
        <StatCard icon={Attendence}  iconColor="#fff"     iconBg={C.sky}      title="Today's Attendance"   value={`${stats.todayAttendance.percentage}%`}               badge={`${stats.todayAttendance.unmarkedClasses} unmarked`} badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={Money}       iconColor="#fff"     iconBg={C.green}    title="April Fees Collected" value={`PKR ${(stats.aprilFees.collected / 1000).toFixed(0)}K`} badge={`${stats.aprilFees.unpaid} unpaid`}            badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={Application} iconColor="#fff"     iconBg={C.yellow}   title="Pending Applications" value={stats.pendingApplications.count}                       badge="Action needed"                                   badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
      </StatsGrid>

      {/* Class Attendance + Pending Applications */}
      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAttendance} />
          <PendingAppsCard apps={pendingApplications} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAttendance} />
          <PendingAppsCard apps={pendingApplications} />
        </SingleCol>
      )}

      {/* GrowCoins Leaderboard + Announcements */}
      {useTwoCol ? (
        <TwoColGrid>
          <GrowCoinsCard students={topGrowCoins} />
          <AnnouncementsCard notes={recentNotes} />
        </TwoColGrid>
      ) : (
        <SingleCol>
          <GrowCoinsCard students={topGrowCoins} />
          <AnnouncementsCard notes={recentNotes} />
        </SingleCol>
      )}
    </div>
  );
}

function ClassAttendanceCard({ rows }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Class Attendance — Today" action="Full View" />
      {!isMobile && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr', gap: 8,
          fontSize: 10, fontWeight: 500, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          marginBottom: 4, padding: '0 8px',
        }}>
          <span>Class</span><span>Teacher</span><span>Present</span><span>Time</span><span>Status</span>
        </div>
      )}
      {rows.map((c, i) => (
        isMobile ? (
          <div key={c.className} style={{ padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{c.className}</span>
              <Badge status={c.status} />
            </div>
            <span style={{ fontSize: 11, color: C.soft }}>{c.teacher} · {c.status === 'marked' ? `${c.present}/${c.present + c.absent} present` : 'Not marked'}</span>
          </div>
        ) : (
          <HoverRow key={c.className} style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr', gap: 8,
            alignItems: 'center', padding: '9px 8px', borderRadius: 8,
            borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, color: C.ink }}>{c.className}</span>
            <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacher}</span>
            <span style={{ color: C.soft }}>{c.status === 'marked' ? `${c.present}/${c.present + c.absent}` : '—'}</span>
            <span style={{ color: C.soft, fontSize: 12 }}>{c.markedTime}</span>
            <Badge status={c.status} />
          </HoverRow>
        )
      ))}
    </Card>
  );
}

function PendingAppsCard({ apps }) {
  return (
    <Card>
      <CardHeader title="Pending Applications" action="All Applications" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {apps.map((a, i) => {
          return <AppCard key={i} a={a} />;
        })}
      </div>
    </Card>
  );
}

function AppCard({ a }) {
  const [hovApprove, setHovApprove] = useState(false);
  const [hovReject, setHovReject] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{a.type} Application</p>
        </div>
        {a.canAction ? (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onMouseEnter={() => setHovApprove(true)} onMouseLeave={() => setHovApprove(false)}
              style={{ borderRadius: 8, padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hovApprove ? '#16A34A' : C.green, color: '#fff', transition: 'background-color 0.15s' }}
            >Approve</button>
            <button
              onMouseEnter={() => setHovReject(true)} onMouseLeave={() => setHovReject(false)}
              style={{ borderRadius: 8, padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hovReject ? '#DC2626' : C.red, color: '#fff', transition: 'background-color 0.15s' }}
            >Reject</button>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{a.awaiting}</span>
        )}
      </div>
      {!a.canAction && (
        <p style={{ fontSize: 11, color: C.soft, margin: '6px 0 0' }}>{a.awaiting}</p>
      )}
    </div>
  );
}

function GrowCoinsCard({ students }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="GrowCoins Leaderboard" action="Full Board" />
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
          <div key={s.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <span style={{ width: 24, flexShrink: 0, textAlign: 'center' }}>
              {s.rank === 1 ? <Crown size={16} color="#F59E0B" strokeWidth={1.6} /> : <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>#{s.rank}</span>}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.soft }}>{s.className}</p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.yellow, backgroundColor: C.yellowBg, flexShrink: 0 }}>{s.balance}</span>
          </div>
        ) : (
          <HoverRow key={s.rank} style={{
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
            <span style={{ fontWeight: 500, color: C.ink }}>{s.name}</span>
            <span style={{ color: C.soft, fontSize: 12 }}>{s.className}</span>
            <span style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.yellow, backgroundColor: C.yellowBg }}>
                {s.balance}
              </span>
            </span>
          </HoverRow>
        )
      ))}
    </Card>
  );
}

function AnnouncementsCard({ notes }) {
  return (
    <Card>
      <CardHeader title="Recent Announcements" action="View All" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map((n, i) => {
          const [hov, setHov] = useState(false);
          return (
            <div
              key={i}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '12px 14px',
                backgroundColor: hov ? '#F8FAFC' : C.white, transition: 'background-color 0.15s',
              }}
            >
              <div style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: 8,
                backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Notes size={14} color={C.blue} strokeWidth={1.6} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '3px 0 0' }}>
                  By {n.postedBy} · {n.date} · <span style={{ fontWeight: 500, color: C.soft, textTransform: 'capitalize' }}>{n.scope}-wide</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
