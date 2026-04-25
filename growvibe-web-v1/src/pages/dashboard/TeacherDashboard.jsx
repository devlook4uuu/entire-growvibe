import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { C, Card, CardHeader, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Users      from '../../assets/icons/Users';
import Attendence from '../../assets/icons/Attendence';
import Task       from '../../assets/icons/Task';
import TimeTable  from '../../assets/icons/TimeTable';
import Diary      from '../../assets/icons/Diary';
import Chat       from '../../assets/icons/Chat';
import Check      from '../../assets/icons/Check';
import { supabase } from '../../lib/supabase';
import { teacherData } from '../../data/mockData';

const STATUS_COLOR = { present: '#22C55E', absent: '#EF4444', late: '#F59E0B', leave: '#8B5CF6' };
const STATUS_BG    = { present: '#ECFDF5', absent: '#FEF2F2', late: '#FFFBEB', leave: '#F5F3FF' };
const STATUS_LABEL = { present: 'Present',  absent: 'Absent',  late: 'Late',    leave: 'Leave' };
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];

// ─── Teacher self-attendance widget ──────────────────────────────────────────
function TeacherAttendanceWidget({ profile }) {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [todayRecord,  setTodayRecord]  = useState(undefined); // undefined = loading
  const [sessionId,    setSessionId]    = useState(null);
  const [branchId,     setBranchId]     = useState(profile?.branch_id || null);
  const [classResolved, setClassResolved] = useState(false); // true once class lookup done
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // Step 1: resolve sessionId + branchId from teacher's class
  useEffect(() => {
    if (!profile?.class_id) {
      // No class assigned — not loading, just not marked
      setClassResolved(true);
      setTodayRecord(null);
      return;
    }
    supabase
      .from('classes')
      .select('session_id, branch_id')
      .eq('id', profile.class_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
        if (data?.branch_id)  setBranchId(data.branch_id);
        if (!data?.session_id) {
          // Class exists but no session — stop loading
          setTodayRecord(null);
        }
        setClassResolved(true);
      });
  }, [profile?.class_id]);

  // Step 2: fetch today's record once sessionId is known
  useEffect(() => {
    if (!profile?.id || !sessionId) return;
    supabase
      .from('attendance')
      .select('*')
      .eq('person_id', profile.id)
      .eq('role', 'teacher')
      .eq('session_id', sessionId)
      .eq('date', todayStr)
      .maybeSingle()
      .then(({ data }) => setTodayRecord(data || null));
  }, [profile?.id, sessionId, todayStr]);

  async function handleMark(status) {
    if (!profile?.school_id || !branchId || !sessionId) return;
    setSaving(true); setError('');
    try {
      const { data, error: err } = await supabase.rpc('upsert_teacher_attendance', {
        p_school_id:  profile.school_id,
        p_branch_id:  branchId,
        p_session_id: sessionId,
        p_teacher_id: profile.id,
        p_date:       todayStr,
        p_status:     status,
        p_note:       null,
      });
      if (err) throw err;
      setTodayRecord(data);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  // Loading: class not resolved yet, or class resolved + sessionId set but attendance not fetched
  const isLoading = !classResolved || (classResolved && sessionId && todayRecord === undefined);

  if (isLoading) {
    return (
      <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: C.muted }}>
        Loading attendance…
      </div>
    );
  }

  // Marked — show status chip
  if (todayRecord) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        border: `1px solid ${STATUS_COLOR[todayRecord.status]}40`, borderRadius: 14,
        backgroundColor: STATUS_BG[todayRecord.status], padding: '12px 18px', marginBottom: 20,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: STATUS_COLOR[todayRecord.status], flexShrink: 0 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLOR[todayRecord.status], margin: 0 }}>
          Your attendance today: <strong>{STATUS_LABEL[todayRecord.status]}</strong>
        </p>
      </div>
    );
  }

  // Not marked — show mark options (only if class + session resolved)
  return (
    <div style={{
      border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 14,
      backgroundColor: C.yellowBg, padding: '12px 18px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.yellow, margin: 0 }}>
          {sessionId ? 'Your attendance is not marked for today.' : 'No active session assigned to your class.'}
        </p>
        {sessionId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleMark(s)}
                disabled={saving}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 12,
                  backgroundColor: STATUS_COLOR[s], color: '#fff',
                  opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {saving ? '…' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: '#B91C1C', margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

export default function TeacherDashboard() {
  const profile = useSelector((s) => s.auth.profile);
  const bp = useBreakpoint();
  const { stats, timetable, todayDiary, classChat } = teacherData;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  return (
    <div>
      <PageHeader
        greeting={`Welcome, ${profile?.name || 'Teacher'}`}
        subtitle={today}
      />

      <BannerCarousel />

      {/* Real teacher attendance widget */}
      <TeacherAttendanceWidget profile={profile} />

      <StatsGrid cols={statCols}>
        <StatCard icon={Users}     iconColor={C.blue}   iconBg={C.blueBg}   title="My Class"            value={stats.myClass.count}                              badge={teacherData.className}                           badgeColor={{ text: C.blue,   bg: C.blueBg }} />
        <StatCard icon={Attendence} iconColor="#fff"    iconBg={C.sky}      title="Today's Attendance"  value={`${stats.todayAttendance.percentage}%`}           badge={`${stats.todayAttendance.present} present`}      badgeColor={{ text: C.green,  bg: C.greenBg }} />
        <StatCard icon={Task}      iconColor="#fff"     iconBg={C.yellow}   title="GrowTasks"           value={`${stats.growTasks.submitted}/${stats.growTasks.total}`} badge={`${stats.growTasks.pendingCategory} pending`} badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={TimeTable} iconColor={C.purple} iconBg={C.purpleBg} title="Today's Periods"     value={stats.todayTimetable.periods}                     badge={`Next: ${stats.todayTimetable.nextPeriod}`}      badgeColor={{ text: C.purple, bg: C.purpleBg }} />
      </StatsGrid>

      {/* Timetable + GrowTasks/Diary */}
      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <TimetableCard periods={timetable} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GrowTasksCard />
            <DiaryCard diary={todayDiary} />
          </div>
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <TimetableCard periods={timetable} />
          <GrowTasksCard />
          <DiaryCard diary={todayDiary} />
        </SingleCol>
      )}

      {/* Class Chat */}
      <ClassChatCard messages={classChat} unread={teacherData.unreadMessages} />
    </div>
  );
}

function TimetableCard({ periods }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Today's Timetable" />
      {!isMobile && (
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 8,
          fontSize: 10, fontWeight: 500, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          marginBottom: 4, padding: '0 8px',
        }}>
          <span>No.</span><span>Subject</span><span>Time</span><span>Teacher</span>
        </div>
      )}
      {periods.map((p, i) => (
        isMobile ? (
          <div key={p.period} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8, borderBottom: i < periods.length - 1 ? `1px solid ${C.borderLight}` : 'none', backgroundColor: p.isCurrent ? C.blueBg : 'transparent' }}>
            <span style={{ width: 24, flexShrink: 0, fontSize: 12, fontWeight: 700, color: p.isCurrent ? C.blue : C.muted, textAlign: 'center' }}>{p.period}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: p.isCurrent ? C.blue : C.ink }}>{p.subject}</span>
                {p.isCurrent && <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, backgroundColor: C.blue, color: '#fff' }}>NOW</span>}
              </div>
              <span style={{ fontSize: 11, color: C.soft }}>{p.time}</span>
            </div>
          </div>
        ) : (
          <div
            key={p.period}
            style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 8,
              alignItems: 'center', padding: '9px 8px', borderRadius: 8,
              borderBottom: i < periods.length - 1 ? `1px solid ${C.borderLight}` : 'none',
              backgroundColor: p.isCurrent ? C.blueBg : 'transparent',
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: p.isCurrent ? C.blue : C.muted }}>{p.period}</span>
            <span style={{ fontWeight: 500, color: p.isCurrent ? C.blue : C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.subject}
              {p.isCurrent && (
                <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, backgroundColor: C.blue, color: '#fff' }}>NOW</span>
              )}
            </span>
            <span style={{ color: C.soft, fontSize: 12 }}>{p.time}</span>
            <span style={{ color: C.soft, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.teacher}</span>
          </div>
        )
      ))}
    </Card>
  );
}

function GrowTasksCard() {
  const navigate = useNavigate();
  const [hov, setHov] = useState(false);
  return (
    <Card>
      <CardHeader title="GrowTask Awards" />
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
        Award coins to students for Discipline, Cleanliness, and Study improvement this week.
      </p>
      <button
        onClick={() => navigate('/growtasks')}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
          backgroundColor: hov ? '#EA6C0A' : C.orange,
          transition: 'background-color 0.15s',
        }}
      >
        Open GrowTasks
      </button>
    </Card>
  );
}

function DiaryCard({ diary }) {
  return (
    <Card>
      <CardHeader title="Today's Diary" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {diary.map((d, i) => <DiaryItem key={i} d={d} />)}
      </div>
    </Card>
  );
}

function DiaryItem({ d }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '10px 14px',
    }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0 }}>{d.subject}</p>
      {d.posted ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.green, backgroundColor: C.greenBg }}>
          <Check size={11} color={C.green} strokeWidth={2.5} /> Posted
        </span>
      ) : (
        <button
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{ borderRadius: 8, padding: '4px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: hov ? '#2563EB' : C.blue, color: '#fff', transition: 'background-color 0.15s' }}
        >Post</button>
      )}
    </div>
  );
}

function ClassChatCard({ messages, unread }) {
  const [hovView, setHovView] = useState(false);
  return (
    <Card>
      <CardHeader title="Class Chat" action="Open Chat" />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((m, i) => {
          const [hov, setHov] = useState(false);
          return (
            <li
              key={i}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                borderRadius: 8, padding: '9px 10px',
                backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
              }}
            >
              <div style={{
                width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: C.blue,
              }}>
                {m.sender.charAt(0)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, color: C.ink, margin: 0 }}>
                  <span style={{ fontWeight: 600 }}>{m.sender}: </span>
                  <span style={{ color: C.soft }}>{m.message}</span>
                </p>
                <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{m.time}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {unread > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <button
            onMouseEnter={() => setHovView(true)} onMouseLeave={() => setHovView(false)}
            style={{
              borderRadius: 10, padding: '8px 18px', border: `1px solid ${C.blue}`, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: C.blue,
              backgroundColor: hovView ? C.blueBg : 'transparent', transition: 'background-color 0.15s',
            }}
          >
            View {unread} unread messages
          </button>
        </div>
      )}
    </Card>
  );
}
