/**
 * classList.jsx
 *
 * Session-scoped class list screen.
 * Route params:
 *   sessionId   — uuid (required)
 *   sessionName — display label
 *   branchId    — uuid (passed through to classForm)
 *   branchName  — display label (passed through)
 *   schoolId    — uuid (passed through)
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useClassList } from '../../../hooks/useClassList';
import {
  EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <View style={S.skeletonIcon} />
        <SkeletonLines widths={['45%', '65%', '35%']} />
      </View>
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Class Card ───────────────────────────────────────────────────────────────
function ClassCard({ item, onEdit, onStudents, onGroupChat, onAttendance }) {
  const hasTeacher = !!item.teacher_id;

  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        {/* Class icon */}
        <View style={S.classIconWrap}>
          <Ionicons name="library-outline" size={hp(2.6)} color={Colors.primary} />
        </View>

        <View style={S.cardBody}>
          <Text style={S.cardName} numberOfLines={1}>{item.class_name || '—'}</Text>

          {/* Teacher row */}
          <View style={S.metaRow}>
            <Ionicons
              name={hasTeacher ? 'person-outline' : 'person-add-outline'}
              size={hp(1.5)}
              color={hasTeacher ? Colors.soft : Colors.muted}
            />
            <Text style={[S.metaText, !hasTeacher && { color: Colors.muted, fontStyle: 'italic' }]} numberOfLines={1}>
              {hasTeacher ? item.teacher_name : 'No incharge teacher'}
            </Text>
          </View>

          {/* Chat row */}
          <View style={S.metaRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={hp(1.5)} color={Colors.muted} />
            <Text style={S.metaText}>Group chat created</Text>
          </View>
        </View>
      </View>

      <CardFooter
        left={null}
        right={
          <View style={S.cardActions}>
            <TouchableOpacity style={S.groupChatBtn} onPress={() => onGroupChat(item)} hitSlop={8} activeOpacity={0.75}>
              <Ionicons name="chatbubbles-outline" size={hp(1.8)} color={Colors.primary} />
              <Text style={S.groupChatBtnText}>Group Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.attendanceBtn} onPress={() => onAttendance(item)} hitSlop={8} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={hp(1.8)} color={Colors.orange} />
              <Text style={S.attendanceBtnText}>Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.studentsBtn} onPress={() => onStudents(item)} hitSlop={8} activeOpacity={0.75}>
              <Ionicons name="school-outline" size={hp(1.8)} color={Colors.purple} />
              <Text style={S.studentsBtnText}>Students</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={hp(2.1)} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ─── Class List Screen ────────────────────────────────────────────────────────
function sanitize(val) {
  return val && val !== 'null' && val !== 'undefined' ? val : '';
}

export default function ClassListScreen() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);
  const params  = useLocalSearchParams();

  // Sanitize — useLocalSearchParams returns strings; "null"/"undefined" must be treated as empty
  const branchId    = sanitize(params.branchId)  || profile?.branch_id  || '';
  const schoolId    = sanitize(params.schoolId)  || profile?.school_id  || '';
  const sessionName = params.sessionName || '';
  const branchName  = params.branchName  || '';

  // sessionId may be missing for non-owner roles — resolve from branch if needed
  const paramSessionId = sanitize(params.sessionId);
  const [sessionId, setSessionId] = useState(paramSessionId || null);
  const [resolving, setResolving] = useState(!paramSessionId && !!branchId);

  useEffect(() => {
    if (paramSessionId || !branchId) { setResolving(false); return; }
    supabase
      .from('sessions')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setSessionId(data.id);
        setResolving(false);
      });
  }, [paramSessionId, branchId]);

  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } =
    useClassList(resolving ? null : sessionId);

  function handleEdit(cls) {
    router.push({
      pathname: '/screens/class/classForm',
      params: { sessionId, sessionName, branchId, branchName, schoolId, classId: cls.id },
    });
  }

  function handleStudents(cls) {
    router.push({
      pathname: '/screens/student/studentList',
      params: {
        classId:     cls.id,
        className:   cls.class_name,
        branchId,
        schoolId,
        sessionId,
        sessionName,
      },
    });
  }

  function handleAttendance(cls) {
    router.push({
      pathname: '/screens/attendance/studentAttendanceHistory',
      params: {
        classId:   cls.id,
        className: cls.class_name,
        sessionId,
        schoolId,
        branchId,
        canEdit:   'true',
      },
    });
  }

  function handleGroupChat(cls) {
    if (!cls.chat_id) {
      Alert.alert('No Group Chat', 'This class does not have a group chat yet. Please create one first.');
      return;
    }
    router.push({
      pathname: '/screens/chat/chatMemberManager',
      params: {
        chatId:    cls.chat_id,
        classId:   cls.id,
        className: cls.class_name,
        branchId,
        schoolId,
      },
    });
  }

  function handleAdd() {
    router.push({
      pathname: '/screens/class/classForm',
      params: { sessionId: sessionId || '', sessionName, branchId, branchName, schoolId },
    });
  }

  if (resolving) {
    return (
      <ScreenWrapper>
        <ListScreenHeader router={router} title="Classes" subtitle={sessionName} onAdd={null} />
        <View style={S.listPad}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      </ScreenWrapper>
    );
  }

  if (!sessionId) {
    return (
      <ScreenWrapper>
        <ListScreenHeader router={router} title="Classes" subtitle="" onAdd={null} />
        <View style={S.noSessionWrap}>
          <View style={S.noSessionIconWrap}>
            <Ionicons name="calendar-outline" size={hp(3.5)} color={Colors.primary} />
          </View>
          <Text style={S.noSessionTitle}>No active session</Text>
          <Text style={S.noSessionSub}>Create a session for your branch to start managing classes.</Text>
          <TouchableOpacity
            style={S.noSessionBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/screens/session/sessionList')}
          >
            <Ionicons name="add-circle-outline" size={hp(2)} color={Colors.white} />
            <Text style={S.noSessionBtnText}>Create Session</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader
        router={router}
        title="Classes"
        subtitle={sessionName}
        onAdd={handleAdd}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search classes…" />

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClassCard item={item} onEdit={handleEdit} onStudents={handleStudents} onGroupChat={handleGroupChat} onAttendance={handleAttendance} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="library-outline"
              emptyTitle="No classes yet"
              emptySub="Create the first class for this session."
              search={search}
              searchSub="Try a different class name."
              onClear={() => setSearch('')}
            />
          }
          onRefresh={refresh}
          refreshing={refreshing}
          contentContainerStyle={items.length === 0 ? S.emptyContainer : S.listPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  listPad: { paddingHorizontal: wp(4), paddingBottom: hp(4), gap: hp(1.2) },
  emptyContainer: { flexGrow: 1, paddingHorizontal: wp(4) },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: wp(3) },
  cardBody: { flex: 1, gap: hp(0.5) },

  classIconWrap: {
    width: hp(5.5), height: hp(5.5), borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  skeletonIcon: {
    width: hp(5.5), height: hp(5.5), borderRadius: 14,
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },

  cardName: {
    fontSize: hp(1.85), fontFamily: Fonts.semiBold,
    color: Colors.ink, letterSpacing: -0.2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: hp(1.35), fontFamily: Fonts.regular,
    color: Colors.soft, flexShrink: 1,
  },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendanceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(2.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.orangeLight,
  },
  attendanceBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.orange },
  groupChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(2.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  groupChatBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.primary },
  studentsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(2.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.purpleLight,
  },
  studentsBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.purple },
  editBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  noSessionWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: wp(8), gap: hp(1.2),
  },
  noSessionIconWrap: {
    width: hp(8), height: hp(8), borderRadius: hp(4),
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: hp(0.5),
  },
  noSessionTitle: {
    fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink,
    letterSpacing: -0.3, textAlign: 'center',
  },
  noSessionSub: {
    fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted,
    textAlign: 'center', lineHeight: hp(2.2),
  },
  noSessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: hp(1), backgroundColor: Colors.primary,
    paddingHorizontal: wp(6), paddingVertical: hp(1.4),
    borderRadius: 12,
  },
  noSessionBtnText: {
    fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.white,
  },
});
