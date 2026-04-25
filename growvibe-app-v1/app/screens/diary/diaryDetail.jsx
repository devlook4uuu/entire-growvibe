/**
 * diaryDetail.jsx — Full diary entry detail view
 *
 * Route params: diaryId (uuid)
 *
 * Shows title, description, all subject+todo entries, created date, expire date.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function fmtExpire(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ─── Subject item ─────────────────────────────────────────────────────────────
function SubjectItem({ subject, index }) {
  return (
    <View style={S.subjectCard}>
      <View style={S.subjectHeader}>
        <View style={S.subjectNum}>
          <Text style={S.subjectNumText}>{index + 1}</Text>
        </View>
        <Text style={S.subjectName}>{subject.subject_name || '—'}</Text>
      </View>
      {subject.todo ? (
        <Text style={S.subjectTodo}>{subject.todo}</Text>
      ) : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiaryDetail() {
  const router  = useRouter();
  const { diaryId } = useLocalSearchParams();

  const [entry,   setEntry]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!diaryId) { setLoading(false); setError('Invalid diary entry.'); return; }
    supabase
      .from('class_diary')
      .select('*, creator:created_by(id, name)')
      .eq('id', diaryId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err) { setError(err.message); return; }
        if (!data) { setError('Diary entry not found.'); return; }
        setEntry(data);
      });
  }, [diaryId]);

  const expired  = entry ? isExpired(entry.expire_date) : false;
  const subjects = entry?.subjects || [];

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={S.headerTitle} numberOfLines={1}>Diary Entry</Text>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={hp(5)} color={Colors.danger} />
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.retryBtn}>
            <Text style={S.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scroll}
        >
          {/* Title card */}
          <View style={S.titleCard}>
            <View style={S.titleIconWrap}>
              <Ionicons name="book-outline" size={hp(2.8)} color={Colors.purple} />
            </View>
            <Text style={S.title}>{entry.title}</Text>
            {entry.description ? (
              <Text style={S.description}>{entry.description}</Text>
            ) : null}

            {/* Meta row */}
            <View style={S.metaRow}>
              <View style={S.metaItem}>
                <Ionicons name="calendar-outline" size={hp(1.7)} color={Colors.muted} />
                <Text style={S.metaText}>Posted {fmtDate(entry.created_at)}</Text>
              </View>
              <View style={[S.expireBadge, expired && S.expireBadgeRed]}>
                <Ionicons
                  name={expired ? 'close-circle-outline' : 'time-outline'}
                  size={hp(1.6)}
                  color={expired ? Colors.danger : Colors.success}
                />
                <Text style={[S.expireText, expired && { color: Colors.danger }]}>
                  {expired ? `Expired ${fmtExpire(entry.expire_date)}` : `Expires ${fmtExpire(entry.expire_date)}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Subjects section */}
          {subjects.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Ionicons name="list-outline" size={hp(2)} color={Colors.ink} />
                <Text style={S.sectionTitle}>Subjects & Tasks</Text>
                <View style={S.countChip}>
                  <Text style={S.countChipText}>{subjects.length}</Text>
                </View>
              </View>
              <View style={S.subjectList}>
                {subjects.map((s, i) => (
                  <SubjectItem key={i} subject={s} index={i} />
                ))}
              </View>
            </View>
          )}

          {/* Creator */}
          {entry.creator?.name && (
            <View style={S.creatorRow}>
              <Ionicons name="person-outline" size={hp(1.7)} color={Colors.muted} />
              <Text style={S.creatorText}>Posted by {entry.creator.name}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingVertical: hp(1.6),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: hp(2.2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.5), paddingHorizontal: wp(8) },
  errorText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.danger, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: wp(6), paddingVertical: hp(1.2),
    borderRadius: 12, backgroundColor: Colors.primaryLight,
  },
  retryText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.primary },

  scroll: { padding: wp(4), paddingBottom: hp(6), gap: hp(2) },

  titleCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: wp(4), gap: hp(1.2),
    alignItems: 'flex-start',
  },
  titleIconWrap: {
    width: hp(5.2), height: hp(5.2), borderRadius: 14,
    backgroundColor: Colors.purpleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: hp(2.2), fontFamily: Fonts.bold,
    color: Colors.ink, letterSpacing: -0.4,
  },
  description: {
    fontSize: hp(1.65), fontFamily: Fonts.regular,
    color: Colors.soft, lineHeight: hp(2.4),
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: wp(3), marginTop: hp(0.4) },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted },

  expireBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(2.5), paddingVertical: hp(0.5),
    borderRadius: 20, backgroundColor: Colors.successLight,
  },
  expireBadgeRed: { backgroundColor: Colors.dangerLight },
  expireText: {
    fontSize: hp(1.35), fontFamily: Fonts.medium, color: Colors.success,
  },

  section: { gap: hp(1.2) },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  sectionTitle: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink, flex: 1 },
  countChip: {
    paddingHorizontal: wp(2), paddingVertical: hp(0.3),
    borderRadius: 20, backgroundColor: Colors.purpleLight,
  },
  countChipText: { fontSize: hp(1.3), fontFamily: Fonts.bold, color: Colors.purple },

  subjectList: { gap: hp(1) },
  subjectCard: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    borderLeftWidth: 3, borderLeftColor: Colors.purple,
    padding: wp(3.5), gap: hp(0.6),
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: wp(2.5) },
  subjectNum: {
    width: hp(2.6), height: hp(2.6), borderRadius: hp(1.3),
    backgroundColor: Colors.purpleLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  subjectNumText: { fontSize: hp(1.3), fontFamily: Fonts.bold, color: Colors.purple },
  subjectName: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink, flex: 1 },
  subjectTodo: {
    fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.soft,
    lineHeight: hp(2.2), paddingLeft: hp(2.6) + wp(2.5),
  },

  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: hp(1),
  },
  creatorText: { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted },
});
