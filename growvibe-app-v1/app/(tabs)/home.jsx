import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import TopBar from '../../components/TopBar';
import BranchSessionSelector from '../../components/BranchSessionSelector';
import BannerCarousel from '../../components/BannerCarousel';
import { useBanners } from '../../hooks/useBanners';
import { hp, wp } from '../../helpers/dimension';
import { Fonts } from '../../constant/fonts';
import { Colors } from '../../constant/colors';
import { ScreenWrapper } from '../../helpers/screenWrapper';
import { supabase } from '../../lib/supabase';
import { useAttendanceProgress } from '../../hooks/useAttendanceProgress';
import { SkeletonWidget } from '../../components/Skeleton';

// ─── Real stats hook ─────────────────────────────────────────────────────────
function useHomeStats(role, profile, selectedBranchId, selectedSessionId) {
  const [stats, setStats] = useState(null); // null = loading

  useEffect(() => {
    if (!role || !profile) return;

    async function load() {
      try {
        if (role === 'admin') {
          const [{ count: schools }, { count: owners }] = await Promise.all([
            supabase.from('schools').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner').eq('is_active', true),
          ]);
          setStats([
            { label: 'Total Schools', value: String(schools ?? 0), icon: 'business-outline',   accent: Colors.primary, bg: Colors.primaryLight },
            { label: 'Total Owners',  value: String(owners  ?? 0), icon: 'person-outline',     accent: Colors.purple,  bg: Colors.purpleLight },
          ]);

        } else if (role === 'owner' && profile.school_id) {
          const [{ count: branches }, { count: students }, { count: staff }, { data: feeData }] = await Promise.all([
            supabase.from('branches').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('is_active', true),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'student').eq('is_active', true),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).in('role', ['principal', 'coordinator', 'teacher']).eq('is_active', true),
            supabase.from('student_fee_records').select('amount_paid').eq('school_id', profile.school_id),
          ]);
          const revenue = (feeData || []).reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
          const revenueStr = revenue >= 1_000_000
            ? `${(revenue / 1_000_000).toFixed(1)}M`
            : revenue >= 1_000
              ? `${Math.round(revenue / 1_000)}k`
              : String(revenue);
          setStats([
            { label: 'Branches', value: String(branches ?? 0), icon: 'git-branch-outline', accent: Colors.primary, bg: Colors.primaryLight },
            { label: 'Students', value: String(students  ?? 0), icon: 'school-outline',    accent: Colors.purple,  bg: Colors.purpleLight },
            { label: 'Staff',    value: String(staff     ?? 0), icon: 'people-outline',    accent: Colors.success, bg: Colors.successLight },
            { label: 'Revenue',  value: revenueStr,             icon: 'cash-outline',      accent: Colors.orange,  bg: Colors.orangeLight },
          ]);

        } else if (role === 'principal' && profile.branch_id && selectedSessionId) {
          const todayStr = new Date().toISOString().split('T')[0];
          const [{ count: classes }, { count: students }, { count: teachers }, { data: attData }] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact', head: true }).eq('branch_id', profile.branch_id).eq('session_id', selectedSessionId),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', profile.branch_id).eq('role', 'student').eq('is_active', true),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', profile.branch_id).eq('role', 'teacher').eq('is_active', true),
            supabase.from('attendance').select('status').eq('branch_id', profile.branch_id).eq('session_id', selectedSessionId).eq('role', 'student').eq('date', todayStr),
          ]);
          const attRows   = attData || [];
          const present   = attRows.filter((r) => r.status === 'present' || r.status === 'late').length;
          const attPct    = attRows.length > 0 ? `${Math.round((present / attRows.length) * 100)}%` : '—';
          setStats([
            { label: 'Classes',       value: String(classes  ?? 0), icon: 'library-outline',          accent: Colors.primary, bg: Colors.primaryLight },
            { label: 'Students',      value: String(students ?? 0), icon: 'school-outline',           accent: Colors.purple,  bg: Colors.purpleLight },
            { label: 'Teachers',      value: String(teachers ?? 0), icon: 'people-outline',           accent: Colors.success, bg: Colors.successLight },
            { label: "Today's Att.",  value: attPct,                icon: 'checkmark-circle-outline', accent: Colors.orange,  bg: Colors.orangeLight },
          ]);

        } else if (role === 'coordinator' && profile.branch_id && selectedSessionId) {
          const [{ count: classes }, { count: students }] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact', head: true }).eq('branch_id', profile.branch_id).eq('session_id', selectedSessionId),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', profile.branch_id).eq('role', 'student').eq('is_active', true),
          ]);
          setStats([
            { label: 'Classes',  value: String(classes  ?? 0), icon: 'library-outline', accent: Colors.primary, bg: Colors.primaryLight },
            { label: 'Students', value: String(students ?? 0), icon: 'school-outline',  accent: Colors.purple,  bg: Colors.purpleLight },
          ]);

        } else {
          setStats([]);
        }
      } catch {
        setStats([]);
      }
    }

    setStats(null); // reset to loading state whenever inputs change
    load();
  }, [role, profile?.id, profile?.school_id, profile?.branch_id, selectedBranchId, selectedSessionId]);

  return stats;
}

// ─── Role-based management sections ──────────────────────────────────────────
// Each role has sections; each section has a title + list items (one per row)
const MANAGEMENT = {
  admin: [
    {
      title: 'Management Options',
      items: [
        { label: 'Schools',         sublabel: 'Manage all schools',            icon: 'business-outline',    accent: Colors.primary,  bg: Colors.primaryLight,  route: '/screens/school/schoolList' },
        { label: 'Owners',          sublabel: 'View & manage owners',          icon: 'person-outline',      accent: Colors.purple,   bg: Colors.purpleLight,   route: '/screens/owner/ownerList' },
        { label: 'Banners',         sublabel: 'Manage promotional banners',    icon: 'megaphone-outline',   accent: Colors.orange,   bg: Colors.orangeLight,   route: '/screens/banner/bannerList' },
      ],
    },
  ],
  owner: [
    {
      title: 'Branch Management',
      items: [
        { label: 'Sessions',     sublabel: 'Manage academic sessions',   icon: 'calendar-outline',      accent: Colors.purple,  bg: Colors.purpleLight,  route: '__sessions__' },
        { label: 'Principal',    sublabel: 'Branch principal account',   icon: 'person-circle-outline', accent: Colors.primary, bg: Colors.primaryLight, route: '__staff__', staffRole: 'principal' },
        { label: 'Coordinator',  sublabel: 'Branch coordinator account', icon: 'people-circle-outline', accent: Colors.success, bg: Colors.successLight, route: '__staff__', staffRole: 'coordinator' },
        { label: 'Teachers',     sublabel: 'Manage teaching staff',      icon: 'people-outline',        accent: Colors.orange,  bg: Colors.orangeLight,  route: '__staff__', staffRole: 'teacher' },
        { label: 'Classes',      sublabel: 'Organise classes & sections', icon: 'library-outline',      accent: Colors.success, bg: Colors.successLight, route: '__classes__' },
      ],
    },
  ],
  principal: [
    {
      title: 'School Overview',
      items: [
        { label: 'Teachers', sublabel: 'Manage teaching staff',  icon: 'people-outline',  accent: Colors.primary, bg: Colors.primaryLight, route: '__staff__', staffRole: 'teacher' },
        { label: 'Classes',  sublabel: 'Classes & sections',     icon: 'library-outline', accent: Colors.success, bg: Colors.successLight, route: '__classes__' },
      ],
    },
  ],
  coordinator: [
    {
      title: 'My Work',
      items: [
        { label: 'Classes', sublabel: 'My assigned classes', icon: 'library-outline', accent: Colors.primary, bg: Colors.primaryLight, route: '__classes__' },
      ],
    },
  ],
  teacher: [
    {
      title: 'My Work',
      items: [
        { label: 'Student Attendance', sublabel: 'Mark & view class attendance', icon: 'checkmark-circle-outline', accent: Colors.success, bg: Colors.successLight,  route: '__mark_attendance__' },
        { label: 'GrowTask Awards',    sublabel: 'Award coins for this week',    icon: 'trophy-outline',           accent: Colors.orange,  bg: Colors.orangeLight,   route: '/screens/growtask/growTaskSubmit' },
        { label: 'Class Diary',        sublabel: 'Post daily homework & tasks',  icon: 'book-outline',             accent: Colors.purple,  bg: Colors.purpleLight,   route: '__diary__' },
      ],
    },
  ],
  student: [
    {
      title: 'My Records',
      items: [
        { label: 'Fee Records', sublabel: 'View your monthly fee history', icon: 'receipt-outline', accent: Colors.primary, bg: Colors.primaryLight, route: '__student_fees__' },
      ],
    },
  ],
};

const ATTENDANCE_STATUS_COLOR = {
  present: Colors.success,
  absent:  Colors.danger,
  late:    Colors.warning,
  leave:   Colors.purple,
};
const ATTENDANCE_STATUS_BG = {
  present: Colors.successLight,
  absent:  Colors.dangerLight,
  late:    Colors.warningLight,
  leave:   Colors.purpleLight,
};
const ATTENDANCE_STATUS_LABEL = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  leave:   'Leave',
};
// ─── Teacher Self-Attendance Widget ──────────────────────────────────────────
const STATUS_COLOR = { present: Colors.success, absent: Colors.danger, late: Colors.warning, leave: Colors.purple };
const STATUS_BG    = { present: Colors.successLight, absent: Colors.dangerLight, late: Colors.warningLight, leave: Colors.purpleLight };
const STATUS_LABEL = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'Leave' };
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];

function TeacherSelfAttendanceWidget({ profile }) {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [sessionId,     setSessionId]     = useState(null);
  const [branchId,      setBranchId]      = useState(profile?.branch_id || null);
  const [classResolved, setClassResolved] = useState(false);
  const [todayRecord,   setTodayRecord]   = useState(undefined); // undefined=loading
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  // Resolve sessionId + branchId from teacher's class
  useEffect(() => {
    if (!profile?.class_id) { setClassResolved(true); setTodayRecord(null); return; }
    supabase
      .from('classes').select('session_id, branch_id').eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
        if (data?.branch_id)  setBranchId(data.branch_id);
        if (!data?.session_id) setTodayRecord(null);
        setClassResolved(true);
      });
  }, [profile?.class_id]);

  // Fetch today's record once sessionId is known
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

  const isLoading = !classResolved || (classResolved && sessionId && todayRecord === undefined);

  if (isLoading) return <SkeletonWidget />;

  return (
    <View style={W.card}>
      <View style={W.cardHeader}>
        <View style={W.iconWrap}>
          <Ionicons name="calendar-outline" size={hp(2.4)} color={Colors.primary} />
        </View>
        <Text style={W.cardTitle}>My Attendance Today</Text>
      </View>

      {todayRecord ? (
        // Already marked — show status chip
        <View style={[W.statusChip, { backgroundColor: STATUS_BG[todayRecord.status] }]}>
          <Ionicons name="checkmark-circle" size={hp(2.2)} color={STATUS_COLOR[todayRecord.status]} />
          <Text style={[W.statusText, { color: STATUS_COLOR[todayRecord.status] }]}>
            {STATUS_LABEL[todayRecord.status]}
          </Text>
        </View>
      ) : sessionId ? (
        // Not marked — show mark buttons
        <View style={{ gap: hp(1) }}>
          <Text style={{ fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted }}>
            Not marked yet — mark your attendance:
          </Text>
          <View style={W.pillRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => !saving && handleMark(s)}
                disabled={saving}
                activeOpacity={0.75}
                style={[W.pill, { backgroundColor: STATUS_COLOR[s], opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={[W.pillText, { color: '#fff' }]}>
                  {saving ? '…' : STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!error && <Text style={{ fontSize: hp(1.3), color: Colors.danger, fontFamily: Fonts.regular }}>{error}</Text>}
        </View>
      ) : (
        // No session assigned
        <View style={[W.statusChip, { backgroundColor: Colors.canvas }]}>
          <Ionicons name="time-outline" size={hp(2)} color={Colors.muted} />
          <Text style={[W.statusText, { color: Colors.muted }]}>No session assigned</Text>
        </View>
      )}
    </View>
  );
}

// ─── Student Today Attendance Widget ─────────────────────────────────────────
function StudentAttendanceWidget({ profile, router }) {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [sessionId,     setSessionId]     = useState(null);
  const [classResolved, setClassResolved] = useState(false);
  const [todayRecord,   setTodayRecord]   = useState(undefined); // undefined = loading
  const [loading,       setLoading]       = useState(false);

  // Step 1: resolve sessionId from student's class_id
  useEffect(() => {
    if (!profile?.class_id) { setClassResolved(true); setTodayRecord(null); return; }
    supabase
      .from('classes').select('session_id').eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
        else setTodayRecord(null);
        setClassResolved(true);
      });
  }, [profile?.class_id]);

  // Step 2: fetch only today's record once sessionId is known
  useEffect(() => {
    if (!profile?.id || !sessionId) return;
    setLoading(true);
    supabase
      .from('attendance')
      .select('*')
      .eq('person_id', profile.id)
      .eq('role', 'student')
      .eq('session_id', sessionId)
      .eq('date', todayStr)
      .maybeSingle()
      .then(({ data }) => { setTodayRecord(data || null); setLoading(false); });
  }, [profile?.id, sessionId, todayStr]);

  function handleHistory() {
    router.push({
      pathname: '/screens/attendance/studentSelfAttendance',
      params: {
        studentId:   profile.id,
        sessionId:   sessionId ?? '',
        studentName: profile.name,
      },
    });
  }

  const isLoading = !classResolved || (classResolved && sessionId && todayRecord === undefined) || loading;

  if (isLoading) return <SkeletonWidget />;

  if (!sessionId) {
    return (
      <View style={W.card}>
        <View style={W.cardHeader}>
          <View style={W.iconWrap}>
            <Ionicons name="calendar-outline" size={hp(2.4)} color={Colors.primary} />
          </View>
          <Text style={W.cardTitle}>My Attendance Today</Text>
        </View>
        <View style={[W.statusChip, { backgroundColor: Colors.canvas }]}>
          <Ionicons name="time-outline" size={hp(2)} color={Colors.muted} />
          <Text style={[W.statusText, { color: Colors.muted }]}>No session assigned</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={W.card}>
      <View style={W.cardHeader}>
        <View style={W.iconWrap}>
          <Ionicons name="calendar-outline" size={hp(2.4)} color={Colors.primary} />
        </View>
        <Text style={W.cardTitle}>My Attendance Today</Text>
        <TouchableOpacity onPress={handleHistory} hitSlop={8} style={W.historyBtn}>
          <Text style={W.historyBtnText}>History</Text>
          <Ionicons name="chevron-forward" size={hp(1.6)} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {todayRecord ? (
        <View style={[W.statusChip, { backgroundColor: ATTENDANCE_STATUS_BG[todayRecord.status] }]}>
          <Ionicons
            name="checkmark-circle"
            size={hp(2)}
            color={ATTENDANCE_STATUS_COLOR[todayRecord.status]}
          />
          <Text style={[W.statusText, { color: ATTENDANCE_STATUS_COLOR[todayRecord.status] }]}>
            {ATTENDANCE_STATUS_LABEL[todayRecord.status]}
          </Text>
        </View>
      ) : (
        <View style={[W.statusChip, { backgroundColor: Colors.canvas }]}>
          <Ionicons name="time-outline" size={hp(2)} color={Colors.muted} />
          <Text style={[W.statusText, { color: Colors.muted }]}>Not Marked</Text>
        </View>
      )}
    </View>
  );
}

// ─── Student Progress Section — resolves sessionId then renders widget
function StudentProgressSection({ profile }) {
  const [sessionId,     setSessionId]     = useState(null);
  const [classResolved, setClassResolved] = useState(false);

  useEffect(() => {
    if (!profile?.class_id) { setClassResolved(true); return; }
    supabase
      .from('classes').select('session_id').eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
        setClassResolved(true);
      });
  }, [profile?.class_id]);

  if (!classResolved) {
    return (
      <View style={S.section}>
        <SkeletonWidget />
      </View>
    );
  }

  if (!sessionId) return null;

  return (
    <View style={S.section}>
      <AttendanceProgressWidget profile={profile} sessionId={sessionId} />
    </View>
  );
}

// ─── Motivation line (used inside each progress block) ───────────────────────
function MotivationLine({ pct }) {
  const text = pct >= 1
    ? "Perfect! Keep this up every week to earn your coin!"
    : pct >= 0.8
      ? "You're on track — stay consistent to earn your coin!"
      : `Reach 80% attendance to earn a coin — you're at ${Math.round(pct * 100)}%!`;

  return <Text style={P.hint}>{text}</Text>;
}

// ─── Coin Progress Widget (student only) ────────────────────────────────────
function AttendanceProgressWidget({ profile, sessionId }) {
  const { weekly, monthly, loading } = useAttendanceProgress(profile?.id, sessionId);

  if (loading || !weekly || !monthly) {
    return <SkeletonWidget />;
  }

  const weekPct  = Math.round(weekly.pct  * 100);
  const monthPct = Math.round(monthly.pct * 100);

  return (
    <View style={P.card}>
      <View style={P.header}>
        <View style={P.iconWrap}>
          <Ionicons name="trophy-outline" size={hp(2.4)} color={Colors.orange} />
        </View>
        <Text style={P.title}>Coin Progress</Text>
      </View>

      {/* Weekly */}
      <View style={P.block}>
        <View style={P.labelRow}>
          <Text style={P.blockLabel}>This Week</Text>
          <Text style={P.fractionText}>
            {weekly.presentDays}
            <Text style={P.fractionMuted}> / {weekly.markedDays} marked</Text>
          </Text>
        </View>
        <View style={P.markedRow}>
          <Text style={P.markedHint}>{weekPct}% present</Text>
        </View>
        <View style={P.barTrack}>
          <View style={[P.barFill, { width: `${Math.min(weekPct, 100)}%` }]} />
        </View>
        <MotivationLine pct={weekly.pct} markedDays={weekly.markedDays} />
      </View>

      <View style={P.divider} />

      {/* Monthly */}
      <View style={P.block}>
        <View style={P.labelRow}>
          <Text style={P.blockLabel}>This Month</Text>
          <Text style={P.fractionText}>
            {monthly.presentDays}
            <Text style={P.fractionMuted}> / {monthly.markedDays} marked</Text>
          </Text>
        </View>
        <View style={P.markedRow}>
          <Text style={P.markedHint}>{monthPct}% present</Text>
        </View>
        <View style={P.barTrack}>
          <View style={[P.barFill, { width: `${Math.min(monthPct, 100)}%` }]} />
        </View>
        <MotivationLine pct={monthly.pct} markedDays={monthly.markedDays} />
      </View>
    </View>
  );
}

// ─── Student Diary Card (home screen) ────────────────────────────────────────
function StudentDiaryCard({ profile, router }) {
  const [count,   setCount]   = useState(null); // null = loading
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    if (!profile?.class_id) { setCount(0); setLoaded(true); return; }
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('class_diary')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', profile.class_id)
      .eq('is_expired', false)
      .gte('expire_date', today)
      .then(({ count: c }) => { setCount(c ?? 0); setLoaded(true); });
  }, [profile?.class_id]);

  if (!loaded) return <SkeletonWidget />;
  if (count === 0) return null; // nothing to show

  return (
    <TouchableOpacity
      style={D.card}
      activeOpacity={0.8}
      onPress={() => router.push('/screens/diary/diaryList')}
    >
      <View style={D.iconWrap}>
        <Ionicons name="book-outline" size={hp(2.6)} color={Colors.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={D.title}>Class Diary</Text>
        <Text style={D.sub}>
          {count} active {count === 1 ? 'entry' : 'entries'} from your teacher
        </Text>
      </View>
      <View style={D.arrow}>
        <Ionicons name="chevron-forward" size={hp(2)} color={Colors.purple} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Student GrowCoins Balance Card ─────────────────────────────────────────
function StudentGrowCoinsCard({ profile }) {
  const coins = profile?.grow_coins ?? 0;
  return (
    <View style={W.card}>
      <View style={W.cardHeader}>
        <View style={[W.iconWrap, { backgroundColor: Colors.orangeLight }]}>
          <Ionicons name="trophy-outline" size={hp(2.4)} color={Colors.orange} />
        </View>
        <Text style={W.cardTitle}>GrowCoins Balance</Text>
      </View>
      <View style={[W.statusChip, { backgroundColor: Colors.orangeLight }]}>
        <Ionicons name="star" size={hp(2)} color={Colors.orange} />
        <Text style={[W.statusText, { color: Colors.orange, fontFamily: Fonts.semiBold }]}>
          {coins.toLocaleString()} {coins === 1 ? 'coin' : 'coins'}
        </Text>
      </View>
    </View>
  );
}

// ─── Stat Card (2-per-row) ────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent, bg }) {
  return (
    <View style={[S.statCard, { backgroundColor: bg }]}>
      <View style={[S.statIconWrap, { backgroundColor: accent + '25' }]}>
        <Ionicons name={icon} size={hp(2.2)} color={accent} />
      </View>
      <Text style={[S.statValue, { color: accent }]}>{value}</Text>
      <Text style={[S.statLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

// ─── Management List Item (1 per row, icon left + text) ───────────────────────
function ManagementItem({ label, sublabel, icon, accent, bg, last = false, onPress }) {
  return (
    <TouchableOpacity style={[S.mgmtItem, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[S.mgmtIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={hp(2.6)} color={accent} />
      </View>
      <View style={S.mgmtText}>
        <Text style={S.mgmtLabel}>{label}</Text>
        <Text style={S.mgmtSublabel}>{sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={hp(1.8)} color={Colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);
  const role    = profile?.role;
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);
  const { banners } = useBanners(profile?.id);
  const stats = useHomeStats(role, profile, selectedBranchId, selectedSessionId);

  // For teacher: only show attendance items if they have a class assigned
  const rawSections = MANAGEMENT[role] || null;
  const sections = role === 'teacher' && !profile?.class_id
    ? null
    : rawSections?.length > 0 ? rawSections : null;

  function handleManagementPress(item) {
    if (item.route === '__sessions__') {
      router.push({
        pathname: '/screens/session/sessionList',
        params: {
          branchId:   selectedBranchId  ?? '',
          schoolId:   profile?.school_id ?? '',
          branchName: '',
        },
      });
      return;
    }
    if (item.route === '__staff__') {
      router.push({
        pathname: '/screens/staff/staffList',
        params: {
          role:       item.staffRole,
          branchId:   selectedBranchId  ?? '',
          schoolId:   profile?.school_id ?? '',
          branchName: '',
        },
      });
      return;
    }
    if (item.route === '__classes__') {
      router.push({
        pathname: '/screens/class/classList',
        params: {
          sessionId:   selectedSessionId  || '',
          branchId:    selectedBranchId   || '',
          schoolId:    profile?.school_id || '',
          sessionName: '',
          branchName:  '',
        },
      });
      return;
    }
    if (item.route === '__mark_attendance__') {
      router.push({
        pathname: '/screens/attendance/markStudentAttendance',
        params: {
          classId:  profile?.class_id ?? '',
          className: '',
          schoolId: profile?.school_id ?? '',
          // branchId + sessionId resolved inside the screen from classId
          canEdit:  'true',
        },
      });
      return;
    }
    if (item.route === '__diary__') {
      router.push('/screens/diary/diaryList');
      return;
    }
    if (item.route === '__student_fees__') {
      router.push('/screens/fee/studentFeeList');
      return;
    }
    router.push(item.route);
  }

  return (
    <View style={{backgroundColor: Colors.white, flex:1}}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hp(4), backgroundColor: Colors.white }}
      >
      <TopBar />
        {/* ── Original greeting (unchanged) ── */}
        <View style={{ paddingHorizontal: wp(4), paddingTop: hp(4) }}>
          <View className="flex-row items-center" style={{ gap: wp(1) }}>
            <Text className="text-gray-600 tracking-[-1]" style={{ fontSize: wp(5), fontFamily: Fonts.regular }}>Welcome back</Text>
            {profile?.avatar_url && profile.avatar_url.startsWith('http') ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: wp(5), height: wp(5), borderRadius: wp(2.5) }} contentFit="cover" cachePolicy="disk" />
            ) : (
              <Image source={require('../../assets/images/hi-image.jpg')} style={{ width: wp(5), height: wp(5) }} contentFit="contain" cachePolicy="disk" />
            )}
          </View>
          <Text className="text-gray-800 tracking-[-2]" style={{ fontSize: wp(10), fontFamily: Fonts.semiBold }}>{profile?.name || role}!</Text>
        </View>

        {/* ── Banner Carousel ── */}
        {banners.length > 0 && (
          <View style={{ paddingHorizontal: wp(4), marginTop: hp(2) }}>
            <BannerCarousel banners={banners} />
          </View>
        )}

        {/* ── Stats Section ── */}
        {/* stats === null means loading; [] means no stats for this role */}
        {stats === null && ['admin', 'owner', 'principal', 'coordinator'].includes(role) && (
          <View style={S.section}>
            <View style={S.statsGrid}>
              {Array.from({ length: role === 'admin' || role === 'coordinator' ? 2 : 4 }).map((_, i) => (
                <View key={i} style={[S.statCard, { backgroundColor: Colors.canvas }]}>
                  <View style={{ width: hp(4.4), height: hp(4.4), borderRadius: 12, backgroundColor: Colors.borderLight, marginBottom: hp(0.8) }} />
                  <View style={{ width: '60%', height: hp(2.8), borderRadius: 6, backgroundColor: Colors.borderLight, marginBottom: hp(0.4) }} />
                  <View style={{ width: '80%', height: hp(1.4), borderRadius: 4, backgroundColor: Colors.borderLight }} />
                </View>
              ))}
            </View>
          </View>
        )}
        {stats && stats.length > 0 && (
          <View style={S.section}>
            <View style={S.statsGrid}>
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </View>
          </View>
        )}

        {/* ── Teacher Self-Attendance Widget ── */}
        {role === 'teacher' && (
          <View style={S.section}>
            <TeacherSelfAttendanceWidget profile={profile} />
          </View>
        )}

        {/* ── Student Attendance Widget + Progress ── */}
        {role === 'student' && (
          <View style={S.section}>
            <StudentAttendanceWidget profile={profile} router={router} />
          </View>
        )}
        {role === 'student' && (
          <StudentProgressSection profile={profile} />
        )}

        {/* ── Student Diary Card ── */}
        {role === 'student' && profile?.class_id && (
          <View style={S.section}>
            <StudentDiaryCard profile={profile} router={router} />
          </View>
        )}

        {/* ── Student GrowCoins Balance ── */}
        {role === 'student' && (
          <View style={S.section}>
            <StudentGrowCoinsCard profile={profile} />
          </View>
        )}

        {/* ── Branch & Session Selector (owner only) ── */}
        {role === 'owner' && (
          <View style={S.selectorSection}>
            <BranchSessionSelector />
          </View>
        )}

        {/* ── Management Sections ── */}
        {sections && sections.length > 0 && sections.map((section) => (
          <View key={section.title} style={S.section}>
            <Text style={S.sectionTitle}>{section.title}</Text>
            <View style={S.mgmtList}>
              {section.items.map((item, idx) => (
                <ManagementItem
                  key={item.label}
                  label={item.label}
                  sublabel={item.sublabel}
                  icon={item.icon}
                  accent={item.accent}
                  bg={item.bg}
                  last={idx === section.items.length - 1}
                  onPress={() => handleManagementPress(item)}
                />
              ))}
            </View>
          </View>
        ))}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  section: {
    paddingHorizontal: wp(4),
    marginTop: hp(2.4),
  },
  selectorSection: {
    marginTop: hp(2.4),
    marginHorizontal: wp(4),
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  sectionTitle: {
    fontSize: hp(1.8),
    fontFamily: Fonts.semiBold,
    color: '#1f2937',  // text-gray-800
    letterSpacing: -0.3,
    marginBottom: hp(1.4),
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  statCard: {
    width: (wp(100) - wp(8) - wp(3)) / 2,
    borderRadius: 16,
    padding: wp(4),
    gap: hp(0.4),
  },
  statIconWrap: {
    width: hp(4.4),
    height: hp(4.4),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  statValue: {
    fontSize: hp(2.8),
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: hp(1.4),
    fontFamily: Fonts.medium,
    opacity: 0.7,
  },

  // ── Management list ────────────────────────────────────────────────────────
  mgmtList: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  mgmtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.7),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  mgmtIconWrap: {
    width: hp(5.4),
    height: hp(5.4),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mgmtText: {
    flex: 1,
    gap: 2,
  },
  mgmtLabel: {
    fontSize: hp(1.75),
    fontFamily: Fonts.semiBold,
    color: '#1f2937',
    letterSpacing: -0.2,
  },
  mgmtSublabel: {
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },
});

// ─── Widget Styles ────────────────────────────────────────────────────────────
const W = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    borderWidth: 1, borderColor: Colors.borderLight, gap: hp(1.2),
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: wp(2.5) },
  iconWrap: {
    width: hp(4.4), height: hp(4.4), borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  cardTitle:      { flex: 1, fontSize: hp(1.75), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  historyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  historyBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.primary },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: wp(4), paddingVertical: hp(1.2), borderRadius: 12,
  },
  statusText:  { fontSize: hp(1.7), fontFamily: Fonts.semiBold, flex: 1 },
  statusNote:  { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },
  markSection: { gap: hp(1) },
  markPrompt:  { fontSize: hp(1.45), fontFamily: Fonts.regular, color: Colors.soft },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: wp(4), paddingVertical: hp(1),
    borderRadius: 20, minWidth: hp(8), alignItems: 'center',
  },
  pillText: { fontSize: hp(1.55), fontFamily: Fonts.semiBold },
});

// ─── Diary Card Styles ────────────────────────────────────────────────────────
const D = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    backgroundColor: Colors.purpleLight, borderRadius: 16,
    padding: wp(4), borderWidth: 1, borderColor: Colors.purple + '30',
  },
  iconWrap: {
    width: hp(5), height: hp(5), borderRadius: 13,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { fontSize: hp(1.75), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  sub:   { fontSize: hp(1.4),  fontFamily: Fonts.regular,  color: Colors.purple, marginTop: 2 },
  arrow: {
    width: hp(3.2), height: hp(3.2), borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});

// ─── Progress Widget Styles ───────────────────────────────────────────────────
const P = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    borderWidth: 1, borderColor: Colors.borderLight, gap: hp(1.4),
  },
  header:   { flexDirection: 'row', alignItems: 'center', gap: wp(2.5) },
  iconWrap: {
    width: hp(4.4), height: hp(4.4), borderRadius: 12,
    backgroundColor: Colors.orangeLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: hp(1.75), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },

  block:    { gap: hp(0.8) },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockLabel:    { fontSize: hp(1.5),  fontFamily: Fonts.semiBold, color: Colors.ink },
  fractionText:  { fontSize: hp(1.45), fontFamily: Fonts.semiBold, color: Colors.primary },
  fractionMuted: { fontSize: hp(1.35), fontFamily: Fonts.regular,  color: Colors.muted },
  markedRow:  { flexDirection: 'row' },
  markedHint: { fontSize: hp(1.3),  fontFamily: Fonts.regular, color: Colors.muted },

  barTrack: {
    height: hp(0.9), backgroundColor: Colors.canvas, borderRadius: 999, overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: 999, backgroundColor: Colors.primary,
  },

  hint: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },

  divider: { height: 1, backgroundColor: Colors.borderLight },
});
