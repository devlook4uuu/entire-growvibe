/**
 * studentSelfAttendance.jsx
 *
 * Calendar view for a student to see their own attendance history.
 * Read-only — students cannot edit any records.
 *
 * Route params:
 *   studentId   — uuid (required)
 *   sessionId   — uuid (required)
 *   studentName — display label (optional)
 */

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useStudentOwnAttendance } from '../../../hooks/useStudentOwnAttendance';

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
  return new Date(year, month, 1).getDay();
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function CalendarGrid({ year, month, recordsByDate, todayStr }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={C.calGrid}>
      {DAY_NAMES.map((d) => (
        <Text key={d} style={C.dayHeader}>{d}</Text>
      ))}
      {cells.map((day, idx) => {
        if (day === null) return <View key={`e-${idx}`} style={C.dayCell} />;
        const dateStr  = toDateStr(year, month, day);
        const record   = recordsByDate[dateStr];
        const isToday  = dateStr === todayStr;
        const isFuture = dateStr > todayStr;

        const bg = record
          ? STATUS_BG[record.status]
          : (isFuture ? 'transparent' : Colors.canvas);
        const color = record ? STATUS_COLOR[record.status] : Colors.muted;

        return (
          <View
            key={dateStr}
            style={[C.dayCell, {
              backgroundColor: bg,
              borderColor: isToday ? Colors.primary : 'transparent',
              borderWidth: isToday ? 2 : 0,
            }]}
          >
            <Text style={[C.dayNum, {
              color: isToday ? Colors.primary : Colors.ink,
              fontFamily: isToday ? Fonts.semiBold : Fonts.regular,
            }]}>
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
          </View>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StudentSelfAttendance() {
  const router = useRouter();
  const profile = useSelector((s) => s.auth.profile);

  const { studentId: paramStudentId, sessionId: paramSessionId, studentName } = useLocalSearchParams();
  const studentId = paramStudentId || profile?.id;
  const sessionId = paramSessionId;

  const today = new Date();
  const todayStr = (() => {
    const d = today;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { records, loading, refreshing, error, refresh } =
    useStudentOwnAttendance(studentId, sessionId, viewYear, viewMonth);

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

  const isAtCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // Count summary for this month
  const monthCounts = { present: 0, absent: 0, late: 0, leave: 0, notMarked: 0 };
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(viewYear, viewMonth, d);
    if (dateStr > todayStr) continue;
    const r = recordsByDate[dateStr];
    if (r) monthCounts[r.status] = (monthCounts[r.status] || 0) + 1;
    else   monthCounts.notMarked++;
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hp(4) }}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
            <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
          </TouchableOpacity>
          <View style={S.headerText}>
            <Text style={S.headerTitle} numberOfLines={1}>{studentName || profile?.name || 'My Attendance'}</Text>
            <Text style={S.headerSub}>Attendance History</Text>
          </View>
          {refreshing && <ActivityIndicator color={Colors.primary} />}
        </View>

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
            {/* Month navigator */}
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
                todayStr={todayStr}
              />
            </View>

            {/* Monthly summary */}
            <View style={S.summary}>
              {STATUS_OPTIONS.map((s) => {
                const count = monthCounts[s] || 0;
                if (count === 0) return null;
                return (
                  <View key={s} style={[S.summaryChip, { backgroundColor: STATUS_BG[s] }]}>
                    <Text style={[S.summaryText, { color: STATUS_COLOR[s] }]}>
                      {STATUS_LABEL[s]}: {count}
                    </Text>
                  </View>
                );
              })}
              {monthCounts.notMarked > 0 && (
                <View style={[S.summaryChip, { backgroundColor: Colors.canvas }]}>
                  <Text style={[S.summaryText, { color: Colors.muted }]}>
                    Not Marked: {monthCounts.notMarked}
                  </Text>
                </View>
              )}
            </View>

            {/* Legend */}
            <View style={S.legend}>
              {STATUS_OPTIONS.map((s) => (
                <View key={s} style={[S.legendItem, { backgroundColor: STATUS_BG[s] }]}>
                  <Text style={[S.legendText, { color: STATUS_COLOR[s] }]}>{STATUS_LABEL[s]}</Text>
                </View>
              ))}
              <View style={[S.legendItem, { backgroundColor: Colors.canvas }]}>
                <Text style={[S.legendText, { color: Colors.muted }]}>— Not Marked</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
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

  summary: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: wp(4), marginTop: hp(2),
  },
  summaryChip: { paddingHorizontal: wp(3.5), paddingVertical: hp(0.8), borderRadius: 20 },
  summaryText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold },

  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: hp(0.8),
    paddingHorizontal: wp(4), marginTop: hp(1.5),
  },
  legendItem: { paddingHorizontal: wp(3), paddingVertical: hp(0.6), borderRadius: 20 },
  legendText: { fontSize: hp(1.3), fontFamily: Fonts.medium },
});

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
