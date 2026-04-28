import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { C, Card, CardHeader, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Users      from '../../assets/icons/Users';
import Attendence from '../../assets/icons/Attendence';
import Task       from '../../assets/icons/Task';
import Chat       from '../../assets/icons/Chat';
import Check      from '../../assets/icons/Check';

const STATUS_COLOR = { present: '#22C55E', absent: '#EF4444', late: '#F59E0B', leave: '#8B5CF6' };
const STATUS_BG    = { present: '#ECFDF5', absent: '#FEF2F2', late: '#FFFBEB', leave: '#F5F3FF' };
const STATUS_LABEL = { present: 'Present',  absent: 'Absent',  late: 'Late',    leave: 'Leave' };
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

// ─── Teacher self-attendance widget ──────────────────────────────────────────
function TeacherAttendanceWidget({ profile }) {
  const td = todayISO();
  const [todayRecord,    setTodayRecord]    = useState(undefined);
  const [sessionId,      setSessionId]      = useState(null);
  const [branchId,       setBranchId]       = useState(profile?.branch_id || null);
  const [classResolved,  setClassResolved]  = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    if (!profile?.class_id) { setClassResolved(true); setTodayRecord(null); return; }
    supabase.from('classes').select('session_id, branch_id').eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
        if (data?.branch_id)  setBranchId(data.branch_id);
        if (!data?.session_id) setTodayRecord(null);
        setClassResolved(true);
      });
  }, [profile?.class_id]);

  useEffect(() => {
    if (!profile?.id || !sessionId) return;
    supabase.from('attendance').select('*').eq('person_id', profile.id).eq('role', 'teacher').eq('session_id', sessionId).eq('date', td).maybeSingle()
      .then(({ data }) => setTodayRecord(data || null));
  }, [profile?.id, sessionId, td]);

  async function handleMark(status) {
    if (!profile?.school_id || !branchId || !sessionId) return;
    setSaving(true); setError('');
    try {
      const { data, error: err } = await supabase.rpc('upsert_teacher_attendance', {
        p_school_id: profile.school_id, p_branch_id: branchId, p_session_id: sessionId,
        p_teacher_id: profile.id, p_date: td, p_status: status, p_note: null,
      });
      if (err) throw err;
      setTodayRecord(data);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally { setSaving(false); }
  }

  const isLoading = !classResolved || (classResolved && sessionId && todayRecord === undefined);

  if (isLoading) {
    return <div style={{ backgroundColor: C.borderLight, borderRadius: 14, height: 52, marginBottom: 20 }} />;
  }

  if (todayRecord) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${STATUS_COLOR[todayRecord.status]}40`, borderRadius: 14, backgroundColor: STATUS_BG[todayRecord.status], padding: '12px 18px', marginBottom: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: STATUS_COLOR[todayRecord.status], flexShrink: 0 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLOR[todayRecord.status], margin: 0 }}>
          Your attendance today: <strong>{STATUS_LABEL[todayRecord.status]}</strong>
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 14, backgroundColor: C.yellowBg, padding: '12px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.yellow, margin: 0 }}>
          {sessionId ? 'Your attendance is not marked for today.' : 'No active session assigned to your class.'}
        </p>
        {sessionId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => handleMark(s)} disabled={saving}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, backgroundColor: STATUS_COLOR[s], color: '#fff', opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s' }}>
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
  const profile  = useSelector((s) => s.auth.profile);
  const bp       = useBreakpoint();
  const navigate = useNavigate();
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const classId  = profile?.class_id;

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  // ── Resolve session from class ───────────────────────────────
  const [sessionId, setSessionId] = useState(null);
  useEffect(() => {
    if (!classId) return;
    supabase.from('classes').select('session_id').eq('id', classId).maybeSingle()
      .then(({ data }) => { if (data?.session_id) setSessionId(data.session_id); });
  }, [classId]);

  // ── Stats ────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!classId) { setStats({ students: 0, attPct: 0, present: 0, growSubmitted: 0, growTotal: 0 }); return; }
    const td   = todayISO();
    const wkSt = weekStartISO();
    async function load() {
      const [
        { count: students },
        { data: attData },
        { count: growTotal },
        { count: growSubmitted },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'student').eq('is_active', true),
        sessionId
          ? supabase.from('attendance').select('status').eq('class_id', classId).eq('role', 'student').eq('date', td)
          : Promise.resolve({ data: [] }),
        supabase.from('grow_tasks').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sessionId && profile?.id
          ? supabase.from('grow_task_submissions').select('id', { count: 'exact', head: true }).eq('awarded_by', profile.id).gte('created_at', `${wkSt}T00:00:00`)
          : Promise.resolve({ count: 0 }),
      ]);

      const attRows = attData ?? [];
      const present = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
      const attPct  = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;

      setStats({
        students:      students      ?? 0,
        attPct, present,
        growTotal:     growTotal     ?? 0,
        growSubmitted: growSubmitted ?? 0,
      });
    }
    load();
  }, [classId, sessionId, profile?.id]);

  // ── Absent students today ────────────────────────────────────
  const [absentStudents, setAbsentStudents] = useState(null);

  useEffect(() => {
    if (!classId || !sessionId) { if (!classId) setAbsentStudents([]); return; }
    const td = todayISO();
    async function load() {
      const { data: attData } = await supabase
        .from('attendance').select('person_id, status')
        .eq('class_id', classId).eq('session_id', sessionId).eq('role', 'student').eq('date', td);

      const absentIds = (attData ?? []).filter((r) => r.status === 'absent').map((r) => r.person_id);
      if (!absentIds.length) { setAbsentStudents([]); return; }

      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', absentIds);
      setAbsentStudents(profiles ?? []);
    }
    load();
  }, [classId, sessionId]);

  // ── Diary entries today ──────────────────────────────────────
  const [diaryToday, setDiaryToday] = useState(null);

  useEffect(() => {
    if (!classId) { setDiaryToday([]); return; }
    const td = todayISO();
    supabase
      .from('class_diary')
      .select('id, title, subjects')
      .eq('class_id', classId)
      .eq('is_deleted', false)
      .gte('created_at', `${td}T00:00:00`)
      .lte('created_at', `${td}T23:59:59`)
      .then(({ data }) => setDiaryToday(data ?? []));
  }, [classId]);

  // ── Chat unread count ────────────────────────────────────────
  const [chatUnread, setChatUnread] = useState(null);

  useEffect(() => {
    if (!classId || !profile?.id) { setChatUnread(0); return; }
    async function load() {
      const { data: chat } = await supabase
        .from('chats').select('id').eq('class_id', classId).maybeSingle();
      if (!chat) { setChatUnread(0); return; }

      const { data: membership } = await supabase
        .from('chat_members').select('last_read_at').eq('chat_id', chat.id).eq('profile_id', profile.id).maybeSingle();

      const lastRead = membership?.last_read_at;
      const q = supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).neq('sender_id', profile.id).eq('is_deleted', false);
      const { count } = lastRead ? await q.gt('created_at', lastRead) : await q;
      setChatUnread(count ?? 0);
    }
    load();
  }, [classId, profile?.id]);

  return (
    <div>
      <PageHeader
        greeting={`Welcome, ${profile?.name || 'Teacher'}`}
        subtitle={today}
      />

      <BannerCarousel />

      <TeacherAttendanceWidget profile={profile} />

      <StatsGrid cols={statCols}>
        <StatCard
          icon={Users} iconColor={C.blue} iconBg={C.blueBg}
          title="My Class Students" value={stats?.students ?? '—'}
          badge={classId ? 'active students' : 'no class assigned'} badgeColor={{ text: C.blue, bg: C.blueBg }}
          loading={!stats}
        />
        <StatCard
          icon={Attendence} iconColor="#fff" iconBg={C.sky}
          title="Today's Attendance" value={stats ? `${stats.attPct}%` : '—'}
          badge={stats ? `${stats.present} present` : '…'} badgeColor={{ text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
        <StatCard
          icon={Task} iconColor="#fff" iconBg={C.yellow}
          title="GrowTasks This Week" value={stats ? `${stats.growSubmitted}/${stats.growTotal}` : '—'}
          badge={stats ? `${Math.max(0, stats.growTotal - stats.growSubmitted)} pending` : '…'} badgeColor={{ text: C.yellow, bg: C.yellowBg }}
          loading={!stats}
        />
        <StatCard
          icon={Chat} iconColor={chatUnread > 0 ? '#fff' : C.blue} iconBg={chatUnread > 0 ? C.blue : C.blueBg}
          title="Chat Unread" value={chatUnread ?? '—'}
          badge={chatUnread > 0 ? 'new messages' : 'all read'} badgeColor={chatUnread > 0 ? { text: C.blue, bg: C.blueBg } : { text: C.green, bg: C.greenBg }}
          loading={chatUnread === null}
        />
      </StatsGrid>

      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <AbsentStudentsCard students={absentStudents} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GrowTasksCard navigate={navigate} />
            <DiaryCard entries={diaryToday} classId={classId} navigate={navigate} />
          </div>
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <AbsentStudentsCard students={absentStudents} />
          <GrowTasksCard navigate={navigate} />
          <DiaryCard entries={diaryToday} classId={classId} navigate={navigate} />
        </SingleCol>
      )}
    </div>
  );
}

function AbsentStudentsCard({ students }) {
  return (
    <Card>
      <CardHeader title="Absent Students — Today" />
      {students === null ? (
        <SkeletonRows count={4} />
      ) : students.length === 0 ? (
        <EmptyMsg text="No absences marked today" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {students.map((s, i) => {
            const [hov, setHov] = useState(false);
            return (
              <div
                key={s.id}
                onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                  backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
                  borderBottom: i < students.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                }}
              >
                <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', backgroundColor: C.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.red }}>
                  {s.name?.charAt(0) || '?'}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function GrowTasksCard({ navigate }) {
  const [hov, setHov] = useState(false);
  return (
    <Card>
      <CardHeader title="GrowTask Awards" />
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
        Award coins to students for Discipline, Cleanliness, and Study improvement this week.
      </p>
      <button
        onClick={() => navigate('/growtasks')}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: hov ? '#EA6C0A' : C.orange, transition: 'background-color 0.15s' }}
      >
        Open GrowTasks
      </button>
    </Card>
  );
}

function DiaryCard({ entries, classId, navigate }) {
  return (
    <Card>
      <CardHeader title="Today's Diary" action="View All" onAction={() => navigate('/diary')} />
      {entries === null ? (
        <SkeletonRows count={3} />
      ) : entries.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EmptyMsg text="No diary entries posted today" />
          {classId && (
            <button
              onClick={() => navigate('/diary')}
              style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.blue, backgroundColor: C.blueBg }}
            >
              Post Today's Diary
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: C.green, backgroundColor: C.greenBg, flexShrink: 0 }}>
                <Check size={11} color={C.green} strokeWidth={2.5} /> Posted
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
