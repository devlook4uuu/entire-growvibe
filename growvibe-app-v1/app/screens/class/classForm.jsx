/**
 * classForm.jsx
 *
 * Create / edit form for a class.
 * Route params:
 *   sessionId   — uuid (required)
 *   sessionName — display label
 *   branchId    — uuid (required)
 *   branchName  — display label
 *   schoolId    — uuid (required)
 *   classId     — uuid (edit mode only)
 *
 * On create: calls create_class RPC (atomic: class + chat + optional teacher).
 * On edit  : name update via direct patch + teacher swap via update_class_teacher RPC.
 * Teacher picker: bottom-sheet modal matching the schoolForm OwnerPicker pattern.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { useClassForm } from '../../../hooks/useClassForm';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Teacher Picker ───────────────────────────────────────────────────────────
// Matches the exact pattern from schoolForm OwnerPicker:
//   - Tappable trigger row showing current selection
//   - Bottom-sheet Modal with search TextInput + FlatList
function TeacherPicker({ teachers, loading, selectedId, onSelect }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');

  // "No Teacher" option always first, then available teachers
  const options = [
    { id: null, name: 'No Teacher', email: 'Leave class unassigned', avatar_url: null },
    ...teachers,
  ];

  const filtered = query.trim()
    ? options.filter((o) =>
        o.id === null ||
        o.name?.toLowerCase().includes(query.toLowerCase()) ||
        o.email?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  function handleClose() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      {/* Picker trigger */}
      <TouchableOpacity
        style={S.pickerTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {selected?.id
          ? <Avatar url={selected.avatar_url} name={selected.name || ''} size={hp(4)} />
          : (
            <View style={[S.pickerAvatarNone]}>
              <Ionicons name="person-remove-outline" size={hp(2.2)} color={Colors.muted} />
            </View>
          )
        }
        <View style={S.pickerTriggerBody}>
          <Text style={S.pickerTriggerName} numberOfLines={1}>
            {selected?.name || 'Select teacher…'}
          </Text>
          {selected?.id !== null && (
            <Text style={S.pickerTriggerEmail} numberOfLines={1}>{selected?.email}</Text>
          )}
        </View>
        {loading
          ? <ActivityIndicator size="small" color={Colors.muted} />
          : <Ionicons name="chevron-down" size={hp(2)} color={Colors.muted} />
        }
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} animationType="slide" transparent>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>

            {/* Header */}
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Select Incharge Teacher</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={hp(2.6)} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={S.modalSearch}>
              <Ionicons name="search-outline" size={hp(1.9)} color={Colors.muted} />
              <TextInput
                style={S.modalSearchInput}
                placeholder="Search teachers…"
                placeholderTextColor={Colors.muted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Options list */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id ?? '__none__'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId || (item.id === null && selectedId === null);
                const isNone     = item.id === null;
                return (
                  <TouchableOpacity
                    style={[S.option, isSelected && S.optionSelected]}
                    onPress={() => { onSelect(item.id); handleClose(); }}
                    activeOpacity={0.7}
                  >
                    {isNone
                      ? (
                        <View style={[S.optionAvatar, S.optionAvatarNone]}>
                          <Ionicons name="person-remove-outline" size={hp(2.2)} color={Colors.muted} />
                        </View>
                      )
                      : <Avatar url={item.avatar_url} name={item.name || ''} size={hp(5)} />
                    }
                    <View style={S.optionBody}>
                      <Text style={[S.optionName, isNone && { color: Colors.muted }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={S.optionEmail} numberOfLines={1}>{item.email}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={hp(2.4)} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={S.optionEmptyWrap}>
                  <Text style={S.optionEmptyText}>
                    {query.trim() ? `No teachers match "${query}"` : 'No available teachers in this branch.'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Class Form Screen ────────────────────────────────────────────────────────
export default function ClassFormScreen() {
  const router = useRouter();
  const { sessionId, sessionName, branchId, branchName, schoolId, classId } = useLocalSearchParams();

  const { isEdit, cls, fetching, fetchError, teachers, teachersLoading, loadTeachers, save } =
    useClassForm(sessionId, schoolId, branchId, classId);

  const [className,         setClassName]         = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(undefined); // undefined = not yet init
  const [nameError,         setNameError]         = useState('');
  const [saveError,         setSaveError]         = useState('');
  const [submitting,        setSubmitting]        = useState(false);
  const [initialised,       setInitialised]       = useState(!classId);

  // Initialise form from loaded class (edit mode)
  useEffect(() => {
    if (cls && !initialised) {
      setClassName(cls.class_name ?? '');
      setSelectedTeacherId(cls.teacher_id ?? null);
      setInitialised(true);
    }
  }, [cls, initialised]);

  // Set default selectedTeacherId for create mode
  if (!classId && selectedTeacherId === undefined) {
    setSelectedTeacherId(null);
  }

  // Load teacher list once initialised
  useEffect(() => {
    if (!initialised) return;
    const currentTeacherId = isEdit ? (cls?.teacher_id ?? null) : null;
    loadTeachers(currentTeacherId);
  }, [initialised]);

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    setNameError('');
    if (!className.trim() || className.trim().length < 2) {
      setNameError('Class name must be at least 2 characters.');
      return false;
    }
    return true;
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaveError('');
    setSubmitting(true);

    const result = await save({
      class_name: className,
      teacher_id: selectedTeacherId ?? null,
    });

    setSubmitting(false);
    if (result.success) {
      router.back();
    } else {
      setSaveError(result.error);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} sessionName={sessionName} title="Edit Class" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (isEdit && (fetchError || !cls)) {
    return (
      <ScreenWrapper>
        <Header router={router} sessionName={sessionName} title="Edit Class" />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load class</Text>
          <Text style={S.centerSub}>{fetchError}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.outlineBtn} activeOpacity={0.8}>
            <Text style={S.outlineBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <Header router={router} sessionName={sessionName} title={isEdit ? 'Edit Class' : 'New Class'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Identity strip (edit only) */}
          {isEdit && cls && (
            <View style={S.identityCard}>
              <View style={S.identityIconWrap}>
                <Ionicons name="library-outline" size={hp(3)} color={Colors.primary} />
              </View>
              <View style={S.identityMeta}>
                <Text style={S.identityName} numberOfLines={1}>{cls.class_name || '—'}</Text>
                <View style={S.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.muted} />
                  <Text style={S.identityDetail}>{sessionName || 'Session'}</Text>
                </View>
                <View style={S.metaRow}>
                  <Ionicons name="git-branch-outline" size={12} color={Colors.muted} />
                  <Text style={S.identityDetail}>{branchName || 'Branch'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Error banner */}
          {!!saveError && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveError}</Text>
            </View>
          )}

          <View style={S.formGap}>
            <SectionLabel>Class Details</SectionLabel>

            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Class Name</Text>
              <Input
                type="text"
                placeholder="e.g. Grade 5 – A"
                value={className}
                onChangeText={(t) => { setClassName(t); setNameError(''); }}
                error={nameError}
              />
            </View>

            <SectionLabel>Incharge Teacher</SectionLabel>

            <TeacherPicker
              teachers={teachers}
              loading={teachersLoading}
              selectedId={selectedTeacherId ?? null}
              onSelect={setSelectedTeacherId}
            />

            <View style={S.infoBanner}>
              <Ionicons name="information-circle-outline" size={hp(2)} color={Colors.primary} />
              <Text style={S.infoBannerText}>
                {isEdit
                  ? 'Changing the incharge teacher will update their profile and the class group chat automatically.'
                  : 'A group chat will be created automatically for this class. The incharge teacher will be added as a member.'}
              </Text>
            </View>

            <Button
              title={isEdit ? 'Save Changes' : 'Create Class'}
              onPress={handleSave}
              loading={submitting}
              size="small"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────
function Header({ router, sessionName, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.headerBackBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <View style={S.headerCenter}>
        <Text style={S.headerTitle}>{title}</Text>
        {!!sessionName && <Text style={S.headerSub} numberOfLines={1}>{sessionName}</Text>}
      </View>
      <View style={{ width: hp(4.4) }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1.4),
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerBackBtn: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle: { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  scroll: { padding: wp(4), paddingBottom: hp(6), gap: hp(1.6) },

  // Identity strip
  identityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 16, padding: wp(4),
    gap: wp(3.5), shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  identityIconWrap: {
    width: hp(6), height: hp(6), borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  identityMeta: { flex: 1, gap: 4 },
  identityName: { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  identityDetail: { fontSize: hp(1.35), fontFamily: Fonts.medium, color: Colors.soft },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1, fontSize: hp(1.5), fontFamily: Fonts.medium,
    color: Colors.dangerText, lineHeight: hp(2.1),
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: wp(3.5),
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  infoBannerText: {
    flex: 1, fontSize: hp(1.4), fontFamily: Fonts.regular,
    color: Colors.primary, lineHeight: hp(2),
  },

  // Form
  formGap: { gap: hp(1.4) },
  sectionLabel: {
    fontSize: hp(1.35), fontFamily: Fonts.semiBold, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: hp(0.6),
  },
  fieldGroup: { gap: hp(0.6) },
  fieldLabel: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },

  // Teacher picker trigger (matches schoolForm pickerTrigger exactly)
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: wp(3.5), paddingVertical: hp(1.2),
  },
  pickerAvatarNone: {
    width: hp(4), height: hp(4), borderRadius: hp(2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  pickerTriggerBody: { flex: 1 },
  pickerTriggerName: { fontSize: hp(1.65), fontFamily: Fonts.semiBold, color: Colors.ink },
  pickerTriggerEmail: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  // Modal (matches schoolForm exactly)
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: hp(4),
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(5), paddingVertical: hp(2),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: wp(4), marginVertical: hp(1.4),
    paddingHorizontal: wp(3.5), height: hp(5.4),
    backgroundColor: Colors.canvas, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalSearchInput: {
    flex: 1, fontSize: hp(1.65), fontFamily: Fonts.regular,
    color: Colors.ink, paddingVertical: 0,
  },

  // Option row (matches schoolForm ownerOption)
  option: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingVertical: hp(1.4),
    borderRadius: 12, marginHorizontal: wp(2),
  },
  optionSelected: { backgroundColor: Colors.primaryLight },
  optionAvatar: { width: hp(5), height: hp(5), borderRadius: hp(2.5) },
  optionAvatarNone: { backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center' },
  optionBody: { flex: 1 },
  optionName: { fontSize: hp(1.65), fontFamily: Fonts.semiBold, color: Colors.ink },
  optionEmail: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },
  optionEmptyWrap: { paddingVertical: hp(4), alignItems: 'center' },
  optionEmptyText: { fontSize: hp(1.6), fontFamily: Fonts.regular, color: Colors.muted },

  // Center states
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), padding: wp(8) },
  centerIcon: { width: hp(10), height: hp(10), borderRadius: hp(5), alignItems: 'center', justifyContent: 'center', marginBottom: hp(0.4) },
  centerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  centerSub: { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.muted, textAlign: 'center' },
  outlineBtn: {
    marginTop: hp(1), paddingHorizontal: wp(8), paddingVertical: hp(1.2),
    borderRadius: 22, backgroundColor: Colors.canvas, borderWidth: 1.5, borderColor: Colors.border,
  },
  outlineBtnText: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft },
});
