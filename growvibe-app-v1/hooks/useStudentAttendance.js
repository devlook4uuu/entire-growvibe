/**
 * useStudentAttendance.js
 *
 * Fetches attendance records for an entire class on a given date,
 * merged with the full student roster so "not marked" students appear.
 *
 * Used by:
 *   - markStudentAttendance screen (teacher marks today or manager views/edits any date)
 *   - studentAttendanceHistory screen (date picker → shows that day's records)
 *
 * Cache key: `${classId}|${date}`  TTL: 60s
 *
 * Exports:
 *   invalidateStudentAttendanceCache(classId, date)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { sendPush } from '../lib/notifications';

const TTL = 60_000;
const cache = {};

function cacheKey(classId, date) {
  return `${classId}|${date}`;
}

function isFresh(key) {
  return cache[key] && Date.now() - cache[key].ts < TTL;
}

export function invalidateStudentAttendanceCache(classId, date) {
  const key = cacheKey(classId, date);
  delete cache[key];
}

/**
 * @param {string} classId
 * @param {string} sessionId
 * @param {string} date        - YYYY-MM-DD
 * @param {boolean} canEdit    - true for managers; false for teachers (read-only for past)
 */
export function useStudentAttendance(classId, sessionId, date, canEdit = false) {
  // merged list: every student in the class, with their attendance record (or null)
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(null);

  const isFetching = useRef(false);
  const hasMounted = useRef(false);

  // ── merge helper ─────────────────────────────────────────────────────────────
  function mergeRoster(roster, records) {
    const byStudent = {};
    for (const r of records) byStudent[r.person_id] = r;
    return roster.map((s) => ({
      ...s,
      attendance: byStudent[s.id] || null,
    }));
  }

  // ── fetch ─────────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async ({ mode = 'initial' } = {}) => {
    if (!classId || !sessionId || !date) return;
    if (isFetching.current) return;

    const key = cacheKey(classId, date);

    if (mode === 'initial' && isFresh(key)) {
      setStudents(cache[key].students);
      return;
    }

    isFetching.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else                    setLoading(true);
    setError(null);

    try {
      // Fetch roster + attendance in parallel
      const [rosterRes, attendanceRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('class_id', classId)
          .eq('role', 'student')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('attendance')
          .select('*')
          .eq('role', 'student')
          .eq('class_id', classId)
          .eq('session_id', sessionId)
          .eq('date', date),
      ]);

      if (rosterRes.error) throw rosterRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const merged = mergeRoster(rosterRes.data || [], attendanceRes.data || []);
      cache[key] = { students: merged, ts: Date.now() };
      setStudents(merged);
    } catch (e) {
      setError(e.message || 'Failed to load attendance.');
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, sessionId, date]);

  // ── Re-fetch when date or sessionId changes (useFocusEffect only fires on focus) ──
  const prevKey = useRef(null);
  useEffect(() => {
    if (!classId || !sessionId || !date) return;
    const key = cacheKey(classId, date);
    if (prevKey.current === key) return; // same key, no re-fetch needed
    prevKey.current = key;
    isFresh(key)
      ? setStudents(cache[key].students)
      : fetchRecords({ mode: 'initial' });
  }, [classId, sessionId, date, fetchRecords]);

  // ── focus effect (handles app foreground / screen re-entry) ──────────────────
  useFocusEffect(useCallback(() => {
    if (!classId || !sessionId || !date) return;
    const key = cacheKey(classId, date);
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevKey.current = key;
      isFresh(key)
        ? setStudents(cache[key].students)
        : fetchRecords({ mode: 'initial' });
    } else {
      isFresh(key)
        ? setStudents(cache[key].students)
        : fetchRecords({ mode: 'refresh' });
    }
  }, [fetchRecords, classId, sessionId, date]));

  // ── refresh ───────────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    invalidateStudentAttendanceCache(classId, date);
    fetchRecords({ mode: 'refresh' });
  }, [fetchRecords, classId, date]);

  // ── submitAttendance — bulk upsert for the entire class ───────────────────────
  // records: [{ studentId, status, note? }]
  const submitAttendance = useCallback(async ({ schoolId, branchId, records }) => {
    setSubmitting(true);
    try {
      const { error: err } = await supabase.rpc('upsert_class_attendance', {
        p_school_id:  schoolId,
        p_branch_id:  branchId,
        p_session_id: sessionId,
        p_class_id:   classId,
        p_date:       date,
        p_records:    records.map((r) => ({
          student_id: r.studentId,
          status:     r.status,
          note:       r.note || null,
        })),
      });
      if (err) throw err;

      // Notify absent/late students (fire-and-forget)
      const absentIds = records.filter((r) => r.status === 'absent').map((r) => r.studentId);
      const lateIds   = records.filter((r) => r.status === 'late').map((r) => r.studentId);
      if (absentIds.length > 0) sendPush(absentIds, 'Attendance', 'Your attendance has been marked: Absent').catch(() => {});
      if (lateIds.length > 0)   sendPush(lateIds,   'Attendance', 'Your attendance has been marked: Late').catch(() => {});

      // Invalidate and refetch
      invalidateStudentAttendanceCache(classId, date);
      await fetchRecords({ mode: 'refresh' });
    } finally {
      setSubmitting(false);
    }
  }, [classId, sessionId, date, fetchRecords]);

  return { students, loading, refreshing, submitting, error, canEdit, refresh, submitAttendance };
}
