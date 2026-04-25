import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Formik } from 'formik';
import * as Yup from 'yup';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/Button';
import Input from '../../components/Input';
import { CachedAvatar } from '../../helpers/imageCache';
import { uploadImage } from '../../helpers/storageUpload';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constant/colors';
import { Fonts } from '../../constant/fonts';
import { hp, wp } from '../../helpers/dimension';
import { logoutThunk, updateProfileThunk } from '../../store/authSlice';

// ─── Validation ───────────────────────────────────────────────────────────────
const EditSchema = Yup.object({
  bio:           Yup.string().max(300, 'Max 300 characters'),
  facebook_url:  Yup.string().url('Enter a valid URL (include https://)'),
  instagram_url: Yup.string().url('Enter a valid URL (include https://)'),
  interests:     Yup.string(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin:       { label: 'Admin',       bg: Colors.purpleLight,  text: Colors.purple },
  owner:       { label: 'Owner',       bg: Colors.dangerLight,  text: Colors.dangerText },
  principal:   { label: 'Principal',   bg: Colors.primaryLight, text: Colors.primaryDark },
  coordinator: { label: 'Coordinator', bg: Colors.orangeLight,  text: Colors.orange },
  teacher:     { label: 'Teacher',     bg: Colors.successLight, text: Colors.success },
  student:     { label: 'Student',     bg: Colors.hover,        text: Colors.soft },
};

function getRoleCfg(role) {
  return ROLE_CONFIG[role] || { label: role || 'Unknown', bg: Colors.hover, text: Colors.soft };
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toISODate(date) {
  // Returns YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <Text style={S.sectionTitle}>{children}</Text>;
}

function InfoRow({ label, value, last = false }) {
  if (!value) return null;
  return (
    <View style={[S.infoRow, last && S.infoRowLast]}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function RoleBadge({ role }) {
  const cfg = getRoleCfg(role);
  return (
    <View style={[S.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[S.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function SocialLinkRow({ url, label, icon, color, last = false }) {
  if (!url) return null;
  return (
    <TouchableOpacity
      style={[S.socialRow, last && S.infoRowLast]}
      onPress={() => Linking.openURL(url).catch(() => {})}
      activeOpacity={0.7}
    >
      <View style={[S.socialIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[S.socialLabel, { color }]}>{label}</Text>
      <Ionicons name="open-outline" size={14} color={Colors.muted} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

// ─── Date picker field ────────────────────────────────────────────────────────
function DateField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value) : new Date(2000, 0, 1);

  function handleChange(_event, selected) {
    if (Platform.OS === 'android') setShow(false);
    if (selected) onChange(toISODate(selected));
  }

  return (
    <View style={S.editFieldGroup}>
      <Text style={S.editLabel}>{label}</Text>
      <TouchableOpacity
        onPress={() => setShow(true)}
        style={S.datePickerBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
        <Text style={[S.datePickerText, !value && { color: Colors.muted }]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.muted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* iOS: bottom sheet picker */}
      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
              activeOpacity={1}
              onPress={() => setShow(false)}
            />
            <View style={S.dateSheet}>
              <View style={S.dateSheetHeader}>
                <Text style={S.dateSheetTitle}>Date of Birth</Text>
                <TouchableOpacity onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={S.dateSheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleChange}
                style={{ height: 200, width: '100%' }}
                textColor={Colors.ink}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android: native dialog, no wrapper needed */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

// ─── Edit Field ───────────────────────────────────────────────────────────────
function EditField({ label, name, values, errors, touched, handleChange, handleBlur, multiline = false, placeholder, hint, readOnly = false, keyboardType = 'default' }) {
  const hasError = touched[name] && errors[name];
  return (
    <View style={S.editFieldGroup}>
      <Text style={S.editLabel}>{label}</Text>
      {multiline ? (
        <TextInput
          value={values[name]}
          onChangeText={handleChange(name)}
          onBlur={handleBlur(name)}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          multiline
          numberOfLines={3}
          editable={!readOnly}
          style={[S.editTextarea, hasError && S.editInputError, readOnly && S.editInputReadOnly]}
        />
      ) : (
        <Input
          type="text"
          value={values[name]}
          onChangeText={handleChange(name)}
          onBlur={handleBlur(name)}
          placeholder={placeholder}
          error={hasError ? errors[name] : undefined}
          editable={!readOnly}
          containerStyle={readOnly ? { opacity: 0.55 } : undefined}
          keyboardType={keyboardType}
        />
      )}
      {hint && !hasError && <Text style={S.editHint}>{hint}</Text>}
    </View>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ visible, profile, onClose }) {
  const dispatch = useDispatch();
  const [serverError,    setServerError]    = useState('');
  const [dob,            setDob]            = useState(profile?.date_of_birth || '');
  const [avatarUri,      setAvatarUri]      = useState(null);   // local preview
  const [avatarUploading, setAvatarUploading] = useState(false);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setAvatarUri(result.assets[0].uri);
  }

  async function handleSave(values, { setSubmitting }) {
    setServerError('');
    const interestsArray = values.interests
      .split(',').map((s) => s.trim()).filter(Boolean);

    try {
      let avatarUrl = profile?.avatar_url ?? null;

      // Upload new avatar if one was picked
      if (avatarUri) {
        setAvatarUploading(true);
        // Always use .jpg extension — upsert overwrites the same deterministic path,
        // so no delete step is needed (avoids needing to parse the old public URL).
        const path = `${profile.school_id}/profiles/${profile.id}.jpg`;
        const uploaded = await uploadImage({
          bucket:   'avatars',
          path,
          uri:      avatarUri,
          mimeType: 'image/jpeg',
          // No previousPath — upsert:true in uploadImage handles overwrite in-place
        });
        setAvatarUploading(false);
        if (!uploaded) { setServerError('Avatar upload failed. Try again.'); setSubmitting(false); return; }
        // Build public URL + bust expo-image disk cache with a timestamp param
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(uploaded);
        avatarUrl = urlData?.publicUrl
          ? `${urlData.publicUrl}?t=${Date.now()}`
          : null;
      }

      await dispatch(updateProfileThunk({
        id: profile.id,
        updates: {
          bio:           values.bio.trim() || null,
          date_of_birth: dob || null,
          facebook_url:  values.facebook_url.trim() || null,
          instagram_url: values.instagram_url.trim() || null,
          interests:     interestsArray.length ? interestsArray : null,
          avatar_url:    avatarUrl,
        },
      })).unwrap();
      setAvatarUri(null);
      onClose();
    } catch (err) {
      setServerError(err || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
      setAvatarUploading(false);
    }
  }

  // Display: local preview > existing avatar_url
  const displayAvatarUri = avatarUri || (profile?.avatar_url?.startsWith('http') ? profile.avatar_url : null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: Colors.white }}>
        {/* Header */}
        <View style={S.modalHeader}>
          <TouchableOpacity onPress={onClose} style={S.modalCloseBtn} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={S.modalTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={S.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar picker */}
            <View style={S.modalAvatarSection}>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={S.modalAvatarPickerWrap}>
                {displayAvatarUri ? (
                  <Image
                    source={{ uri: displayAvatarUri }}
                    style={S.modalAvatarImg}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <CachedAvatar name={profile?.name || ''} avatarUrl={null} size={hp(10)} />
                )}
                <View style={S.modalAvatarCameraBadge}>
                  {avatarUploading
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Ionicons name="camera-outline" size={hp(1.9)} color={Colors.white} />
                  }
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={S.modalAvatarName}>{profile?.name || '—'}</Text>
                <Text style={S.modalAvatarSub}>{profile?.email || '—'}</Text>
                <TouchableOpacity onPress={pickAvatar} hitSlop={8} activeOpacity={0.75}>
                  <Text style={S.modalAvatarChangeText}>Change photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Server error */}
            {!!serverError && (
              <View style={S.serverError}>
                <Text style={S.serverErrorText}>{serverError}</Text>
              </View>
            )}

            <Formik
              initialValues={{
                bio:           profile?.bio           || '',
                facebook_url:  profile?.facebook_url  || '',
                instagram_url: profile?.instagram_url || '',
                interests:     interests.join(', '),
              }}
              validationSchema={EditSchema}
              onSubmit={handleSave}
              enableReinitialize
            >
              {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
                <View style={S.formGap}>

                  {/* Read-only info */}
                  <View style={S.readOnlyCard}>
                    <View style={S.readOnlyRow}>
                      <Text style={S.readOnlyLabel}>Full Name</Text>
                      <Text style={S.readOnlyValue}>{profile?.name || '—'}</Text>
                    </View>
                    <View style={[S.readOnlyRow, { borderBottomWidth: 0 }]}>
                      <Text style={S.readOnlyLabel}>Email</Text>
                      <Text style={S.readOnlyValue}>{profile?.email || '—'}</Text>
                    </View>
                  </View>
                  <Text style={S.readOnlyHint}>Name and email cannot be changed from here.</Text>

                  <EditField label="Bio" name="bio" values={values} errors={errors} touched={touched} handleChange={handleChange} handleBlur={handleBlur} multiline placeholder="Write something about yourself…" hint="Max 300 characters" />

                  <DateField label="Date of Birth" value={dob} onChange={setDob} />

                  <EditField label="Interests" name="interests" values={values} errors={errors} touched={touched} handleChange={handleChange} handleBlur={handleBlur} placeholder="math, football, art" hint="Comma-separated" />

                  <EditField label="Facebook URL" name="facebook_url" values={values} errors={errors} touched={touched} handleChange={handleChange} handleBlur={handleBlur} placeholder="https://facebook.com/…" keyboardType="url" />

                  <EditField label="Instagram URL" name="instagram_url" values={values} errors={errors} touched={touched} handleChange={handleChange} handleBlur={handleBlur} placeholder="https://instagram.com/…" keyboardType="url" />

                  <View style={{ marginTop: hp(0.5), paddingBottom: hp(2) }}>
                    <Button title="Save Changes" onPress={handleSubmit} loading={isSubmitting} size="small" />
                  </View>

                </View>
              )}
            </Formik>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.auth.profile);
  const [editOpen, setEditOpen] = useState(false);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  function confirmLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logoutThunk(profile?.id)) },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={() => setEditOpen(true)} style={S.editBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={16} color={Colors.primary} />
          <Text style={S.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>

        {/* Identity card */}
        <View style={S.identityCard}>
          <CachedAvatar avatarUrl={profile?.avatar_url} name={profile?.name || ''} size={hp(9)} />
          <View style={S.identityMeta}>
            <Text style={S.identityName} numberOfLines={1}>{profile?.name || '—'}</Text>
            <Text style={S.identityEmail} numberOfLines={1}>{profile?.email || '—'}</Text>
            <RoleBadge role={profile?.role} />
          </View>
        </View>

        {/* Stats strip */}
        <View style={S.statsStrip}>
          <View style={S.statItem}>
            <Text style={[S.statValue, { color: Colors.warning }]}>★ {(profile?.grow_coins ?? 0).toLocaleString()}</Text>
            <Text style={S.statLabel}>GrowCoins</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.statItem}>
            <Text style={[S.statValue, { color: profile?.is_active ? Colors.success : Colors.danger }]}>
              {profile?.is_active ? 'Active' : 'Inactive'}
            </Text>
            <Text style={S.statLabel}>Status</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.statItem}>
            <Text style={S.statValue}>
              {profile?.created_at ? new Date(profile.created_at).getFullYear() : '—'}
            </Text>
            <Text style={S.statLabel}>Joined</Text>
          </View>
        </View>

        {/* Bio */}
        {!!profile?.bio && (
          <View style={S.card}>
            <SectionTitle>About</SectionTitle>
            <Text style={S.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Interests */}
        {interests.length > 0 && (
          <View style={S.card}>
            <SectionTitle>Interests</SectionTitle>
            <View style={S.chipsRow}>
              {interests.map((i) => (
                <View key={i} style={S.chip}>
                  <Text style={S.chipText}>{i}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Personal info — no school/branch/class */}
        <View style={S.card}>
          <SectionTitle>Personal Information</SectionTitle>
          <InfoRow label="Full Name"     value={profile?.name} />
          <InfoRow label="Email"         value={profile?.email} />
          <InfoRow label="Role"          value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : null} />
          <InfoRow label="Date of Birth" value={formatDate(profile?.date_of_birth)} last />
        </View>

        {/* Social links — clickable with brand icons */}
        {(profile?.facebook_url || profile?.instagram_url) && (
          <View style={S.card}>
            <SectionTitle>Social Links</SectionTitle>
            <SocialLinkRow
              url={profile?.facebook_url}
              label="Facebook"
              icon="logo-facebook"
              color="#1877F2"
            />
            <SocialLinkRow
              url={profile?.instagram_url}
              label="Instagram"
              icon="logo-instagram"
              color="#E1306C"
              last
            />
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={S.signOutRow} onPress={confirmLogout} activeOpacity={0.7}>
          <View style={S.signOutIcon}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          </View>
          <Text style={S.signOutText}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

      </ScrollView>

      <EditModal visible={editOpen} profile={profile} onClose={() => setEditOpen(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.6),
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: hp(2.4),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(0.7),
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  editBtnText: {
    fontSize: hp(1.5),
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  scroll: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
    gap: hp(1.4),
  },

  // Identity card
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: wp(4.5),
    gap: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  identityMeta: { flex: 1, gap: 5 },
  identityName: {
    fontSize: hp(2.1),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  identityEmail: {
    fontSize: hp(1.45),
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: hp(1.3), fontFamily: Fonts.semiBold },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: hp(1.6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: hp(3.5), backgroundColor: Colors.borderLight },
  statValue: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  statLabel: { fontSize: hp(1.25), fontFamily: Fonts.regular, color: Colors.muted },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: wp(4.5),
    paddingTop: hp(1.6),
    paddingBottom: hp(0.6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: hp(1.55),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.2,
    marginBottom: hp(0.8),
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: hp(1.2),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: wp(4),
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: hp(1.45), fontFamily: Fonts.regular, color: Colors.muted, flexShrink: 0 },
  infoValue: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.ink, textAlign: 'right', flex: 1 },

  // Bio
  bioText: {
    fontSize: hp(1.6),
    fontFamily: Fonts.regular,
    color: Colors.soft,
    lineHeight: hp(2.4),
    paddingBottom: hp(1.2),
  },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: hp(1.2) },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: hp(1.4), fontFamily: Fonts.medium, color: Colors.primaryDark },

  // Social links
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: hp(1.3),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  socialIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: {
    fontSize: hp(1.6),
    fontFamily: Fonts.medium,
  },

  // Sign out
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(1.8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: hp(1.7), fontFamily: Fonts.medium, color: Colors.danger },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.6),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.hover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: hp(2),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  modalBody: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  modalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
    padding: wp(4),
    backgroundColor: Colors.canvas,
    borderRadius: 14,
  },
  // Avatar section in edit modal
  modalAvatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
    marginBottom: hp(2),
    padding: wp(4),
    backgroundColor: Colors.canvas,
    borderRadius: 14,
  },
  modalAvatarPickerWrap: {
    width: hp(10), height: hp(10), borderRadius: hp(5),
    overflow: 'hidden', flexShrink: 0,
    backgroundColor: Colors.borderLight,
  },
  modalAvatarImg: {
    width: '100%', height: '100%',
  },
  modalAvatarCameraBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: hp(3.2), height: hp(3.2), borderRadius: hp(1.6),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  modalAvatarChangeText: {
    fontSize: hp(1.4), fontFamily: Fonts.semiBold, color: Colors.primary, marginTop: hp(0.6),
  },
  modalAvatarName: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  modalAvatarSub: { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2 },

  serverError: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(4),
    marginBottom: hp(1.6),
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  serverErrorText: { fontSize: hp(1.45), fontFamily: Fonts.medium, color: Colors.dangerText, textAlign: 'center' },

  formGap: { gap: hp(1.8) },

  // Read-only card in form
  readOnlyCard: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    backgroundColor: Colors.canvas,
    overflow: 'hidden',
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.3),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: wp(4),
  },
  readOnlyLabel: { fontSize: hp(1.45), fontFamily: Fonts.regular, color: Colors.muted },
  readOnlyValue: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.ink, flex: 1, textAlign: 'right' },
  readOnlyHint: { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted, marginTop: -hp(1.2), marginLeft: 2 },

  // Edit fields
  editFieldGroup: { gap: hp(0.5) },
  editLabel: { fontSize: hp(1.45), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2 },
  editTextarea: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: hp(1.7),
    fontFamily: Fonts.regular,
    color: Colors.ink,
    backgroundColor: Colors.white,
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  editInputError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  editInputReadOnly: { backgroundColor: Colors.canvas, opacity: 0.6 },
  editHint: { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted, marginLeft: 2 },

  // Date picker button
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: hp(5.8),
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
  },
  datePickerText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, flex: 1 },

  // iOS date modal
  dateOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dateSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: hp(4),
  },
  dateSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dateSheetTitle: { fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.ink },
  dateSheetDone: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.primary },
});
