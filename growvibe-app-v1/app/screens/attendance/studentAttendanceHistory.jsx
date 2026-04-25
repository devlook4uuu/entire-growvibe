/**
 * studentAttendanceHistory.jsx
 *
 * Shows a class's full student attendance for a selected date.
 * Managers (owner/principal/coordinator) can edit.
 * Teachers can view only (their own class only).
 *
 * This is essentially the same as markStudentAttendance but reached
 * from the class card "Attendance" button (history context).
 * We reuse the same useStudentAttendance hook with the date picker.
 *
 * Route params:
 *   classId     — uuid
 *   className   — display label
 *   sessionId   — uuid
 *   schoolId    — uuid
 *   branchId    — uuid
 *   canEdit     — 'true' | 'false'
 */

import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useStudentAttendance } from '../../../hooks/useStudentAttendance';
import Avatar from '../../../components/Avatar';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];
const STATUS_COLOR = {
  present: Colors.success,
  absent:  Colors.danger,
  late:    Colors.warning,
  leave:   Colors.purple,
};
const STATUS_BG = {
  present: Colors.successLight,
  absent:  Colors.dangerLight,
  late:    Colors.warningLight,
  leave:   Colors.purpleLight,
};
const STATUS_LABEL = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  leave:   'Leave',
};

function formatDisplay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ student, localStatus, onStatusChange, canEdit }) {
  const record = student.attendance;
  const activeStatus = localStatus ?? record?.status ?? null;

  return (
    <View style={R.row}>
      <Avatar url={student.avatar_url} name={student.name || ''} size={hp(5)} />
      <View style={R.nameWrap}>
        <Text style={R.name} numberOfLines={1}>{student.name || '—'}</Text>
        {!activeStatus && <Text style={R.notMarked}>Not Marked</Text>}
      </View>
      <View style={R.pills}>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[R.pill, { backgroundColor: activeStatus === s ? STATUS_COLOR[s] : STATUS_BG[s] }]}
            onPress={() => canEdit && onStatusChange(student.id, s)}
            activeOpacity={canEdit ? 0.75 : 1}
            disabled={!canEdit}
          >
            <Text style={[R.pillText, { color: activeStatus === s ? '#fff' : STATUS_COLOR[s] }]}>
              {STATUS_LABEL[s].slice(0, 1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StudentAttendanceHistory() {
  const router = useRouter();
  const { classId, className, sessionId: paramSessionId, schoolId, branchId: paramBranchId, canEdit: canEditParam } = useLocalSearchParams();
  const canEdit = canEditParam === 'true';

  // Resolve sessionId + branchId from class if not passed (teacher home nav)
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [branchId,  setBranchId]  = useState(paramBranchId  || null);

  useEffect(() => {
    if ((paramSessionId && paramBranchId) || !classId) return;
    supabase
      .from('classes').select('session_id, branch_id').eq('id', classId).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id && !paramSessionId) setSessionId(data.session_id);
        if (data?.branch_id  && !paramBranchId)  setBranchId(data.branch_id);
      });
  }, [classId, paramSessionId, paramBranchId]);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { students, loading, refreshing, submitting, error, refresh, submitAttendance } =
    useStudentAttendance(classId, sessionId, selectedDate, canEdit);

  const [localStatuses, setLocalStatuses] = useState({});

  function handleStatusChange(studentId, status) {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function shiftDate(delta) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (next > todayStr) return;
    setSelectedDate(next);
    setLocalStatuses({});
  }

  async function handleSubmit() {
    const records = students.map((s) => {
      const status = localStatuses[s.id] ?? s.attendance?.status;
      return status ? { studentId: s.id, status, note: null } : null;
    }).filter(Boolean);

    if (records.length === 0) return;

    try {
      await submitAttendance({ schoolId, branchId: branchId ?? '', records });
      setLocalStatuses({});
    } catch (e) {
      // error surfaced via hook
    }
  }

  const hasChanges = Object.keys(localStatuses).length > 0;

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={S.headerText}>
          <Text style={S.headerTitle} numberOfLines={1}>{className || 'Class'}</Text>
          <Text style={S.headerSub}>Attendance History</Text>
        </View>
        {refreshing && <ActivityIndicator color={Colors.primary} />}
      </View>

      {/* Date bar */}
      <View style={S.dateBar}>
        <TouchableOpacity onPress={() => shiftDate(-1)} hitSlop={8} style={S.navBtn}>
          <Ionicons name="chevron-back" size={hp(2.3)} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={S.dateLabel}>{formatDisplay(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => shiftDate(1)}
          hitSlop={8}
          style={S.navBtn}
          disabled={selectedDate >= todayStr}
        >
          <Ionicons name="chevron-forward" size={hp(2.3)} color={selectedDate >= todayStr ? Colors.muted : Colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={S.legend}>
        {STATUS_OPTIONS.map((s) => (
          <View key={s} style={[S.legendPill, { backgroundColor: STATUS_BG[s] }]}>
            <Text style={[S.legendText, { color: STATUS_COLOR[s] }]}>{STATUS_LABEL[s].slice(0, 1)} = {STATUS_LABEL[s]}</Text>
          </View>
        ))}
      </View>

      {/* Attendance summary badges */}
      {!loading && students.length > 0 && (
        <View style={S.summary}>
          {STATUS_OPTIONS.map((s) => {
            const count = students.filter((st) =>
              (localStatuses[st.id] ?? st.attendance?.status) === s
            ).length;
            if (count === 0) return null;
            return (
              <View key={s} style={[S.summaryBadge, { backgroundColor: STATUS_BG[s] }]}>
                <Text style={[S.summaryText, { color: STATUS_COLOR[s] }]}>{STATUS_LABEL[s]}: {count}</Text>
              </View>
            );
          })}
          {(() => {
            const notMarked = students.filter((st) => !(localStatuses[st.id] ?? st.attendance?.status)).length;
            return notMarked > 0 ? (
              <View style={[S.summaryBadge, { backgroundColor: Colors.canvas }]}>
                <Text style={[S.summaryText, { color: Colors.muted }]}>Not Marked: {notMarked}</Text>
              </View>
            ) : null;
          })()}
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: hp(6) }} />
      ) : error ? (
        <View style={S.errorWrap}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={S.retryBtn}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : students.length === 0 ? (
        <View style={S.emptyWrap}>
          <Ionicons name="school-outline" size={hp(5)} color={Colors.muted} />
          <Text style={S.emptyTitle}>No students in this class</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StudentRow
              student={item}
              localStatus={localStatuses[item.id] ?? null}
              onStatusChange={handleStatusChange}
              canEdit={canEdit}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: wp(4), paddingBottom: hp(12) }}
          onRefresh={refresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Submit bar (managers only, when there are changes) */}
      {canEdit && hasChanges && (
        <View style={S.submitBar}>
          <TouchableOpacity
            style={[S.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={hp(2.2)} color="#fff" />
                  <Text style={S.submitText}>Save Attendance</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(2),
  },
  backBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: 12,
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted },

  dateBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), marginBottom: hp(1.5),
    backgroundColor: Colors.canvas, marginHorizontal: wp(4),
    borderRadius: 14, paddingVertical: hp(1.2),
  },
  navBtn:    { padding: hp(0.4) },
  dateLabel: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink },

  legend: {
    flexDirection: 'row', gap: 6, paddingHorizontal: wp(4), marginBottom: hp(1), flexWrap: 'wrap',
  },
  legendPill: { paddingHorizontal: wp(2.5), paddingVertical: hp(0.5), borderRadius: 20 },
  legendText: { fontSize: hp(1.25), fontFamily: Fonts.medium },

  summary: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: wp(4), marginBottom: hp(1.5),
  },
  summaryBadge: { paddingHorizontal: wp(3), paddingVertical: hp(0.6), borderRadius: 20 },
  summaryText:  { fontSize: hp(1.35), fontFamily: Fonts.semiBold },

  errorWrap: { alignItems: 'center', marginTop: hp(6), gap: hp(1) },
  errorText: { fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.danger },
  retryBtn:  { paddingHorizontal: wp(5), paddingVertical: hp(1.2), backgroundColor: Colors.primaryLight, borderRadius: 10 },
  retryText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.primary },

  emptyWrap: { alignItems: 'center', marginTop: hp(8), gap: hp(1.5) },
  emptyTitle:{ fontSize: hp(1.8), fontFamily: Fonts.medium, color: Colors.muted },

  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: wp(4), backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: hp(1.8), alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  submitText: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: '#fff' },
});

const R = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    backgroundColor: Colors.white, borderRadius: 14, padding: wp(3.5),
    marginBottom: hp(1.2),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  nameWrap: { flex: 1, gap: 2 },
  name:      { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  notMarked: { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted },
  pills:     { flexDirection: 'row', gap: 5 },
  pill: {
    width: hp(3.4), height: hp(3.4), borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  pillText:  { fontSize: hp(1.35), fontFamily: Fonts.bold },
});
