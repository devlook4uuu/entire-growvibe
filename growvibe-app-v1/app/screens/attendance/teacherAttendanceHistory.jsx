/**
 * teacherAttendanceHistory.jsx
 *
 * Calendar view of a teacher's attendance for a session.
 * Managers (owner/principal/coordinator) can tap any day to mark/edit.
 * Teachers can view only.
 *
 * Route params:
 *   teacherId    — uuid (required)
 *   teacherName  — display label
 *   sessionId    — uuid (required)
 *   schoolId     — uuid (required for manager upsert)
 *   branchId     — uuid (required for manager upsert)
 *   canEdit      — 'true' | 'false'  (managers pass 'true')
 */

import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTeacherAttendance } from '../../../hooks/useTeacherAttendance';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

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
const STATUS_OPTIONS = ['present', 'absent', 'late', 'leave'];

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Mark Modal ───────────────────────────────────────────────────────────────
function MarkModal({ visible, date, existingRecord, onClose, onSave, saving }) {
  const [status, setStatus] = useState(existingRecord?.status || 'present');
  const [note,   setNote]   = useState(existingRecord?.note   || '');

  // Reset when date changes
  useState(() => {
    setStatus(existingRecord?.status || 'present');
    setNote(existingRecord?.note || '');
  });

  const displayDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={M.overlay}>
        <View style={M.sheet}>
          <View style={M.sheetHeader}>
            <Text style={M.sheetTitle}>{existingRecord ? 'Edit Attendance' : 'Mark Attendance'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={hp(2.6)} color={Colors.ink} />
            </TouchableOpacity>
          </View>
          <Text style={M.dateLabel}>{displayDate}</Text>

          {/* Status pills */}
          <View style={M.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[M.statusPill, { backgroundColor: status === s ? STATUS_COLOR[s] : STATUS_BG[s] }]}
                onPress={() => setStatus(s)}
                activeOpacity={0.8}
              >
                <Text style={[M.statusPillText, { color: status === s ? '#fff' : STATUS_COLOR[s] }]}>
                  {STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[M.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => onSave({ status, note: note.trim() || null })}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={M.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, recordsByDate, canEdit, onDayPress, todayStr }) {
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDay     = getFirstDayOfMonth(year, month);

  const cells = [];
  // Leading empty cells
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={C.calGrid}>
      {/* Day headers */}
      {DAY_NAMES.map((d) => (
        <Text key={d} style={C.dayHeader}>{d}</Text>
      ))}
      {/* Day cells */}
      {cells.map((day, idx) => {
        if (day === null) return <View key={`e-${idx}`} style={C.dayCell} />;
        const dateStr = toDateStr(year, month, day);
        const record  = recordsByDate[dateStr];
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;

        const bg = record ? STATUS_BG[record.status] : (isFuture ? 'transparent' : Colors.canvas);
        const color = record ? STATUS_COLOR[record.status] : Colors.muted;
        const borderColor = isToday ? Colors.primary : 'transparent';

        return (
          <TouchableOpacity
            key={dateStr}
            style={[C.dayCell, { backgroundColor: bg, borderColor, borderWidth: isToday ? 2 : 0 }]}
            onPress={() => !isFuture && canEdit && onDayPress(dateStr, record)}
            activeOpacity={canEdit && !isFuture ? 0.7 : 1}
            disabled={isFuture}
          >
            <Text style={[C.dayNum, { color: isToday ? Colors.primary : Colors.ink, fontFamily: isToday ? Fonts.semiBold : Fonts.regular }]}>
              {day}
            </Text>
            {record && (
              <Text style={[C.dayStatus, { color }]}>
                {STATUS_LABEL[record.status].slice(0, 3)}
              </Text>
            )}
            {!record && !isFuture && (
              <Text style={[C.dayStatus, { color: Colors.muted }]}>—</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TeacherAttendanceHistory() {
  const router = useRouter();
  const { teacherId, teacherName, sessionId: paramSessionId, schoolId, branchId, canEdit: canEditParam } = useLocalSearchParams();
  const canEdit = canEditParam === 'true';

  // sessionId may be empty when navigating from staffList (manager path).
  // Resolve from teacher's class in that case.
  const [sessionId, setSessionId] = useState(paramSessionId || null);

  useEffect(() => {
    if (paramSessionId || !teacherId) return;
    supabase
      .from('classes')
      .select('session_id')
      .eq('teacher_id', teacherId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) setSessionId(data.session_id);
      });
  }, [teacherId, paramSessionId]);

  const today = new Date();
  const todayStr = (() => {
    const d = today;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { records, loading, refreshing, error, refresh, markAttendance } =
    useTeacherAttendance(teacherId, sessionId, viewYear, viewMonth);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Build date → record lookup
  const recordsByDate = useMemo(() => {
    const map = {};
    for (const r of records) map[r.date] = r;
    return map;
  }, [records]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function handleDayPress(dateStr, record) {
    setSelectedDate(dateStr);
    setSelectedRecord(record || null);
    setModalVisible(true);
  }

  async function handleSave({ status, note }) {
    setSaving(true);
    try {
      await markAttendance({
        schoolId,
        branchId,
        date:   selectedDate,
        status,
        note,
      });
      setModalVisible(false);
    } catch (e) {
      // error surfaced by hook
    } finally {
      setSaving(false);
    }
  }

  // Legend
  const legendItems = STATUS_OPTIONS.map((s) => ({ key: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s], bg: STATUS_BG[s] }));

  const isAtCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hp(4) }}>

        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
            <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
          </TouchableOpacity>
          <View style={S.headerText}>
            <Text style={S.headerTitle} numberOfLines={1}>{teacherName || 'Teacher'}</Text>
            <Text style={S.headerSub}>Attendance History</Text>
          </View>
          {refreshing && <ActivityIndicator color={Colors.primary} />}
        </View>

        {/* Error */}
        {error ? (
          <View style={S.errorWrap}>
            <Text style={S.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={S.retryBtn}>
              <Text style={S.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: hp(6) }} />
        ) : (
          <>
            {/* Month Navigator */}
            <View style={S.monthNav}>
              <TouchableOpacity onPress={prevMonth} hitSlop={8} style={S.navBtn}>
                <Ionicons name="chevron-back" size={hp(2.4)} color={Colors.ink} />
              </TouchableOpacity>
              <Text style={S.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={8} style={S.navBtn} disabled={isAtCurrentMonth}>
                <Ionicons name="chevron-forward" size={hp(2.4)} color={isAtCurrentMonth ? Colors.muted : Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            <View style={S.calWrap}>
              <CalendarGrid
                year={viewYear}
                month={viewMonth}
                recordsByDate={recordsByDate}
                canEdit={canEdit}
                onDayPress={handleDayPress}
                todayStr={todayStr}
              />
            </View>

            {/* Legend */}
            <View style={S.legend}>
              <View style={[S.legendItem, { backgroundColor: Colors.canvas }]}>
                <Text style={[S.legendText, { color: Colors.muted }]}>— Not Marked</Text>
              </View>
              {legendItems.map((li) => (
                <View key={li.key} style={[S.legendItem, { backgroundColor: li.bg }]}>
                  <Text style={[S.legendText, { color: li.color }]}>{li.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Mark/Edit Modal (managers only) */}
      {canEdit && (
        <MarkModal
          visible={modalVisible}
          date={selectedDate}
          existingRecord={selectedRecord}
          onClose={() => setModalVisible(false)}
          onSave={handleSave}
          saving={saving}
        />
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

  errorWrap: { alignItems: 'center', marginTop: hp(6), gap: hp(1) },
  errorText: { fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.danger },
  retryBtn:  { paddingHorizontal: wp(5), paddingVertical: hp(1.2), backgroundColor: Colors.primaryLight, borderRadius: 10 },
  retryText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.primary },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), marginBottom: hp(1.5),
  },
  navBtn:     { padding: hp(0.6) },
  monthLabel: { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },

  calWrap: { paddingHorizontal: wp(4) },

  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: hp(0.8),
    paddingHorizontal: wp(4), marginTop: hp(2),
  },
  legendItem: { paddingHorizontal: wp(3), paddingVertical: hp(0.6), borderRadius: 20 },
  legendText: { fontSize: hp(1.3), fontFamily: Fonts.medium },
});

// Calendar cell styles
const cellSize = (wp(100) - wp(8)) / 7;
const C = StyleSheet.create({
  calGrid:   { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: {
    width: cellSize, textAlign: 'center',
    fontSize: hp(1.3), fontFamily: Fonts.medium, color: Colors.muted,
    paddingVertical: hp(0.8),
  },
  dayCell: {
    width: cellSize, height: cellSize,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, padding: 2,
  },
  dayNum:    { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.ink },
  dayStatus: { fontSize: hp(1.1),  fontFamily: Fonts.medium, marginTop: 1 },
});

// Modal styles
const M = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: wp(5), paddingBottom: hp(4), gap: hp(1.5),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:  { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink },
  dateLabel:   { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.soft },
  statusRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: hp(0.5) },
  statusPill: {
    paddingHorizontal: wp(4), paddingVertical: hp(1.1),
    borderRadius: 20,
  },
  statusPillText: { fontSize: hp(1.55), fontFamily: Fonts.semiBold },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: hp(1.8), alignItems: 'center', marginTop: hp(1),
  },
  saveBtnText: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: '#fff' },
});
