import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { supabase } from '../lib/supabase';
import { setSelectedBranch, setSelectedSession } from '../store/appSlice';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';

// ─── Module-level session cache (keyed by branchId, 30s TTL) ─────────────────
const SESSION_TTL = 30_000;
const sessionCache = {};

function isCacheFresh(branchId) {
  const e = sessionCache[branchId];
  return !!(e && Date.now() - e.ts < SESSION_TTL);
}

function readCache(branchId) {
  return sessionCache[branchId]?.data ?? null;
}

function writeCache(branchId, data) {
  sessionCache[branchId] = { data, ts: Date.now() };
}

export function invalidateSelectorSessionCache(branchId) {
  if (branchId) delete sessionCache[branchId];
  else Object.keys(sessionCache).forEach((k) => delete sessionCache[k]);
}

// ─── BranchSessionSelector ────────────────────────────────────────────────────
export default function BranchSessionSelector() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const profile  = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);

  const schoolId = profile?.school_id;

  const [branches,       setBranches]       = useState([]);
  const [sessions,       setSessions]       = useState([]);
  const [branchLoading,  setBranchLoading]  = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [branchError,    setBranchError]    = useState(null);

  const activeBranchRef = useRef(null);

  // ── Fetch sessions for a branch (with cache) ───────────────────────────────
  const fetchSessions = useCallback(async (branchId) => {
    if (!branchId) return;

    // Cache hit — apply instantly, no network call
    if (isCacheFresh(branchId)) {
      const cached = readCache(branchId);
      setSessions(cached);
      const active = cached.find((s) => s.is_active) ?? cached[0] ?? null;
      dispatch(setSelectedSession(active?.id ?? null));
      return;
    }

    setSessionLoading(true);

    const { data, error } = await supabase
      .from('sessions')
      .select('id, session_name, session_start, session_end, is_active')
      .eq('branch_id', branchId)
      .eq('school_id', schoolId)
      .order('session_start', { ascending: false });

    setSessionLoading(false);
    if (error || !data) return;

    writeCache(branchId, data);
    setSessions(data);

    const active = data.find((s) => s.is_active) ?? data[0] ?? null;
    dispatch(setSelectedSession(active?.id ?? null));
  }, [dispatch, schoolId]);

  // ── Fetch branches once on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    (async () => {
      setBranchLoading(true);
      setBranchError(null);

      const { data, error } = await supabase
        .from('branches')
        .select('id, name, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        setBranchError('Could not load branches.');
        setBranchLoading(false);
        return;
      }

      setBranches(data || []);
      setBranchLoading(false);

      // Auto-select first branch if none selected yet
      const first = data?.[0];
      if (first && !selectedBranchId) {
        dispatch(setSelectedBranch(first.id));
        activeBranchRef.current = first.id;
        fetchSessions(first.id);
      } else if (selectedBranchId) {
        activeBranchRef.current = selectedBranchId;
        fetchSessions(selectedBranchId);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // ── Re-fetch sessions on focus (e.g. returning from session creation) ────────
  useFocusEffect(useCallback(() => {
    const branchId = activeBranchRef.current;
    if (!branchId) return;
    // If cache was invalidated (e.g. by sessionForm after save), re-fetch
    if (!isCacheFresh(branchId)) {
      fetchSessions(branchId);
    }
  }, [fetchSessions]));

  // ── Branch pill tap ────────────────────────────────────────────────────────
  function handleBranchSelect(branch) {
    if (branch.id === selectedBranchId) return;
    dispatch(setSelectedBranch(branch.id));
    activeBranchRef.current = branch.id;
    fetchSessions(branch.id);
  }

  // ── Session pill tap ───────────────────────────────────────────────────────
  function handleSessionSelect(session) {
    dispatch(setSelectedSession(session.id));
  }

  // ── Create session CTA (only shown when branch has no sessions) ────────────
  function handleCreateSession() {
    const branch = branches.find((b) => b.id === selectedBranchId);
    router.push({
      pathname: '/screens/session/sessionForm',
      params: { branchId: selectedBranchId, schoolId, branchName: branch?.name ?? '' },
    });
  }

  // ── Loading / error / empty guards ─────────────────────────────────────────
  if (branchLoading) {
    return (
      <View style={S.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>
    );
  }

  if (branchError) {
    return (
      <View style={S.errorWrap}>
        <Ionicons name="alert-circle-outline" size={hp(1.8)} color={Colors.danger} />
        <Text style={S.errorText}>{branchError}</Text>
      </View>
    );
  }

  if (branches.length === 0) {
    return (
      <View style={S.emptyWrap}>
        <Ionicons name="git-branch-outline" size={hp(2)} color={Colors.muted} />
        <Text style={S.emptyText}>No active branches. Add a branch first.</Text>
      </View>
    );
  }

  return (
    <View style={S.root}>
      {/* ── Branch pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.pillRow}
      >
        {branches.map((branch) => {
          const active = branch.id === selectedBranchId;
          return (
            <TouchableOpacity
              key={branch.id}
              style={[S.pill, active && S.pillActive]}
              onPress={() => handleBranchSelect(branch)}
              activeOpacity={0.75}
            >
              <Ionicons
                name="git-branch-outline"
                size={hp(1.6)}
                color={active ? Colors.primary : Colors.muted}
                style={{ marginRight: 4 }}
              />
              <Text style={[S.pillText, active && S.pillTextActive]} numberOfLines={1}>
                {branch.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Session pills ── */}
      {sessionLoading ? (
        <View style={S.sessionLoadingWrap}>
          <ActivityIndicator color={Colors.primary} size="small" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={S.noSessionWrap}>
          <Ionicons name="calendar-outline" size={hp(1.8)} color={Colors.muted} />
          <Text style={S.noSessionText}>No session for this branch</Text>
          <TouchableOpacity style={S.createSessionBtn} onPress={handleCreateSession} activeOpacity={0.8}>
            <Ionicons name="add" size={hp(1.8)} color={Colors.white} />
            <Text style={S.createSessionBtnText}>Create Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.pillRow}
        >
          {sessions.map((session) => {
            const active = session.id === selectedSessionId;
            return (
              <TouchableOpacity
                key={session.id}
                style={[S.pill, S.sessionPill, active && S.sessionPillActive]}
                onPress={() => handleSessionSelect(session)}
                activeOpacity={0.75}
              >
                {session.is_active && <View style={S.activeDot} />}
                <Text style={[S.pillText, active && S.sessionPillTextActive]} numberOfLines={1}>
                  {session.session_name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: {
    backgroundColor: Colors.white,
    paddingTop: hp(1.2),
    paddingBottom: hp(1.4),
    gap: hp(1),
  },

  pillRow: {
    paddingHorizontal: wp(4),
    gap: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.65),
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  pillText: {
    fontSize: hp(1.45),
    fontFamily: Fonts.medium,
    color: Colors.muted,
  },
  pillTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.semiBold,
  },

  sessionPill: {
    gap: 5,
  },
  sessionPillActive: {
    borderColor: Colors.purple,
    backgroundColor: Colors.purpleLight,
  },
  sessionPillTextActive: {
    color: Colors.purple,
    fontFamily: Fonts.semiBold,
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },

  // No session row
  noSessionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingHorizontal: wp(4),
  },
  noSessionText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    flex: 1,
  },
  createSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.7),
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  createSessionBtnText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },

  // States
  loadingWrap: {
    paddingVertical: hp(2),
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  sessionLoadingWrap: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.5),
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  errorText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.danger,
  },
  emptyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
  },
  emptyText: {
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },
});
