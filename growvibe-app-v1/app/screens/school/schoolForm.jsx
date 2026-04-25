import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { useSchoolForm } from '../../../hooks/useSchoolForm';
import { uploadImage } from '../../../helpers/storageUpload';
import { supabase } from '../../../lib/supabase';
import { invalidateTopBarCache } from '../../../components/TopBar';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Validation ───────────────────────────────────────────────────────────────
const Schema = Yup.object({
  name:           Yup.string().trim().min(2, 'At least 2 characters').required('School name is required'),
  school_address: Yup.string().trim(),
  school_contact: Yup.string().trim(),
});

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── Owner Picker ─────────────────────────────────────────────────────────────
// Shows current selection as a tappable row. Opens a modal with the full list.
// currentOwner: { id, name, email, avatar_url } — the already-assigned owner (edit only)
// availableOwners: unassigned owners from available_owners view
function OwnerPicker({ currentOwner, availableOwners, loading, selectedId, onSelect }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');

  // Build the full options list:
  //   - "None" option always first
  //   - Current owner at top (if exists and not already in available list)
  //   - All available owners
  const options = [
    { id: null, name: 'No Owner', email: 'Remove owner assignment', avatar_url: null },
    ...(currentOwner && currentOwner.id !== null ? [currentOwner] : []),
    ...availableOwners,
  ];

  const filtered = query.trim()
    ? options.filter((o) =>
        o.id === null ||
        o.name?.toLowerCase().includes(query.toLowerCase()) ||
        o.email?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <>
      {/* Picker trigger */}
      <TouchableOpacity
        style={S.pickerTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Avatar url={selected?.avatar_url} name={selected?.name || ''} size={hp(4)} />
        <View style={S.pickerTriggerBody}>
          <Text style={S.pickerTriggerName} numberOfLines={1}>
            {selected?.name || 'Select owner…'}
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

            {/* Modal header */}
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Select Owner</Text>
              <TouchableOpacity onPress={() => { setOpen(false); setQuery(''); }} hitSlop={8}>
                <Ionicons name="close" size={hp(2.6)} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Modal search */}
            <View style={S.modalSearch}>
              <Ionicons name="search-outline" size={hp(1.9)} color={Colors.muted} />
              <TextInput
                style={S.modalSearchInput}
                placeholder="Search owners…"
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
                    style={[S.ownerOption, isSelected && S.ownerOptionSelected]}
                    onPress={() => { onSelect(item.id); setOpen(false); setQuery(''); }}
                    activeOpacity={0.7}
                  >
                    {isNone
                      ? (
                        <View style={[S.ownerOptionAvatar, S.ownerOptionAvatarNone]}>
                          <Ionicons name="person-remove-outline" size={hp(2.2)} color={Colors.muted} />
                        </View>
                      )
                      : <Avatar url={item.avatar_url} name={item.name || ''} size={hp(5)} />
                    }
                    <View style={S.ownerOptionBody}>
                      <Text style={[S.ownerOptionName, isNone && { color: Colors.muted }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={S.ownerOptionEmail} numberOfLines={1}>{item.email}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={hp(2.4)} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={S.ownerEmptyWrap}>
                  <Text style={S.ownerEmptyText}>No owners found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── School Form Screen ───────────────────────────────────────────────────────
export default function SchoolFormScreen() {
  const router     = useRouter();
  const { schoolId } = useLocalSearchParams();

  const {
    isEdit,
    school,
    fetching,
    fetchError,
    availableOwners,
    ownersLoading,
    save,
  } = useSchoolForm(schoolId);

  const [isActive, setIsActive]               = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState(undefined); // undefined = not yet initialised
  const [saveError, setSaveError]             = useState('');

  // Logo state
  const [logoLocalUri,  setLogoLocalUri]  = useState(null);  // picked but not yet saved
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoStoragePath, setLogoStoragePath] = useState(null); // path after upload

  // Initialise isActive and selectedOwnerId from loaded school (edit mode)
  const ownerInitialised = selectedOwnerId !== undefined || !isEdit || !!school;

  if (isEdit && school && selectedOwnerId === undefined) {
    setIsActive(school.is_active ?? true);
    setSelectedOwnerId(school.owner_id ?? null);
  }
  if (!isEdit && selectedOwnerId === undefined) {
    setSelectedOwnerId(null);
  }

  // Build the currentOwner object (the already-assigned owner in edit mode)
  const currentOwner = (isEdit && school?.owner_id)
    ? { id: school.owner_id, name: school.owner_name, email: school.owner_email, avatar_url: school.owner_avatar_url }
    : null;

  // ── Logo picker ───────────────────────────────────────────────────────────
  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload a school logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const ext      = mimeType.split('/')[1] || 'jpg';

    setLogoLocalUri(asset.uri);
    setLogoUploading(true);

    // Use a temp name for new schools (no schoolId yet); edit mode uses the real id
    const pathId  = schoolId || `tmp_${Date.now()}`;
    const newPath = `logos/${pathId}.${ext}`;
    const prevPath = school?.logo_url && !school.logo_url.startsWith('http')
      ? school.logo_url
      : null; // existing path (if stored as path, not URL)

    const uploaded = await uploadImage({
      bucket:       'school-logos',
      path:         newPath,
      uri:          asset.uri,
      mimeType,
      previousPath: logoStoragePath || prevPath,
    });

    setLogoUploading(false);
    if (uploaded) {
      setLogoStoragePath(uploaded);
    } else {
      Alert.alert('Upload failed', 'Could not upload logo. Please try again.');
      setLogoLocalUri(null);
    }
  }

  function removeLogo() {
    setLogoLocalUri(null);
    setLogoStoragePath(null);
  }

  // Resolve the logo preview URI
  const existingLogoUrl = school?.logo_url || null;
  const logoPreviewUri  = logoLocalUri || existingLogoUrl;

  // ── Save handler ─────────────────────────────────────────────────────────
  async function handleSave(values, { setSubmitting }) {
    setSaveError('');

    // Derive the logo_url to save:
    //   - if user uploaded a new one → use public URL of the storage path
    //   - if user removed it → pass empty string (clear)
    //   - if unchanged → pass undefined (don't overwrite)
    let logoUrl;
    if (logoStoragePath) {
      const { data } = supabase.storage.from('school-logos').getPublicUrl(logoStoragePath);
      logoUrl = data?.publicUrl || null;
    } else if (logoLocalUri === null && existingLogoUrl) {
      // User explicitly removed the logo
      logoUrl = '';
    }
    // else logoUrl remains undefined → hook won't overwrite the existing value

    const result = await save({
      name:           values.name,
      school_address: values.school_address || null,
      school_contact: values.school_contact || null,
      is_active:      isActive,
      selectedOwnerId,
      logoUrl,
    });

    if (result.success) {
      invalidateTopBarCache(schoolId || undefined);
      router.back();
    } else {
      setSaveError(result.error);
    }
    setSubmitting(false);
  }

  // ── Loading (edit fetch) ──────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <Header router={router} title="Edit School" />
        <View style={S.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (isEdit && (fetchError || !school)) {
    return (
      <ScreenWrapper>
        <Header router={router} title="Edit School" />
        <View style={S.centerWrap}>
          <View style={[S.centerIcon, { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={hp(4)} color={Colors.danger} />
          </View>
          <Text style={S.centerTitle}>Failed to load school</Text>
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
      <Header router={router} title={isEdit ? 'Edit School' : 'Add School'} />

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
          {/* Error banner */}
          {!!saveError && (
            <View style={S.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.dangerText} />
              <Text style={S.errorBannerText}>{saveError}</Text>
            </View>
          )}

          <Formik
            initialValues={{
              name:           school?.name           ?? '',
              school_address: school?.school_address ?? '',
              school_contact: school?.school_contact ?? '',
            }}
            validationSchema={Schema}
            onSubmit={handleSave}
            enableReinitialize
          >
            {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
              <View style={S.formGap}>

                {/* School Logo */}
                <SectionLabel>School Logo <Text style={S.optional}>(optional)</Text></SectionLabel>

                <View style={S.logoPickerRow}>
                  {/* Preview */}
                  <TouchableOpacity
                    style={S.logoPickerThumb}
                    onPress={pickLogo}
                    activeOpacity={0.8}
                    disabled={logoUploading}
                  >
                    {logoPreviewUri ? (
                      <Image
                        source={{ uri: logoPreviewUri }}
                        style={S.logoPickerImg}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={S.logoPickerPlaceholder}>
                        <Ionicons name="image-outline" size={hp(3.2)} color={Colors.muted} />
                      </View>
                    )}
                    {/* Camera badge */}
                    <View style={S.logoPickerBadge}>
                      {logoUploading
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Ionicons name="camera" size={hp(1.6)} color={Colors.white} />
                      }
                    </View>
                  </TouchableOpacity>

                  {/* Actions */}
                  <View style={S.logoPickerActions}>
                    <TouchableOpacity
                      style={S.logoPickerBtn}
                      onPress={pickLogo}
                      disabled={logoUploading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload-outline" size={hp(2)} color={Colors.primary} />
                      <Text style={S.logoPickerBtnText}>
                        {logoPreviewUri ? 'Change logo' : 'Upload logo'}
                      </Text>
                    </TouchableOpacity>

                    {logoPreviewUri && (
                      <TouchableOpacity
                        style={[S.logoPickerBtn, S.logoPickerBtnDanger]}
                        onPress={removeLogo}
                        disabled={logoUploading}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={hp(2)} color={Colors.danger} />
                        <Text style={[S.logoPickerBtnText, { color: Colors.danger }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* School details */}
                <SectionLabel>School Information</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>School Name</Text>
                  <Input
                    type="text"
                    placeholder="e.g. Bright Future Academy"
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    error={touched.name && errors.name}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Address <Text style={S.optional}>(optional)</Text></Text>
                  <Input
                    type="text"
                    placeholder="Street, City, Province"
                    value={values.school_address}
                    onChangeText={handleChange('school_address')}
                    onBlur={handleBlur('school_address')}
                    error={touched.school_address && errors.school_address}
                  />
                </View>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Contact <Text style={S.optional}>(optional)</Text></Text>
                  <Input
                    type="text"
                    placeholder="Phone number or email"
                    value={values.school_contact}
                    onChangeText={handleChange('school_contact')}
                    onBlur={handleBlur('school_contact')}
                    error={touched.school_contact && errors.school_contact}
                  />
                </View>

                {/* Owner assignment */}
                <SectionLabel>Assign Owner</SectionLabel>

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Owner</Text>
                  {ownerInitialised && (
                    <OwnerPicker
                      currentOwner={currentOwner}
                      availableOwners={availableOwners}
                      loading={ownersLoading}
                      selectedId={selectedOwnerId}
                      onSelect={setSelectedOwnerId}
                    />
                  )}
                  <Text style={S.fieldHint}>
                    Only unassigned owners appear in the list.
                  </Text>
                </View>

                {/* Status (edit only) */}
                {isEdit && (
                  <>
                    <SectionLabel>Status</SectionLabel>
                    <View style={S.statusRow}>
                      <View style={S.statusLeft}>
                        <View style={[S.statusDot, { backgroundColor: isActive ? Colors.success : Colors.danger }]} />
                        <View>
                          <Text style={S.statusLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
                          <Text style={S.statusSub}>
                            {isActive ? 'School is visible and operational.' : 'School is hidden from the app.'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isActive}
                        onValueChange={(val) => {
                          if (!val) {
                            Alert.alert(
                              'Deactivate School',
                              'This will hide the school from the app. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Deactivate', style: 'destructive', onPress: () => setIsActive(false) },
                              ]
                            );
                          } else {
                            setIsActive(true);
                          }
                        }}
                        trackColor={{ false: Colors.borderLight, true: Colors.success + '60' }}
                        thumbColor={isActive ? Colors.success : Colors.muted}
                      />
                    </View>
                  </>
                )}

                <Button
                  title={isEdit ? 'Save Changes' : 'Add School'}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  size="small"
                />

              </View>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────
function Header({ router, title }) {
  return (
    <View style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.headerBackBtn} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
      </TouchableOpacity>
      <Text style={S.headerTitle}>{title}</Text>
      <View style={{ width: hp(4.4) }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.6),
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerBackBtn: {
    width: hp(4.4),
    height: hp(4.4),
    borderRadius: hp(2.2),
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: hp(2.1),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },

  scroll: {
    padding: wp(4),
    paddingBottom: hp(6),
    gap: hp(1.6),
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: wp(3.5),
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorBannerText: {
    flex: 1,
    fontSize: hp(1.5),
    fontFamily: Fonts.medium,
    color: Colors.dangerText,
    lineHeight: hp(2.1),
  },

  // Form
  formGap: {
    gap: hp(1.4),
  },
  sectionLabel: {
    fontSize: hp(1.35),
    fontFamily: Fonts.semiBold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: hp(0.6),
  },
  fieldGroup: {
    gap: hp(0.6),
  },
  fieldLabel: {
    fontSize: hp(1.5),
    fontFamily: Fonts.medium,
    color: Colors.soft,
    marginLeft: 2,
  },
  optional: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },
  fieldHint: {
    fontSize: hp(1.3),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginLeft: 2,
  },

  // Logo picker
  logoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  logoPickerThumb: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(2),
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  logoPickerImg: {
    width: '100%',
    height: '100%',
  },
  logoPickerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.canvas,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPickerBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: hp(3.2),
    height: hp(3.2),
    borderRadius: hp(1.6),
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPickerActions: {
    flex: 1,
    gap: hp(1),
  },
  logoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryLight,
    alignSelf: 'flex-start',
  },
  logoPickerBtnDanger: {
    borderColor: Colors.dangerLight,
    backgroundColor: Colors.dangerLight,
  },
  logoPickerBtnText: {
    fontSize: hp(1.55),
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },

  // Owner picker trigger
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
  },
  pickerTriggerBody: {
    flex: 1,
  },
  pickerTriggerName: {
    fontSize: hp(1.65),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
  },
  pickerTriggerEmail: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginTop: 1,
  },

  // Owner picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: hp(4),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: hp(2),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: wp(4),
    marginVertical: hp(1.4),
    paddingHorizontal: wp(3.5),
    height: hp(5.4),
    backgroundColor: Colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: hp(1.65),
    fontFamily: Fonts.regular,
    color: Colors.ink,
    paddingVertical: 0,
  },

  // Owner option row
  ownerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    borderRadius: 12,
    marginHorizontal: wp(2),
  },
  ownerOptionSelected: {
    backgroundColor: Colors.primaryLight,
  },
  ownerOptionAvatar: {
    width: hp(5),
    height: hp(5),
    borderRadius: hp(2.5),
  },
  ownerOptionAvatarNone: {
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerOptionBody: {
    flex: 1,
  },
  ownerOptionName: {
    fontSize: hp(1.65),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
  },
  ownerOptionEmail: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginTop: 1,
  },
  ownerEmptyWrap: {
    paddingVertical: hp(4),
    alignItems: 'center',
  },
  ownerEmptyText: {
    fontSize: hp(1.6),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },

  // Status toggle
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: hp(1.7),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  statusSub: {
    fontSize: hp(1.35),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },

  // Center (loading / error)
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(1.2),
    padding: wp(8),
  },
  centerIcon: {
    width: hp(10),
    height: hp(10),
    borderRadius: hp(5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.4),
  },
  centerTitle: {
    fontSize: hp(2),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  centerSub: {
    fontSize: hp(1.55),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    textAlign: 'center',
  },
  outlineBtn: {
    marginTop: hp(1),
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.2),
    borderRadius: 22,
    backgroundColor: Colors.canvas,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  outlineBtnText: {
    fontSize: hp(1.6),
    fontFamily: Fonts.semiBold,
    color: Colors.soft,
  },
});
