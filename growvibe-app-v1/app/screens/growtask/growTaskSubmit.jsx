/**
 * growTaskSubmit.jsx
 *
 * Incharge teacher screen to award GrowCoins for:
 *   - Discipline Improved   (30 coins, weekly)
 *   - Cleanliness Improved  (30 coins, weekly)
 *   - Study Improved        (30 coins, weekly)
 *
 * Each panel shows all students in the teacher's class with checkboxes.
 * Max 5 students per panel. Already-submitted panels show a locked badge.
 *
 * Route params: none (profile.class_id used directly)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';
import { sendPush } from '../../../lib/notifications';

const MAX_SELECT = 5;

// ISO week label: '2026-W16'
function currentCycleLabel() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weekNum = Math.round((monday - startOfWeek1) / (7 * 86400000)) + 1;
  const year = monday.getFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// 'Week of Apr 14–20'
function weekRangeLabel() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0=Mon
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${fmt(mon)}–${fmt(sun)}`;
}

const PANELS = [
  { key: 'discipline',  label: 'Discipline',  icon: 'shield-checkmark-outline', color: Colors.purple },
  { key: 'cleanliness', label: 'Cleanliness', icon: 'sparkles-outline',          color: Colors.success },
  { key: 'study',       label: 'Study',        icon: 'book-outline',              color: Colors.primary },
];

export default function GrowTaskSubmit() {
  const profile    = useSelector((s) => s.auth.profile);
  const router     = useRouter();
  const cycleLabel = currentCycleLabel();
  const weekLabel  = weekRangeLabel();

  const [loading,   setLoading]   = useState(true);
  const [students,  setStudents]  = useState([]);   // { id, name }[]
  const [tasks,     setTasks]     = useState({});   // category → { id, coins_reward }
  // Default all panels locked; unlocked after fetch confirms they haven't been submitted
  const [submitted, setSubmitted] = useState({
    discipline: true, cleanliness: true, study: true,
  });
  const [selected,  setSelected]  = useState({      // category → Set<id>
    discipline: new Set(), cleanliness: new Set(), study: new Set(),
  });
  const [saving,    setSaving]    = useState({});   // category → bool
  const [error,     setError]     = useState({});   // category → string

  const load = useCallback(async () => {
    if (!profile?.class_id) return;
    setLoading(true);
    try {
      const [studRes, taskRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name')
          .eq('class_id', profile.class_id)
          .eq('role', 'student')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('grow_tasks')
          .select('id, category, coins_reward')
          .in('category', ['discipline', 'cleanliness', 'study'])
          .eq('is_active', true),
      ]);

      const studs = studRes.data || [];
      const taskMap = {};
      for (const t of (taskRes.data || [])) taskMap[t.category] = t;

      setStudents(studs);
      setTasks(taskMap);

      // Check which panels this teacher already submitted this cycle —
      // scoped by awarded_by = teacher's own id
      const taskIds = Object.values(taskMap).map((t) => t.id);
      if (taskIds.length > 0) {
        const { data: subs } = await supabase
          .from('grow_task_submissions')
          .select('grow_task_id')
          .in('grow_task_id', taskIds)
          .eq('cycle_label', cycleLabel)
          .eq('awarded_by', profile.id);

        const doneTaskIds = new Set((subs || []).map((s) => s.grow_task_id));
        const submittedMap = {};
        for (const [cat, task] of Object.entries(taskMap)) {
          submittedMap[cat] = doneTaskIds.has(task.id);
        }
        setSubmitted(submittedMap);
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.class_id, cycleLabel]);

  useEffect(() => { load(); }, [load]);

  function toggleStudent(category, studentId) {
    setSelected((prev) => {
      const next = new Set(prev[category]);
      if (next.has(studentId)) next.delete(studentId);
      else if (next.size < MAX_SELECT) next.add(studentId);
      return { ...prev, [category]: next };
    });
  }

  async function handleSubmit(category) {
    const task = tasks[category];
    if (!task) return;
    const ids = [...selected[category]];
    if (ids.length === 0) {
      setError((e) => ({ ...e, [category]: 'Select at least 1 student.' }));
      return;
    }
    setSaving((s) => ({ ...s, [category]: true }));
    setError((e) => ({ ...e, [category]: '' }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-growtask`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            grow_task_id: task.id,
            student_ids:  ids,
            cycle_label:  cycleLabel,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      // Mark panel as submitted
      setSubmitted((s) => ({ ...s, [category]: true }));
      setSelected((s) => ({ ...s, [category]: new Set() }));
      // Notify awarded students (fire-and-forget)
      const panelLabel = PANELS.find((p) => p.key === category)?.label ?? category;
      sendPush(
        ids,
        'GrowCoins',
        `You received ${task.coins_reward} GrowCoins for ${panelLabel} Improved. Keep it up!`,
        { type: 'grow_coins', category },
      );
    } catch (e) {
      setError((ev) => ({ ...ev, [category]: e.message }));
    } finally {
      setSaving((s) => ({ ...s, [category]: false }));
    }
  }

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={S.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (!profile?.class_id) {
    return (
      <ScreenWrapper>
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={hp(5)} color={Colors.muted} />
          <Text style={S.emptyText}>You are not assigned to any class.</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Top nav header */}
      <View style={S.navHeader}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={S.navText}>
          <Text style={S.navTitle}>GrowTask Awards</Text>
          <Text style={S.navSub}>{weekLabel}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hp(4), paddingTop: hp(1) }}
      >
        {PANELS.map((panel) => {
          const task       = tasks[panel.key];
          const isLocked   = submitted[panel.key] === true;
          const isSaving   = saving[panel.key] === true;
          const panelSel   = selected[panel.key] || new Set();
          const panelError = error[panel.key] || '';

          return (
            <View key={panel.key} style={S.panel}>
              {/* Panel header */}
              <View style={S.panelHeader}>
                <View style={[S.panelIcon, { backgroundColor: panel.color + '20' }]}>
                  <Ionicons name={panel.icon} size={hp(2.4)} color={panel.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.panelTitle}>{panel.label} Improved</Text>
                  <Text style={S.panelCoins}>
                    {task ? `${task.coins_reward} coins each` : '—'}
                  </Text>
                </View>
                {isLocked && (
                  <View style={S.lockedBadge}>
                    <Ionicons name="checkmark-circle" size={hp(1.8)} color={Colors.success} />
                    <Text style={S.lockedText}>Submitted</Text>
                  </View>
                )}
              </View>

              {isLocked ? (
                <View style={S.lockedBox}>
                  <Ionicons name="lock-closed-outline" size={hp(2.2)} color={Colors.muted} />
                  <Text style={S.lockedBoxText}>Already submitted for {weekLabel}</Text>
                </View>
              ) : (
                <>
                  {/* Selection count */}
                  <Text style={S.selectionHint}>
                    {panelSel.size} / {MAX_SELECT} selected
                  </Text>

                  {/* Student list */}
                  {students.length === 0 ? (
                    <Text style={S.noStudents}>No students in your class.</Text>
                  ) : (
                    students.map((student) => {
                      const isChecked  = panelSel.has(student.id);
                      const isDisabled = !isChecked && panelSel.size >= MAX_SELECT;
                      return (
                        <TouchableOpacity
                          key={student.id}
                          style={[S.studentRow, isDisabled && S.studentRowDisabled]}
                          onPress={() => !isDisabled && toggleStudent(panel.key, student.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            S.checkbox,
                            isChecked  && { backgroundColor: panel.color, borderColor: panel.color },
                            isDisabled && { borderColor: Colors.borderLight },
                          ]}>
                            {isChecked && (
                              <Ionicons name="checkmark" size={hp(1.6)} color={Colors.white} />
                            )}
                          </View>
                          <Text style={[S.studentName, isDisabled && { color: Colors.muted }]}>
                            {student.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  {/* Error */}
                  {!!panelError && (
                    <Text style={S.errorText}>{panelError}</Text>
                  )}

                  {/* Submit button */}
                  <TouchableOpacity
                    style={[S.submitBtn, { backgroundColor: panel.color }, isSaving && S.submitBtnDisabled]}
                    onPress={() => !isSaving && handleSubmit(panel.key)}
                    activeOpacity={0.8}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color={Colors.white} size="small" />
                      : <Text style={S.submitBtnText}>Submit {panel.label}</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ScreenWrapper>
  );
}

const S = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.5),
  },
  emptyText: {
    fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center',
  },

  navHeader: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(1.5),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: 4,
  },
  navText: {
    flex: 1,
  },
  navTitle: {
    fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3,
  },
  navSub: {
    fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2,
  },

  panel: {
    marginHorizontal: wp(4), marginBottom: hp(2),
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: wp(4),
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    marginBottom: hp(1.6),
  },
  panelIcon: {
    width: hp(5), height: hp(5), borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  panelTitle: {
    fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink,
  },
  panelCoins: {
    fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2,
  },

  lockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, borderRadius: 20,
    paddingHorizontal: wp(2.5), paddingVertical: hp(0.5),
  },
  lockedText: {
    fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.success,
  },
  lockedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.canvas, borderRadius: 10,
    paddingHorizontal: wp(3), paddingVertical: hp(1.4),
  },
  lockedBoxText: {
    fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted,
  },

  selectionHint: {
    fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted,
    marginBottom: hp(1),
  },
  noStudents: {
    fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted,
    paddingVertical: hp(1),
  },

  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingVertical: hp(1.1),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  studentRowDisabled: { opacity: 0.45 },
  checkbox: {
    width: hp(2.8), height: hp(2.8), borderRadius: 7,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  studentName: {
    fontSize: hp(1.65), fontFamily: Fonts.medium, color: Colors.ink, flex: 1,
  },

  errorText: {
    fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.danger,
    marginTop: hp(0.8),
  },

  submitBtn: {
    marginTop: hp(1.6), borderRadius: 12,
    paddingVertical: hp(1.5), alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.white,
  },
});
