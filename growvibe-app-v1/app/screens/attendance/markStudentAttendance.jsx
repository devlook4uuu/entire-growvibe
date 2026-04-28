/**
 * markStudentAttendance.jsx
 *
 * Shows all students in a class for a selected date.
 * Teacher: can mark today's attendance (submit = INSERT, cannot edit past records).
 * Managers (owner/principal/coordinator): can view and edit any date.
 *
 * Route params:
 *   classId     — uuid (required)
 *   className   — display label
 *   sessionId   — uuid (required)
 *   schoolId    — uuid (required)
 *   branchId    — uuid (required)
 *   canEdit     — 'true' | 'false'
 */

import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useStudentAttendance } from '../../../hooks/useStudentAttendance';
import Avatar from '../../../components/Avatar';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';

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

// ─── Date picker helpers ──────────────────────────────────────────────────────
function formatDisplay(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ student, localStatus, onStatusChange, canEdit }) {
  const record = student.attendance;
  // localStatus overrides record status during editing
  const activeStatus = localStatus ?? record?.status ?? null;

  return (
    <View style={R.row}>
      <Avatar url={student.avatar_url} name={student.name || ''} size={hp(5)} />
      <View style={R.nameWrap}>
        <Text style={R.name} numberOfLines={1}>{student.name || '—'}</Text>
        {!activeStatus && (
          <Text style={R.notMarked}>Not Marked</Text>
        )}
      </View>
      {/* Status pills */}
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
export default function MarkStudentAttendance() {
  const router   = useRouter();
  const profile  = useSelector((s) => s.auth.profile);
  const isManager = ['owner', 'principal', 'coordinator'].includes(profile?.role);
  const { classId, className, sessionId: paramSessionId, schoolId, branchId: paramBranchId, canEdit: canEditParam } = useLocalSearchParams();
  const canEdit = canEditParam === 'true';

  // sessionId + branchId may not be passed when teacher navigates from home.
  // Resolve both from the class table if missing.
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [branchId,  setBranchId]  = useState(paramBranchId  || null);
  const [resolving, setResolving] = useState((!paramSessionId || !paramBranchId) && !!classId);

  useEffect(() => {
    if ((paramSessionId && paramBranchId) || !classId) {
      setResolving(false);
      return;
    }
    supabase
      .from('classes')
      .select('session_id, branch_id')
      .eq('id', classId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.session_id && !paramSessionId) setSessionId(data.session_id);
        if (data?.branch_id  && !paramBranchId)  setBranchId(data.branch_id);
        setResolving(false);
      });
  }, [classId, paramSessionId, paramBranchId]);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { students, loading, refreshing, submitting, error, refresh, submitAttendance } =
    useStudentAttendance(classId, sessionId, selectedDate, canEdit);

  // Local overrides: { [studentId]: status }
  const [localStatuses, setLocalStatuses] = useState({});

  function handleStatusChange(studentId, status) {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function shiftDate(delta) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (next > todayStr) return; // never allow future dates
    setSelectedDate(next);
    setLocalStatuses({});
  }

  function handleSubmit() {
    // Merge: start with existing records, overlay localStatuses
    const records = students.map((s) => {
      const status = localStatuses[s.id] ?? s.attendance?.status;
      return status ? { studentId: s.id, status, note: null } : null;
    }).filter(Boolean);

    if (records.length === 0) return;

    Alert.alert(
      'Save Attendance',
      `Submit attendance for ${records.length} student${records.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await submitAttendance({ schoolId, branchId: branchId ?? '', records });
              setLocalStatuses({});
            } catch (e) {
              // error surfaced by hook
            }
          },
        },
      ]
    );
  }

  const hasChanges = Object.keys(localStatuses).length > 0;
  // Teachers can only mark/edit today. Managers can edit any past date.
  const isEditable = canEdit && selectedDate <= todayStr && (isManager || selectedDate === todayStr);

  if (resolving) {
    return (
      <ScreenWrapper>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: hp(10) }} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={S.headerText}>
          <Text style={S.headerTitle} numberOfLines={1}>{className || 'Class'}</Text>
          <Text style={S.headerSub}>Student Attendance</Text>
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
          disabled={!canEdit && selectedDate >= todayStr}
        >
          <Ionicons name="chevron-forward" size={hp(2.3)} color={(!canEdit && selectedDate >= todayStr) ? Colors.muted : Colors.ink} />
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
              canEdit={isEditable}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: wp(4), paddingBottom: hp(12) }}
          onRefresh={refresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Submit button */}
      {isEditable && hasChanges && (
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
    flexDirection: 'row', gap: 6, paddingHorizontal: wp(4), marginBottom: hp(1.5), flexWrap: 'wrap',
  },
  legendPill: { paddingHorizontal: wp(2.5), paddingVertical: hp(0.5), borderRadius: 20 },
  legendText: { fontSize: hp(1.25), fontFamily: Fonts.medium },

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

// Student row styles
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
