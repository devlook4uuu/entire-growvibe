/**
 * useTeacherAttendance.js
 *
 * Fetches attendance records for a given teacher + session for a given month.
 * Fetches only the displayed month; navigating months triggers a new fetch.
 *
 * Used by:
 *   - Teacher dashboard (today widget) — passes current year/month
 *   - teacherAttendanceHistory screen (calendar view)
 *   - Manager views (owner/principal/coordinator viewing a teacher's history)
 *
 * Cache key: `${teacherId}|${sessionId}|${year}-${month}`  TTL: 60s
 *
 * Exports:
 *   invalidateTeacherAttendanceCache(teacherId, sessionId, year, month)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const TTL = 60_000;
const cache = {};

function cacheKey(teacherId, sessionId, year, month) {
  return `${teacherId}|${sessionId}|${year}-${String(month + 1).padStart(2, '0')}`;
}

function isFresh(key) {
  return cache[key] && Date.now() - cache[key].ts < TTL;
}

export function invalidateTeacherAttendanceCache(teacherId, sessionId, year, month) {
  const key = cacheKey(teacherId, sessionId, year, month);
  delete cache[key];
}

/**
 * @param {string}  teacherId
 * @param {string}  sessionId
 * @param {number}  year      - full year e.g. 2026
 * @param {number}  month     - 0-based month e.g. 3 = April
 */
export function useTeacherAttendance(teacherId, sessionId, year, month) {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const isFetching = useRef(false);
  const hasMounted = useRef(false);
  const prevKey    = useRef(null);

  // ── today's date string (local time) ─────────────────────────────────────────
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const todayRecord = records.find((r) => r.date === todayStr) || null;

  // ── fetch ─────────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async ({ mode = 'initial' } = {}) => {
    if (!teacherId || !sessionId || year == null || month == null) return;
    if (isFetching.current) return;

    const key = cacheKey(teacherId, sessionId, year, month);

    if (mode === 'initial' && isFresh(key)) {
      setRecords(cache[key].records);
      return;
    }

    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay    = new Date(year, month + 1, 0).getDate();
    const monthEnd   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    isFetching.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else                    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('attendance')
        .select('*')
        .eq('person_id', teacherId)
        .eq('role', 'teacher')
        .eq('session_id', sessionId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });

      if (err) throw err;

      const list = data || [];
      cache[key] = { records: list, ts: Date.now() };
      setRecords(list);
    } catch (e) {
      setError(e.message || 'Failed to load attendance.');
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacherId, sessionId, year, month]);

  // ── Re-fetch when month/sessionId changes ────────────────────────────────────
  useEffect(() => {
    if (!teacherId || !sessionId || year == null || month == null) return;
    const key = cacheKey(teacherId, sessionId, year, month);
    if (prevKey.current === key) return;
    prevKey.current = key;
    isFresh(key)
      ? setRecords(cache[key].records)
      : fetchRecords({ mode: 'initial' });
  }, [teacherId, sessionId, year, month, fetchRecords]);

  // ── focus effect (handles app foreground/re-focus) ────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!teacherId || !sessionId || year == null || month == null) return;
    const key = cacheKey(teacherId, sessionId, year, month);
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevKey.current = key;
      isFresh(key)
        ? setRecords(cache[key].records)
        : fetchRecords({ mode: 'initial' });
    } else {
      isFresh(key)
        ? setRecords(cache[key].records)
        : fetchRecords({ mode: 'refresh' });
    }
  }, [fetchRecords, teacherId, sessionId, year, month]));

  // ── refresh (pull-to-refresh) ─────────────────────────────────────────────────
  const refresh = useCallback(() => {
    invalidateTeacherAttendanceCache(teacherId, sessionId, year, month);
    fetchRecords({ mode: 'refresh' });
  }, [fetchRecords, teacherId, sessionId, year, month]);

  // ── markAttendance — teacher self-mark or manager override ────────────────────
  const markAttendance = useCallback(async ({ schoolId, branchId, date, status, note }) => {
    const { data, error: err } = await supabase.rpc('upsert_teacher_attendance', {
      p_school_id:  schoolId,
      p_branch_id:  branchId,
      p_session_id: sessionId,
      p_teacher_id: teacherId,
      p_date:       date,
      p_status:     status,
      p_note:       note || null,
    });
    if (err) throw err;

    invalidateTeacherAttendanceCache(teacherId, sessionId, year, month);
    setRecords((prev) => {
      const filtered = prev.filter((r) => r.date !== date);
      return [data, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
    });
    return data;
  }, [teacherId, sessionId, year, month]);

  return { records, loading, refreshing, error, todayRecord, refresh, markAttendance };
}
