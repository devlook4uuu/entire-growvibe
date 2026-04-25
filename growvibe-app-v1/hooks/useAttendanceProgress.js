/**
 * useAttendanceProgress.js
 *
 * Fetches attendance records for the current student from the start of the
 * current month through today. Derives weekly and monthly summaries.
 *
 * markedDays  = records that exist (teacher marked something)
 * presentDays = present + late records
 * pct         = presentDays / markedDays
 *
 * Cache key: `progress|${studentId}|${sessionId}|${todayStr}`  TTL: 60s
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const TTL = 60_000;
const cache = {};

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mondayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function summarise(records, from) {
  const today = todayLocal();
  const filtered    = records.filter((r) => r.date >= from && r.date <= today);
  const markedDays  = filtered.length;
  const presentDays = filtered.filter((r) => r.status === 'present' || r.status === 'late').length;
  const pct         = markedDays > 0 ? presentDays / markedDays : 0;
  return { markedDays, presentDays, pct };
}

function cacheKey(studentId, sessionId) {
  return `progress|${studentId}|${sessionId}|${todayLocal()}`;
}

function isFresh(key) {
  return cache[key] && Date.now() - cache[key].ts < TTL;
}

export function useAttendanceProgress(studentId, sessionId) {
  const [weekly,  setWeekly]  = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const isFetching = useRef(false);
  const hasMounted = useRef(false);
  const prevKey    = useRef(null);

  const fetchProgress = useCallback(async ({ mode = 'initial' } = {}) => {
    if (!studentId || !sessionId) return;
    if (isFetching.current) return;

    const key = cacheKey(studentId, sessionId);
    if (mode === 'initial' && isFresh(key)) {
      const c = cache[key];
      setWeekly(c.weekly); setMonthly(c.monthly);
      return;
    }

    isFetching.current = true;
    if (mode !== 'refresh') setLoading(true);
    setError(null);

    const from  = firstOfMonth();
    const today = todayLocal();

    try {
      const { data, error: err } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('person_id', studentId)
        .eq('role', 'student')
        .eq('session_id', sessionId)
        .gte('date', from)
        .lte('date', today);

      if (err) throw err;

      const records = data || [];
      const weekly  = summarise(records, mondayOfWeek());
      const monthly = summarise(records, from);

      cache[key] = { weekly, monthly, ts: Date.now() };
      setWeekly(weekly);
      setMonthly(monthly);
    } catch (e) {
      setError(e.message || 'Failed to load.');
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [studentId, sessionId]);

  useEffect(() => {
    if (!studentId || !sessionId) return;
    const key = cacheKey(studentId, sessionId);
    if (prevKey.current === key) return;
    prevKey.current = key;
    isFresh(key)
      ? (() => { const c = cache[key]; setWeekly(c.weekly); setMonthly(c.monthly); })()
      : fetchProgress({ mode: 'initial' });
  }, [studentId, sessionId, fetchProgress]);

  useFocusEffect(useCallback(() => {
    if (!studentId || !sessionId) return;
    const key = cacheKey(studentId, sessionId);
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevKey.current = key;
      isFresh(key)
        ? (() => { const c = cache[key]; setWeekly(c.weekly); setMonthly(c.monthly); })()
        : fetchProgress({ mode: 'initial' });
    } else {
      isFresh(key)
        ? (() => { const c = cache[key]; setWeekly(c.weekly); setMonthly(c.monthly); })()
        : fetchProgress({ mode: 'refresh' });
    }
  }, [fetchProgress, studentId, sessionId]));

  const refresh = useCallback(() => {
    delete cache[cacheKey(studentId, sessionId)];
    fetchProgress({ mode: 'refresh' });
  }, [fetchProgress, studentId, sessionId]);

  return { weekly, monthly, loading, error, refresh };
}
