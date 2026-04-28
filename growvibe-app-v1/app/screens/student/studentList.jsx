/**
 * studentList.jsx
 *
 * Class-scoped student list screen.
 * Route params:
 *   classId    — uuid (required)
 *   className  — display label
 *   branchId   — uuid (passed through to studentForm)
 *   schoolId   — uuid (passed through)
 */

import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useStudentList } from '../../../hooks/useStudentList';
import Avatar from '../../../components/Avatar';
import {
  StatusBadge, EmptyState, ErrorState,
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
        <View style={S.skeletonAvatar} />
        <SkeletonLines widths={['50%', '70%', '38%']} />
      </View>
      <View style={{ marginTop: hp(1.2), height: hp(2.4), borderRadius: 20, backgroundColor: Colors.borderLight, width: hp(7) }} />
    </View>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ item, onEdit, onFee }) {
  const joinDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  const fee = item.student_fee != null
    ? `Fee: ${Number(item.student_fee).toLocaleString()}`
    : null;

  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <Avatar url={item.avatar_url} name={item.name || ''} size={hp(6)} />
        <View style={S.cardBody}>
          <Text style={S.cardName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={S.cardEmail} numberOfLines={1}>{item.email || '—'}</Text>
          <View style={S.cardMeta}>
            {fee && (
              <View style={S.metaRow}>
                <Ionicons name="cash-outline" size={hp(1.5)} color={Colors.muted} />
                <Text style={S.metaText}>{fee}</Text>
              </View>
            )}
            {joinDate && (
              <View style={S.metaRow}>
                <Ionicons name="calendar-outline" size={hp(1.5)} color={Colors.muted} />
                <Text style={S.metaText}>Joined {joinDate}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <CardFooter
        left={<StatusBadge active={item.is_active} />}
        right={
          <View style={{ flexDirection: 'row', gap: wp(2) }}>
            <TouchableOpacity style={S.feeBtn} onPress={() => onFee(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="cash-outline" size={hp(1.9)} color={Colors.success} />
              <Text style={S.feeBtnText}>Fee</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={hp(2.2)} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ─── Student List Screen ──────────────────────────────────────────────────────
export default function StudentListScreen() {
  const router = useRouter();
  const { classId, className, branchId, schoolId, sessionId, sessionName } = useLocalSearchParams();
  const { selectedSessionId } = useSelector((s) => s.app);
  const profile = useSelector((s) => s.auth.profile);

  // Use param sessionId if provided, else fall back to Redux selected session
  const resolvedSessionId = sessionId || selectedSessionId || '';

  const { items, loading, loadingMore, refreshing, error, search, hasMore, setSearch, loadMore, refresh } =
    useStudentList(classId, profile?.role);

  function handleEdit(student) {
    router.push({
      pathname: '/screens/student/studentForm',
      params: { classId, className, branchId, schoolId, studentId: student.id },
    });
  }

  function handleAdd() {
    router.push({
      pathname: '/screens/student/studentForm',
      params: { classId, className, branchId, schoolId },
    });
  }

  function handleFee(student) {
    router.push({
      pathname: '/screens/fee/feeList',
      params: {
        studentId:   student.id,
        studentName: student.name,
        sessionId:   resolvedSessionId,
        sessionName: sessionName || '',
        classId,
        branchId,
        schoolId,
      },
    });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader
        router={router}
        title="Students"
        subtitle={className}
        onAdd={handleAdd}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search students…" />

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
          renderItem={({ item }) => <StudentCard item={item} onEdit={handleEdit} onFee={handleFee} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="school-outline"
              emptyTitle="No students yet"
              emptySub="Add the first student to this class."
              search={search}
              searchSub="Try a different name or email."
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
  listPad:        { paddingHorizontal: wp(4), paddingBottom: hp(4), gap: hp(1.2) },
  emptyContainer: { flexGrow: 1, paddingHorizontal: wp(4) },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  cardBody: { flex: 1, gap: hp(0.3) },
  cardName: { fontSize: hp(1.85), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  cardEmail:{ fontSize: hp(1.5),  fontFamily: Fonts.regular,  color: Colors.muted },
  cardMeta: { marginTop: hp(0.5), gap: hp(0.3) },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 1 },

  feeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(3), height: hp(4), borderRadius: 10,
    backgroundColor: Colors.successLight,
  },
  feeBtnText: { fontSize: hp(1.45), fontFamily: Fonts.semiBold, color: Colors.success },
  editBtn: {
    width: hp(4), height: hp(4), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  skeletonAvatar: {
    width: hp(6), height: hp(6), borderRadius: hp(3),
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },
});
