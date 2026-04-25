import { useState } from 'react';
import { C, Card, CardHeader, Badge, ActionBtn, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint, fmtPKR } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Attendence  from '../../assets/icons/Attendence';
import Application from '../../assets/icons/Application';
import Money       from '../../assets/icons/Money';
import GroupChat   from '../../assets/icons/GroupChat';
import Chat        from '../../assets/icons/Chat';
import { coordinatorData } from '../../data/mockData';

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

export default function CoordinatorDashboard() {
  const bp = useBreakpoint();
  const { stats, classAttendance, teacherApplications, unpaidFees, activeChats, unmarkedClasses } = coordinatorData;
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 3 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  return (
    <div>
      <PageHeader
        greeting="Good morning, Ayesha 👋"
        subtitle={`${today} · ${coordinatorData.branchName} · ${coordinatorData.schoolName}`}
        actions={<>
          <ActionBtn icon={Application} label="Review Leaves" />
          <ActionBtn icon={GroupChat}   label="Group Chats" primary />
        </>}
      />

      <BannerCarousel />

      {/* Alert banner */}
      {unmarkedClasses.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 14,
          backgroundColor: C.yellowBg, padding: '12px 18px', marginBottom: 20,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.yellow, flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: C.yellow, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>{unmarkedClasses.length} classes</span> have not marked attendance:{' '}
            <span style={{ fontWeight: 600 }}>{unmarkedClasses.join(', ')}</span>
          </p>
        </div>
      )}

      <StatsGrid cols={statCols}>
        <StatCard icon={Attendence}  iconColor="#fff"     iconBg={C.sky}     title="Today's Attendance"  value={`${stats.todayAttendance.percentage}%`}           badge={`${stats.todayAttendance.present} present`}  badgeColor={{ text: C.green,  bg: C.greenBg }} />
        <StatCard icon={Application} iconColor="#fff"     iconBg={C.yellow}  title="Pending Leave Apps"  value={stats.pendingApplications.count}                  badge="Awaiting you"                                badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={Money}       iconColor="#fff"     iconBg={C.red}     title="Unpaid Fees"         value={stats.feeRecords.unpaid}                          badge={fmtPKR(stats.feeRecords.pendingAmount)}      badgeColor={{ text: C.red,    bg: C.redBg }} />
      </StatsGrid>

      {/* Class Attendance + Leave Applications */}
      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAttendance} />
          <LeaveAppsCard apps={teacherApplications} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <ClassAttendanceCard rows={classAttendance} />
          <LeaveAppsCard apps={teacherApplications} />
        </SingleCol>
      )}

      {/* Unpaid Fees + Group Chats */}
      {useTwoCol ? (
        <TwoColGrid>
          <UnpaidFeesCard fees={unpaidFees} />
          <GroupChatsCard chats={activeChats} />
        </TwoColGrid>
      ) : (
        <SingleCol>
          <UnpaidFeesCard fees={unpaidFees} />
          <GroupChatsCard chats={activeChats} />
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
      <CardHeader title="Class Attendance — Today" action="All Classes" />
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
          <div key={c.className} style={{ padding: '10px 8px', borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{c.className}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge status={c.status} />
                {c.status === 'missing' && <RemindBtn />}
              </div>
            </div>
            <span style={{ fontSize: 11, color: C.soft }}>{c.teacher} · {c.status === 'marked' ? `${c.present}/${c.students} present` : 'Not marked'}</span>
          </div>
        ) : (
          <HoverRow key={c.className} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 8,
            alignItems: 'center', padding: '9px 8px', borderRadius: 8,
            borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, color: C.ink }}>{c.className}</span>
            <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacher}</span>
            <span style={{ color: C.soft }}>{c.status === 'marked' ? `${c.present}/${c.students}` : '—'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge status={c.status} />
              {c.status === 'missing' && <RemindBtn />}
            </div>
          </HoverRow>
        )
      ))}
    </Card>
  );
}

function RemindBtn() {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderRadius: 8, padding: '3px 8px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hov ? '#D97706' : C.yellow, color: '#fff', transition: 'background-color 0.15s' }}
    >Remind</button>
  );
}

function LeaveAppsCard({ apps }) {
  return (
    <Card>
      <CardHeader title="Leave Applications" action="View All" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {apps.map((a, i) => <LeaveItem key={i} a={a} />)}
      </div>
    </Card>
  );
}

function LeaveItem({ a }) {
  const [hovA, setHovA] = useState(false);
  const [hovR, setHovR] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{a.leaveType} · {a.date}</p>
        </div>
        <Badge status={a.status} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onMouseEnter={() => setHovA(true)} onMouseLeave={() => setHovA(false)}
          style={{ flex: 1, borderRadius: 8, padding: '6px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hovA ? '#16A34A' : C.green, color: '#fff', transition: 'background-color 0.15s' }}
        >Approve</button>
        <button
          onMouseEnter={() => setHovR(true)} onMouseLeave={() => setHovR(false)}
          style={{ flex: 1, borderRadius: 8, padding: '6px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hovR ? '#DC2626' : C.red, color: '#fff', transition: 'background-color 0.15s' }}
        >Reject</button>
      </div>
    </div>
  );
}

function UnpaidFeesCard({ fees }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Unpaid Fees by Class" action="Full Report" />
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
      {fees.map((f, i) => (
        isMobile ? (
          <div key={f.className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 8px', borderBottom: i < fees.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink }}>{f.className}</p>
              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.red, backgroundColor: C.redBg, marginTop: 3 }}>{f.unpaidStudents} unpaid</span>
            </div>
            <span style={{ fontWeight: 600, color: C.ink, fontSize: 13, flexShrink: 0 }}>{fmtPKR(f.pendingAmount)}</span>
          </div>
        ) : (
          <HoverRow key={f.className} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            alignItems: 'center', padding: '9px 8px', borderRadius: 8,
            borderBottom: i < fees.length - 1 ? `1px solid ${C.borderLight}` : 'none',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 500, color: C.ink }}>{f.className}</span>
            <span>
              <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.red, backgroundColor: C.redBg }}>
                {f.unpaidStudents} unpaid
              </span>
            </span>
            <span style={{ textAlign: 'right', fontWeight: 500, color: C.ink }}>{fmtPKR(f.pendingAmount)}</span>
          </HoverRow>
        )
      ))}
    </Card>
  );
}

function GroupChatsCard({ chats }) {
  return (
    <Card>
      <CardHeader title="Class Group Chats" action="Open Chats" />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {chats.map((ch, i) => {
          const [hov, setHov] = useState(false);
          return (
            <li
              key={i}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                  backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Chat size={16} color={C.blue} strokeWidth={1.6} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>{ch.className}</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.lastMessage}</p>
                </div>
              </div>
              {ch.unread > 0 && (
                <span style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 20, height: 20, borderRadius: '50%',
                  backgroundColor: C.blue, color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '0 4px',
                }}>
                  {ch.unread}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
