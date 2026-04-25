/**
 * chatMemberManager.jsx
 *
 * Manage members of a class group chat.
 * Route params:
 *   chatId     — uuid (required)
 *   classId    — uuid
 *   className  — display label
 *   branchId   — uuid
 *   schoolId   — uuid
 *
 * Tabs:
 *   Members    — current chat members with can_send_message toggle + remove
 *   Owner      — school owners
 *   Principal  — branch principal
 *   Coordinator— branch coordinator
 *   Teacher    — branch teachers
 *   Students   — class picker → students of that class
 *
 * Add member  : calls add_chat_member RPC (students default can_send_message=false)
 * Remove      : deletes from chat_members
 * Toggle send : calls set_chat_member_send_permission RPC
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { supabase } from '../../../lib/supabase';
import Avatar from '../../../components/Avatar';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { uploadImage, deleteStorageFile } from '../../../helpers/storageUpload';
import { getSignedUrl } from '../../../helpers/imageCache';

const TABS = ['Settings', 'Members', 'Owner', 'Principal', 'Coordinator', 'Teacher', 'Students'];

// Module-level cache for tab data (survives tab switches without re-fetching)
// Key: `${tab}|${branchId}|${schoolId}`
const tabCache = {};
const CACHE_TTL = 30_000;
function isCacheFresh(key) { const e = tabCache[key]; return !!(e && Date.now() - e.ts < CACHE_TTL); }
function readCache(key) { return tabCache[key]?.data; }
function writeCache(key, data) { tabCache[key] = { data, ts: Date.now() }; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionEmpty({ label }) {
  return (
    <View style={S.emptyWrap}>
      <Ionicons name="people-outline" size={hp(4.5)} color={Colors.muted} />
      <Text style={S.emptyText}>{label}</Text>
    </View>
  );
}

function RowSkeleton() {
  return (
    <View style={S.row}>
      <View style={[S.skeletonAvatar]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
        <View style={{ height: 10, width: '75%', borderRadius: 6, backgroundColor: Colors.borderLight }} />
      </View>
    </View>
  );
}

// ─── Member row (Members tab) ─────────────────────────────────────────────────
function MemberRow({ item, chatId, onRemoved, onToggled }) {
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleToggle(val) {
    setToggling(true);
    const { error } = await supabase.rpc('set_chat_member_send_permission', {
      p_chat_id:    chatId,
      p_profile_id: item.profile_id,
      p_can_send:   val,
    });
    setToggling(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onToggled(item.profile_id, val);
  }

  function confirmRemove() {
    Alert.alert(
      'Remove Member',
      `Remove ${item.profiles?.name || 'this member'} from the group chat?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: handleRemove },
      ],
    );
  }

  async function handleRemove() {
    setRemoving(true);
    const { error } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId)
      .eq('profile_id', item.profile_id);
    setRemoving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onRemoved(item.profile_id);
  }

  const name    = item.profiles?.name    || '—';
  const email   = item.profiles?.email   || '';
  const avatarUrl = item.profiles?.avatar_url || null;
  const role    = item.profiles?.role    || '';

  return (
    <View style={S.row}>
      <Avatar url={avatarUrl} name={name} size={hp(5.5)} />
      <View style={S.rowBody}>
        <Text style={S.rowName} numberOfLines={1}>{name}</Text>
        <Text style={S.rowSub} numberOfLines={1}>{email}</Text>
        <View style={S.roleBadge}>
          <Text style={S.roleBadgeText}>{role}</Text>
        </View>
      </View>
      <View style={S.memberActions}>
        <View style={S.sendToggleWrap}>
          <Text style={S.sendLabel}>{item.can_send_message ? 'Can send' : 'View only'}</Text>
          {toggling
            ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 4 }} />
            : <Switch
                value={item.can_send_message}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.borderLight, true: Colors.success + '60' }}
                thumbColor={item.can_send_message ? Colors.success : Colors.muted}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
          }
        </View>
        <TouchableOpacity onPress={confirmRemove} disabled={removing} style={S.removeBtn} hitSlop={8} activeOpacity={0.7}>
          {removing
            ? <ActivityIndicator size="small" color={Colors.danger} />
            : <Ionicons name="trash-outline" size={hp(2)} color={Colors.danger} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add row (all other tabs) ─────────────────────────────────────────────────
function AddRow({ item, memberIds, chatId, schoolId, isStudent, onAdded }) {
  const [adding, setAdding] = useState(false);
  const isMember = memberIds.has(item.id);

  async function handleAdd() {
    if (isMember) return;
    setAdding(true);
    const { error } = await supabase.rpc('add_chat_member', {
      p_chat_id:          chatId,
      p_profile_id:       item.id,
      p_school_id:        schoolId,
      p_can_send_message: !isStudent,   // students default false, others true
    });
    setAdding(false);
    if (error) { Alert.alert('Error', error.message); return; }
    onAdded(item.id);
  }

  return (
    <View style={S.row}>
      <Avatar url={item.avatar_url} name={item.name || ''} size={hp(5.5)} />
      <View style={S.rowBody}>
        <Text style={S.rowName} numberOfLines={1}>{item.name || '—'}</Text>
        <Text style={S.rowSub} numberOfLines={1}>{item.email || ''}</Text>
      </View>
      {isMember ? (
        <View style={S.alreadyBadge}>
          <Ionicons name="checkmark-circle" size={hp(2.2)} color={Colors.success} />
          <Text style={S.alreadyText}>Added</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={handleAdd} disabled={adding} style={S.addBtn} hitSlop={8} activeOpacity={0.75}>
          {adding
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="add" size={hp(2.2)} color={Colors.white} />
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Chat Settings Tab ────────────────────────────────────────────────────────
function ChatSettingsTab({ chatId, schoolId, initialName, initialImageUrl, onSaved }) {
  const [name,        setName]        = useState(initialName || '');
  const [imageUri,    setImageUri]    = useState(null);   // local preview URI
  const [imageUrl,    setImageUrl]    = useState(initialImageUrl || null); // stored path
  const [resolvedUrl, setResolvedUrl] = useState(null);   // signed URL for display
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Resolve signed URL for existing image
  useEffect(() => {
    if (!imageUrl) { setResolvedUrl(null); return; }
    let cancelled = false;
    getSignedUrl('chat-images', imageUrl).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => { cancelled = true; };
  }, [imageUrl]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return;
    setImageUri(result.assets[0].uri);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Group name cannot be empty.'); return; }
    setSaving(true);
    setError('');

    try {
      let newImagePath = imageUrl; // keep existing if no new pick

      if (imageUri) {
        // Upload new image — deletes old one first (handled inside uploadImage)
        const ext  = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${schoolId}/chat-covers/${chatId}.${ext}`;
        const uploaded = await uploadImage({
          bucket:       'chat-images',
          path,
          uri:          imageUri,
          mimeType:     `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          previousPath: imageUrl && imageUrl !== path ? imageUrl : undefined,
        });
        if (!uploaded) { setError('Image upload failed. Try again.'); setSaving(false); return; }
        newImagePath = uploaded;
      }

      const { error: dbErr } = await supabase
        .from('chats')
        .update({ name: trimmed, image_url: newImagePath ?? null })
        .eq('id', chatId);

      if (dbErr) { setError(dbErr.message); setSaving(false); return; }

      setImageUri(null);
      setImageUrl(newImagePath);
      onSaved({ name: trimmed, image_url: newImagePath });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveImage() {
    Alert.alert('Remove Image', 'Remove the group cover image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          if (imageUrl) await deleteStorageFile('chat-images', imageUrl);
          await supabase.from('chats').update({ image_url: null }).eq('id', chatId);
          setImageUrl(null);
          setImageUri(null);
          setResolvedUrl(null);
          onSaved({ image_url: null });
        },
      },
    ]);
  }

  const displayUri = imageUri || resolvedUrl;

  return (
    <ScrollView
      contentContainerStyle={S.settingsBody}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Cover image picker */}
      <View style={S.settingsImageSection}>
        <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={S.settingsImageWrap}>
          {displayUri ? (
            <Image
              source={{ uri: displayUri }}
              style={S.settingsImage}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={S.settingsImagePlaceholder}>
              <Ionicons name="image-outline" size={hp(4)} color={Colors.muted} />
              <Text style={S.settingsImagePlaceholderText}>No image</Text>
            </View>
          )}
          {/* Camera badge */}
          <View style={S.settingsCameraBadge}>
            <Ionicons name="camera-outline" size={hp(2)} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={S.settingsImageHint}>Tap to change group image</Text>
        {(imageUrl || imageUri) && (
          <TouchableOpacity onPress={handleRemoveImage} style={S.settingsRemoveImageBtn} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={hp(1.8)} color={Colors.danger} />
            <Text style={S.settingsRemoveImageText}>Remove image</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Group name */}
      <View style={S.settingsFieldGroup}>
        <Text style={S.settingsLabel}>Group Name</Text>
        <TextInput
          style={S.settingsInput}
          value={name}
          onChangeText={(t) => { setName(t); setError(''); }}
          placeholder="Enter group name…"
          placeholderTextColor={Colors.muted}
          maxLength={80}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {!!error && (
        <View style={S.settingsError}>
          <Text style={S.settingsErrorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSave}
        style={[S.settingsSaveBtn, saving && { opacity: 0.6 }]}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator size="small" color={Colors.white} />
          : <Text style={S.settingsSaveBtnText}>Save Changes</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatMemberManagerScreen() {
  const router = useRouter();
  const { chatId, classId, className, branchId, schoolId } = useLocalSearchParams();

  const [activeTab,   setActiveTab]   = useState('Settings');
  const [chatName,    setChatName]    = useState(className || '');
  const [chatImgUrl,  setChatImgUrl]  = useState(null);   // storage path from chats.image_url
  const [members,     setMembers]     = useState([]);      // chat_members rows with profiles join
  const [memberIds,   setMemberIds]   = useState(new Set());
  const [tabData,     setTabData]     = useState([]);      // data for current non-Members tab
  const [loading,     setLoading]     = useState(true);
  const [tabLoading,  setTabLoading]  = useState(false);
  const [search,      setSearch]      = useState('');

  // Students sub-tab: null = show class list, uuid = show students of that class
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes,       setClasses]       = useState([]);
  const [classLoading,  setClassLoading]  = useState(false);

  // ── Load current members ────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_members')
      .select('profile_id, can_send_message, joined_at, profiles(id, name, email, avatar_url, role)')
      .eq('chat_id', chatId)
      .order('joined_at', { ascending: true });

    if (!error && data) {
      setMembers(data);
      setMemberIds(new Set(data.map((m) => m.profile_id)));
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Load chat meta (name + image_url) ──────────────────────────────────────
  useEffect(() => {
    supabase
      .from('chats')
      .select('name, image_url')
      .eq('id', chatId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name)      setChatName(data.name);
        if (data?.image_url) setChatImgUrl(data.image_url);
      });
  }, [chatId]);

  // ── Load tab data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'Members') return;
    if (activeTab === 'Students') { loadClasses(); return; }

    const roleMap = { Owner: 'owner', Principal: 'principal', Coordinator: 'coordinator' };
    const cacheKey = `${activeTab}|${branchId}|${schoolId}`;

    // Serve from cache if fresh
    if (isCacheFresh(cacheKey)) {
      setTabData(readCache(cacheKey));
      return;
    }

    setTabLoading(true);
    setSearch('');
    // Don't clear tabData here — keep previous content visible to avoid jerk

    let q;
    if (activeTab === 'Teacher') {
      // teachers_with_class already filters role='teacher'
      q = supabase
        .from('teachers_with_class')
        .select('id, name, email, avatar_url, class_name')
        .eq('branch_id', branchId)
        .order('name', { ascending: true });
    } else if (activeTab === 'Owner') {
      q = supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('role', 'owner')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });
    } else {
      q = supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('role', roleMap[activeTab])
        .eq('branch_id', branchId)
        .order('name', { ascending: true });
    }

    q.then(({ data, error }) => {
      if (!error && data) { writeCache(cacheKey, data); setTabData(data); }
      else setTabData([]);
      setTabLoading(false);
    });
  }, [activeTab, branchId, schoolId]);

  // ── Load classes (Students tab) ─────────────────────────────────────────────
  async function loadClasses() {
    const cacheKey = `Classes|${branchId}`;
    if (isCacheFresh(cacheKey)) { setClasses(readCache(cacheKey)); return; }
    setClassLoading(true);
    setClasses([]);
    setSelectedClass(null);
    const { data } = await supabase
      .from('classes_with_teacher')
      .select('id, class_name, teacher_name')
      .eq('branch_id', branchId)
      .order('class_name', { ascending: true });
    if (data) { writeCache(cacheKey, data); setClasses(data); }
    setClassLoading(false);
  }

  // ── Load students for selected class ────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'Students' || !selectedClass) return;
    setTabLoading(true);
    setTabData([]);
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('role', 'student')
      .eq('class_id', selectedClass)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setTabData(data);
        setTabLoading(false);
      });
  }, [selectedClass, activeTab]);

  // ── Member callbacks ────────────────────────────────────────────────────────
  function onMemberRemoved(profileId) {
    setMembers((prev) => prev.filter((m) => m.profile_id !== profileId));
    setMemberIds((prev) => { const s = new Set(prev); s.delete(profileId); return s; });
  }

  function onMemberToggled(profileId, val) {
    setMembers((prev) => prev.map((m) => m.profile_id === profileId ? { ...m, can_send_message: val } : m));
  }

  function onMemberAdded(profileId) {
    setMemberIds((prev) => new Set([...prev, profileId]));
    // Re-fetch members list to get full profile data
    loadMembers();
  }

  // ── Filtered tab data ───────────────────────────────────────────────────────
  const filtered = search.trim()
    ? tabData.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
      )
    : tabData;

  const isStudent = activeTab === 'Students';

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.headerBack} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle} numberOfLines={1}>Group Chat</Text>
          <Text style={S.headerSub} numberOfLines={1}>{chatName || className}</Text>
        </View>
        <View style={{ width: hp(4.4) }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll} contentContainerStyle={S.tabsContent} bounces={false}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (tab !== activeTab) {
                const ck = `${tab}|${branchId}|${schoolId}`;
                if (!isCacheFresh(ck)) setTabData([]);
              }
              setActiveTab(tab); setSearch(''); setSelectedClass(null);
            }}
            style={[S.tab, activeTab === tab && S.tabActive]}
            activeOpacity={0.75}
          >
            <Text style={[S.tabText, activeTab === tab && S.tabTextActive]}>{tab}</Text>
            {tab === 'Members' && members.length > 0 && (
              <View style={[S.tabBadge, activeTab === tab && S.tabBadgeActive]}>
                <Text style={[S.tabBadgeText, activeTab === tab && S.tabBadgeTextActive]}>{members.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {activeTab === 'Settings' ? (
        <ChatSettingsTab
          chatId={chatId}
          schoolId={schoolId}
          initialName={chatName}
          initialImageUrl={chatImgUrl}
          onSaved={({ name, image_url }) => {
            if (name      !== undefined) setChatName(name);
            if (image_url !== undefined) setChatImgUrl(image_url);
          }}
        />
      ) : activeTab === 'Members' ? (
        loading ? (
          <View style={S.listPad}>
            {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
          </View>
        ) : members.length === 0 ? (
          <SectionEmpty label="No members in this chat yet." />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.profile_id}
            renderItem={({ item }) => (
              <MemberRow
                item={item}
                chatId={chatId}
                onRemoved={onMemberRemoved}
                onToggled={onMemberToggled}
              />
            )}
            contentContainerStyle={S.listPad}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : activeTab === 'Students' ? (
        // Students: two-level — class list → student list
        selectedClass ? (
          <>
            {/* Back to class list */}
            <TouchableOpacity onPress={() => { setSelectedClass(null); setSearch(''); }} style={S.backToClasses} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={hp(2)} color={Colors.primary} />
              <Text style={S.backToClassesText}>All Classes</Text>
            </TouchableOpacity>
            <View style={S.searchWrap}>
              <Ionicons name="search-outline" size={hp(2)} color={Colors.muted} />
              <TextInput
                style={S.searchInput}
                placeholder="Search students…"
                placeholderTextColor={Colors.muted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={hp(2.2)} color={Colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            {tabLoading ? (
              <View style={S.listPad}>
                {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : filtered.length === 0 ? (
              <SectionEmpty label="No students in this class." />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <AddRow item={item} memberIds={memberIds} chatId={chatId} schoolId={schoolId} isStudent onAdded={onMemberAdded} />
                )}
                contentContainerStyle={S.listPad}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </>
        ) : (
          // Class picker
          classLoading ? (
            <View style={S.listPad}>
              {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
            </View>
          ) : classes.length === 0 ? (
            <SectionEmpty label="No classes in this branch." />
          ) : (
            <FlatList
              data={classes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={S.classRow} onPress={() => setSelectedClass(item.id)} activeOpacity={0.75}>
                  <View style={S.classIconWrap}>
                    <Ionicons name="library-outline" size={hp(2.4)} color={Colors.primary} />
                  </View>
                  <View style={S.rowBody}>
                    <Text style={S.rowName} numberOfLines={1}>{item.class_name}</Text>
                    <Text style={S.rowSub} numberOfLines={1}>
                      {item.teacher_name ? `Incharge: ${item.teacher_name}` : 'No incharge teacher'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={hp(2.2)} color={Colors.muted} />
                </TouchableOpacity>
              )}
              contentContainerStyle={S.listPad}
              showsVerticalScrollIndicator={false}
            />
          )
        )
      ) : (
        // Owner / Principal / Coordinator / Teacher tabs
        <>
          <View style={S.searchWrap}>
            <Ionicons name="search-outline" size={hp(2)} color={Colors.muted} />
            <TextInput
              style={S.searchInput}
              placeholder={`Search ${activeTab.toLowerCase()}s…`}
              placeholderTextColor={Colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={hp(2.2)} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          {tabLoading ? (
            <View style={S.listPad}>
              {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
            </View>
          ) : filtered.length === 0 ? (
            <SectionEmpty label={`No ${activeTab.toLowerCase()}s found.`} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <AddRow item={item} memberIds={memberIds} chatId={chatId} schoolId={schoolId} isStudent={false} onAdded={onMemberAdded} />
              )}
              contentContainerStyle={S.listPad}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </>
      )}
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1.6),
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerBack: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2),
    backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: wp(2) },
  headerTitle:  { fontSize: hp(2.1), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:    { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },

  // Tabs
  tabsScroll:   { flexGrow: 0, flexShrink: 0, maxHeight: hp(6.5), borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabsContent:  { paddingHorizontal: wp(4), gap: 6, paddingVertical: hp(1.2), alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(3), height: hp(3.4),
    borderRadius: 20, backgroundColor: Colors.canvas,
  },
  tabActive:         { backgroundColor: Colors.primary },
  tabText:           { fontSize: hp(1.4), fontFamily: Fonts.medium, color: Colors.soft },
  tabTextActive:     { color: Colors.white, fontFamily: Fonts.semiBold },
  tabBadge:          { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeActive:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText:      { fontSize: hp(1.15), fontFamily: Fonts.semiBold, color: Colors.soft },
  tabBadgeTextActive:{ color: Colors.white },

  listPad: { paddingHorizontal: wp(4), paddingVertical: hp(1), gap: hp(0.5) },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    backgroundColor: Colors.white, borderRadius: 14, padding: wp(3.5),
    marginBottom: hp(0.8),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  rowBody:  { flex: 1, gap: 2, minWidth: 0 },
  rowName:  { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.2 },
  rowSub:   { fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: 3,
    backgroundColor: Colors.primaryLight, borderRadius: 6,
    paddingHorizontal: wp(1.5), paddingVertical: 2,
  },
  roleBadgeText: { fontSize: hp(1.15), fontFamily: Fonts.semiBold, color: Colors.primary },

  // Member actions
  memberActions:  { alignItems: 'flex-end', gap: 6 },
  sendToggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sendLabel:      { fontSize: hp(1.2), fontFamily: Fonts.medium, color: Colors.muted },
  removeBtn: {
    width: hp(3.5), height: hp(3.5), borderRadius: 8,
    backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center',
  },

  // Add button
  addBtn: {
    width: hp(3.8), height: hp(3.8), borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  alreadyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alreadyText:  { fontSize: hp(1.3), fontFamily: Fonts.medium, color: Colors.success },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: wp(4), marginTop: hp(1.5), marginBottom: hp(0.5),
    paddingHorizontal: wp(3.5), height: hp(5.6),
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, gap: 8,
  },
  searchInput: {
    flex: 1, fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, paddingVertical: 0,
  },

  // Class picker
  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    backgroundColor: Colors.white, borderRadius: 14, padding: wp(3.5),
    marginBottom: hp(0.8),
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  classIconWrap: {
    width: hp(5.5), height: hp(5.5), borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  backToClasses: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: wp(4), paddingTop: hp(1.2), paddingBottom: hp(0.5),
  },
  backToClassesText: { fontSize: hp(1.5), fontFamily: Fonts.semiBold, color: Colors.primary },

  // Empty
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: hp(8), gap: hp(1.2),
  },
  emptyText: { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.muted },

  skeletonAvatar: {
    width: hp(5.5), height: hp(5.5), borderRadius: hp(2.75),
    backgroundColor: Colors.borderLight, flexShrink: 0,
  },

  // ── Chat Settings tab ──────────────────────────────────────────────────────
  settingsBody: {
    paddingHorizontal: wp(5), paddingTop: hp(2.5), paddingBottom: hp(5), gap: hp(2.2),
  },
  settingsImageSection: {
    alignItems: 'center', gap: hp(1),
  },
  settingsImageWrap: {
    width: hp(14), height: hp(14), borderRadius: hp(2.5),
    overflow: 'hidden', backgroundColor: Colors.canvas,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  settingsImage: {
    width: '100%', height: '100%',
  },
  settingsImagePlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(0.6),
  },
  settingsImagePlaceholderText: {
    fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted,
  },
  settingsCameraBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: hp(3.6), height: hp(3.6), borderRadius: hp(1.8),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  settingsImageHint: {
    fontSize: hp(1.35), fontFamily: Fonts.regular, color: Colors.muted,
  },
  settingsRemoveImageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: wp(3.5), paddingVertical: hp(0.7),
    borderRadius: 20, borderWidth: 1, borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerLight,
  },
  settingsRemoveImageText: {
    fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.danger,
  },
  settingsFieldGroup: { gap: hp(0.6) },
  settingsLabel: {
    fontSize: hp(1.45), fontFamily: Fonts.medium, color: Colors.soft, marginLeft: 2,
  },
  settingsInput: {
    height: hp(6), borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: wp(4), fontSize: hp(1.75), fontFamily: Fonts.regular,
    color: Colors.ink, backgroundColor: Colors.white,
  },
  settingsError: {
    backgroundColor: Colors.dangerLight, borderRadius: 10,
    paddingVertical: hp(1), paddingHorizontal: wp(4),
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  settingsErrorText: {
    fontSize: hp(1.4), fontFamily: Fonts.medium, color: Colors.dangerText, textAlign: 'center',
  },
  settingsSaveBtn: {
    height: hp(6), borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: hp(0.5),
  },
  settingsSaveBtnText: {
    fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.white,
  },
});
