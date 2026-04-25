/**
 * useStudentOwnAttendance.js
 *
 * Fetches attendance records for the logged-in student for a given month.
 * Fetches only the displayed month; navigating months triggers a new fetch.
 *
 * Used by:
 *   - home.jsx (student today widget) — passes current year/month
 *   - studentSelfAttendance screen (calendar history)
 *
 * Cache key: `${studentId}|${sessionId}|${year}-${month}`  TTL: 60s
 *
 * Exports:
 *   invalidateStudentOwnAttendanceCache(studentId, sessionId, year, month)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const TTL = 60_000;
const cache = {};

function cacheKey(studentId, sessionId, year, month) {
  return `${studentId}|${sessionId}|${year}-${String(month + 1).padStart(2, '0')}`;
}

function isFresh(key) {
  return cache[key] && Date.now() - cache[key].ts < TTL;
}

export function invalidateStudentOwnAttendanceCache(studentId, sessionId, year, month) {
  const key = cacheKey(studentId, sessionId, year, month);
  delete cache[key];
}

/**
 * @param {string} studentId
 * @param {string} sessionId
 * @param {number} year      - full year e.g. 2026
 * @param {number} month     - 0-based month e.g. 3 = April
 */
export function useStudentOwnAttendance(studentId, sessionId, year, month) {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const isFetching = useRef(false);
  const hasMounted = useRef(false);
  const prevKey    = useRef(null);

  // ── today derived (local date, not UTC) ──────────────────────────────────────
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const todayRecord = records.find((r) => r.date === todayStr) || null;

  // ── fetch ─────────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async ({ mode = 'initial' } = {}) => {
    if (!studentId || !sessionId || year == null || month == null) return;
    if (isFetching.current) return;

    const key = cacheKey(studentId, sessionId, year, month);

    if (mode === 'initial' && isFresh(key)) {
      setRecords(cache[key].records);
      return;
    }

    // Month date range
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
        .eq('person_id', studentId)
        .eq('role', 'student')
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
  }, [studentId, sessionId, year, month]);

  // ── Re-fetch when month/sessionId changes ────────────────────────────────────
  useEffect(() => {
    if (!studentId || !sessionId || year == null || month == null) return;
    const key = cacheKey(studentId, sessionId, year, month);
    if (prevKey.current === key) return;
    prevKey.current = key;
    isFresh(key)
      ? setRecords(cache[key].records)
      : fetchRecords({ mode: 'initial' });
  }, [studentId, sessionId, year, month, fetchRecords]);

  // ── focus effect ──────────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!studentId || !sessionId || year == null || month == null) return;
    const key = cacheKey(studentId, sessionId, year, month);
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
  }, [fetchRecords, studentId, sessionId, year, month]));

  // ── refresh ───────────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    invalidateStudentOwnAttendanceCache(studentId, sessionId, year, month);
    fetchRecords({ mode: 'refresh' });
  }, [fetchRecords, studentId, sessionId, year, month]);

  return { records, loading, refreshing, error, todayRecord, refresh };
}
