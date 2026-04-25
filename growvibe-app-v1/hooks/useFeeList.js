/**
 * useFeeList(studentId, sessionId)
 *
 * Loads all fee records for one student within a session.
 * Sorted by month descending.
 * Cache key: `${studentId}|${sessionId}`
 */

import { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const CACHE_TTL = 30_000;
const cache = {};

function cacheKey(studentId, sessionId) { return `${studentId}|${sessionId}`; }
function isFresh(k) { const e = cache[k]; return !!(e && Date.now() - e.ts < CACHE_TTL); }

export function invalidateFeeCache(studentId, sessionId) {
  const k = cacheKey(studentId, sessionId);
  delete cache[k];
}

export function useFeeList(studentId, sessionId) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const isFetching = useRef(false);
  const fetchId    = useRef(0);
  const hasMounted = useRef(false);

  const fetch = useCallback(async ({ mode } = {}) => {
    if (!studentId || !sessionId) return;
    if (isFetching.current) return;

    const k = cacheKey(studentId, sessionId);

    if (mode !== 'refresh' && isFresh(k)) {
      setItems(cache[k].items);
      setError(null);
      hasMounted.current = true;
      return;
    }

    isFetching.current = true;
    const myId = ++fetchId.current;

    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error: err } = await supabase
        .from('student_fee_records')
        .select('*')
        .eq('student_id', studentId)
        .eq('session_id', sessionId)
        .order('month', { ascending: false });

      if (myId !== fetchId.current) return;
      if (err) { setError(err.message); return; }

      const rows = data ?? [];
      cache[k] = { items: rows, ts: Date.now() };
      setItems(rows);
      setError(null);
      hasMounted.current = true;
    } catch {
      if (myId === fetchId.current) setError('Connection error. Please try again.');
    } finally {
      if (myId === fetchId.current) {
        isFetching.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [studentId, sessionId]);

  useFocusEffect(useCallback(() => {
    if (!hasMounted.current) {
      fetch({ mode: 'initial' });
    } else {
      const k = cacheKey(studentId, sessionId);
      if (!isFresh(k)) fetch({ mode: 'refresh' });
      else {
        if (cache[k]) setItems(cache[k].items);
      }
    }
  }, [fetch, studentId, sessionId]));

  const refresh = useCallback(() => {
    const k = cacheKey(studentId, sessionId);
    delete cache[k];
    fetch({ mode: 'refresh' });
  }, [fetch, studentId, sessionId]);

  const updateItem = useCallback((id, updates) => {
    setItems((prev) => {
      const next = prev.map((item) => item.id === id ? { ...item, ...updates } : item);
      const k = cacheKey(studentId, sessionId);
      if (cache[k]) cache[k] = { ...cache[k], items: next };
      return next;
    });
  }, [studentId, sessionId]);

  const addItem = useCallback((record) => {
    setItems((prev) => {
      const next = [record, ...prev.filter((r) => r.id !== record.id)];
      // Sort by month descending
      next.sort((a, b) => b.month.localeCompare(a.month));
      const k = cacheKey(studentId, sessionId);
      if (cache[k]) cache[k] = { ...cache[k], items: next };
      return next;
    });
  }, [studentId, sessionId]);

  return { items, loading, refreshing, error, refresh, updateItem, addItem };
}
