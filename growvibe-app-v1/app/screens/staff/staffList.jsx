/**
 * staffList.jsx
 *
 * Shared list screen for principal, coordinator, teacher.
 * Route params:
 *   role        — 'principal' | 'coordinator' | 'teacher'
 *   branchId    — uuid
 *   branchName  — display label (optional)
 *   schoolId    — uuid
 *
 * Principal & coordinator: one per branch — shows "Already assigned" banner
 * when a record exists and hides the add button.
 * Teacher: multiple allowed.
 */

import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStaffList } from '../../../hooks/useStaffList';
import Avatar from '../../../components/Avatar';
import {
  StatusBadge, EmptyState, ErrorState,
  ListScreenHeader, SearchBar, LoadMoreFooter, CardFooter, SkeletonLines,
} from '../../../components/ListScreenComponents';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const ROLE_META = {
  principal: {
    title:     'Principal',
    emptyTitle: 'No principal yet',
    emptySub:   'Add the branch principal to get started.',
    singleOnly: true,
  },
  coordinator: {
    title:     'Coordinator',
    emptyTitle: 'No coordinator yet',
    emptySub:   'Add the branch coordinator to get started.',
    singleOnly: true,
  },
  teacher: {
    title:     'Teachers',
    emptyTitle: 'No teachers yet',
    emptySub:   'Add teachers to this branch.',
    singleOnly: false,
  },
};

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

// ─── Staff Card ───────────────────────────────────────────────────────────────
function StaffCard({ item, role, onEdit, onAttendance }) {
  const joinDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <Avatar url={item.avatar_url} name={item.name || ''} size={hp(6)} />
        <View style={S.cardBody}>
          <Text style={S.cardName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={S.cardEmail} numberOfLines={1}>{item.email || '—'}</Text>
          <View style={S.cardMeta}>
            {role === 'teacher' && (
              <View style={S.metaRow}>
                <Ionicons name="library-outline" size={hp(1.5)} color={Colors.muted} />
                <Text style={S.metaText} numberOfLines={1}>
                  {item.class_name ?? (item.class_id ? 'Class assigned' : 'Unassigned')}
                </Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {role === 'teacher' && (
              <TouchableOpacity style={S.attendanceBtn} onPress={() => onAttendance(item)} hitSlop={8} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={hp(1.8)} color={Colors.orange} />
                <Text style={S.attendanceBtnText}>Attendance</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.editBtn} onPress={() => onEdit(item)} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={hp(2.2)} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ─── Staff List Screen ────────────────────────────────────────────────────────
export default function StaffListScreen() {
  const router = useRouter();
  const { role, branchId, branchName, schoolId } = useLocalSearchParams();

  const meta = ROLE_META[role] ?? ROLE_META.teacher;

  const { items, loading, loadingMore, refreshing, error, search, hasMore, dataReady, setSearch, loadMore, refresh } =
    useStaffList(role, branchId);

  // Principal & coordinator: only one allowed per branch.
  // Hide the add button until the first fetch completes (dataReady).
  // After load: show add button only if no record exists.
  const isSingleOnly  = meta.singleOnly;
  const alreadyExists = isSingleOnly && items.length > 0;
  const canAdd        = dataReady && (!isSingleOnly || !alreadyExists);

  function handleEdit(staff) {
    router.push({
      pathname: '/screens/staff/staffForm',
      params: { role, branchId, schoolId, branchName, staffId: staff.id },
    });
  }

  function handleAttendance(staff) {
    router.push({
      pathname: '/screens/attendance/teacherAttendanceHistory',
      params: {
        teacherId:   staff.id,
        teacherName: staff.name,
        sessionId:   '',   // teacherAttendanceHistory resolves this via the hook
        schoolId,
        branchId,
        canEdit:     'true',
      },
    });
  }

  function handleAdd() {
    router.push({
      pathname: '/screens/staff/staffForm',
      params: { role, branchId, schoolId, branchName },
    });
  }

  return (
    <ScreenWrapper>
      <ListScreenHeader
        router={router}
        title={meta.title}
        subtitle={branchName}
        onAdd={canAdd ? handleAdd : undefined}
      />

      {/* One-per-branch warning */}
      {alreadyExists && !loading && (
        <View style={S.assignedBanner}>
          <Ionicons name="information-circle-outline" size={hp(2)} color={Colors.primary} />
          <Text style={S.assignedBannerText}>
            This branch already has a {role}. Edit the existing record below.
          </Text>
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder={`Search ${meta.title.toLowerCase()}…`} />

      {loading ? (
        <View style={S.listPad}>
          {Array.from({ length: isSingleOnly ? 1 : 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StaffCard item={item} role={role} onEdit={handleEdit} onAttendance={handleAttendance} />}
          ListFooterComponent={<LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />}
          ListEmptyComponent={
            <EmptyState
              iconName="person-outline"
              emptyTitle={meta.emptyTitle}
              emptySub={meta.emptySub}
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
  listPad:      { paddingHorizontal: wp(4), paddingBottom: hp(4), gap: hp(1.2) },
  emptyContainer: { flexGrow: 1, paddingHorizontal: wp(4) },

  assignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    marginHorizontal: wp(4),
    marginBottom: hp(1),
    padding: wp(3.5),
  },
  assignedBannerText: {
    flex: 1,
    fontSize: hp(1.45),
    fontFamily: Fonts.medium,
    color: Colors.primary,
    lineHeight: hp(2),
  },

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

  attendanceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(2.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.orangeLight,
  },
  attendanceBtnText: { fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.orange },
  editBtn: {
    width: hp(4), height: hp(4), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  skeletonAvatar: {
    width: hp(6), height: hp(6), borderRadius: hp(3),
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },
});
