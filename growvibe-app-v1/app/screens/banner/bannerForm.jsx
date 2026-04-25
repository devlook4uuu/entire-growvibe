/**
 * bannerForm.jsx — Admin banner create / edit form
 *
 * Supports:
 * - Image pick + upload to Supabase Storage "banners" bucket
 * - Banner type selector (image_only / image_text / image_text_cta)
 * - Overlay colour + opacity slider
 * - Text content (title, body), text colour, vertical + horizontal alignment
 * - CTA: external URL or info text sheet
 * - Scope: global / school-specific / branch-specific
 * - Schedule: start_date + end_date (date pickers)
 * - Sort order + is_active toggle
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';
import { getBannerImageUrl } from '../../../hooks/useBanners';
import { invalidateBannerListCache } from '../../../hooks/useBannerList';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';

// ─── Constants ────────────────────────────────────────────────────────────────
const BANNER_TYPES = [
  { value: 'image_only',     label: 'Image only' },
  { value: 'image_text',     label: 'Image + Text' },
  { value: 'image_text_cta', label: 'Image + Text + CTA' },
];

const CTA_TYPES = [
  { value: 'url',  label: 'Open URL' },
  { value: 'info', label: 'Info sheet' },
];

const SCOPE_TYPES = [
  { value: 'global', label: 'Global' },
  { value: 'school', label: 'School' },
  { value: 'branch', label: 'Branch' },
];

const ALIGN_V_OPTIONS = [
  { value: 'top',    icon: 'arrow-up-outline' },
  { value: 'center', icon: 'remove-outline' },
  { value: 'bottom', icon: 'arrow-down-outline' },
];

const ALIGN_H_OPTIONS = [
  { value: 'left',   icon: 'arrow-back-outline' },
  { value: 'center', icon: 'remove-outline' },
  { value: 'right',  icon: 'arrow-forward-outline' },
];

const OVERLAY_COLOURS = ['#000000', '#1a1a2e', '#2d1b69', '#0a3d62', '#1a3a1a', '#4a0000'];

// ─── Small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

function FieldLabel({ children }) {
  return <Text style={S.fieldLabel}>{children}</Text>;
}

function SegmentControl({ options, value, onChange, labelKey = 'label', valueKey = 'value' }) {
  return (
    <View style={S.segment}>
      {options.map((opt) => {
        const val = opt[valueKey];
        const active = value === val;
        return (
          <TouchableOpacity
            key={val}
            style={[S.segBtn, active && S.segBtnActive]}
            onPress={() => onChange(val)}
            activeOpacity={0.7}
          >
            {opt.icon ? (
              <Ionicons name={opt.icon} size={hp(1.9)} color={active ? Colors.white : Colors.soft} />
            ) : (
              <Text style={[S.segText, active && S.segTextActive]}>{opt[labelKey]}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ColourDot({ colour, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[S.colourDot, { backgroundColor: colour }, selected && S.colourDotSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    />
  );
}

// ─── Banner Form ──────────────────────────────────────────────────────────────
export default function BannerFormScreen() {
  const router        = useRouter();
  const { bannerId }  = useLocalSearchParams();
  const isEdit        = !!bannerId;

  // ── Form state ────────────────────────────────────────────────────────────
  const [bannerType,  setBannerType]  = useState('image_only');
  const [title,       setTitle]       = useState('');
  const [bodyText,    setBodyText]    = useState('');
  const [ctaLabel,    setCtaLabel]    = useState('');
  const [ctaType,     setCtaType]     = useState('url');
  const [ctaUrl,      setCtaUrl]      = useState('');
  const [ctaInfo,     setCtaInfo]     = useState('');
  const [textColor,   setTextColor]   = useState('#ffffff');
  const [textAlignV,  setTextAlignV]  = useState('bottom');
  const [textAlignH,  setTextAlignH]  = useState('left');
  const [overlayColor,   setOverlayColor]   = useState('#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(0.35);
  const [scopeType,   setScopeType]   = useState('global');
  const [schoolId,    setSchoolId]    = useState('');
  const [branchId,    setBranchId]    = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [sortOrder,   setSortOrder]   = useState('0');
  const [isActive,    setIsActive]    = useState(true);

  // Scope lists
  const [schools,  setSchools]  = useState([]);
  const [branches, setBranches] = useState([]);

  // Image
  const [imageUri,    setImageUri]    = useState(null);   // local uri to preview
  const [imagePath,   setImagePath]   = useState(null);   // stored path in DB
  const [uploading,   setUploading]   = useState(false);

  // Load / save state
  const [fetching,   setFetching]   = useState(isEdit);
  const [fetchError, setFetchError] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // ── Load existing banner (edit mode) ──────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('id', bannerId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setFetchError(error?.message || 'Banner not found.');
        setFetching(false);
        return;
      }

      setBannerType(data.banner_type || 'image_only');
      setTitle(data.title || '');
      setBodyText(data.body_text || '');
      setCtaLabel(data.cta_label || '');
      setCtaType(data.cta_type || 'url');
      setCtaUrl(data.cta_url || '');
      setCtaInfo(data.cta_info || '');
      setTextColor(data.text_color || '#ffffff');
      setTextAlignV(data.text_align_v || 'bottom');
      setTextAlignH(data.text_align_h || 'left');
      setOverlayColor(data.overlay_color || '#000000');
      setOverlayOpacity(parseFloat(data.overlay_opacity) || 0);
      setIsActive(data.is_active ?? true);
      setSortOrder(String(data.sort_order ?? 0));
      setStartDate(data.start_date || '');
      setEndDate(data.end_date || '');
      setImagePath(data.bg_image_path || null);

      if (data.school_id && data.branch_id) {
        setScopeType('branch');
        setSchoolId(data.school_id);
        setBranchId(data.branch_id);
        await loadBranches(data.school_id);
      } else if (data.school_id) {
        setScopeType('school');
        setSchoolId(data.school_id);
      } else {
        setScopeType('global');
      }

      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [bannerId, isEdit]);

  // ── Scope helpers ─────────────────────────────────────────────────────────
  async function handleScopeChange(v) {
    setScopeType(v);
    setSchoolId('');
    setBranchId('');
    setBranches([]);
    if (v !== 'global' && schools.length === 0) {
      const { data } = await supabase
        .from('schools')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setSchools(data || []);
    }
  }

  async function loadBranches(sId) {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('school_id', sId)
      .eq('is_active', true)
      .order('name');
    setBranches(data || []);
  }

  async function handleSchoolSelect(id) {
    setSchoolId(id);
    setBranchId('');
    setBranches([]);
    if (scopeType === 'branch') {
      await loadBranches(id);
    }
  }

  // ── Image picker + upload ─────────────────────────────────────────────────
  async function pickAndUploadImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return;

    const asset    = result.assets[0];
    const ext      = asset.uri.split('.').pop() || 'jpg';
    const fileName = `banner_${Date.now()}.${ext}`;

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob     = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, blob, { contentType: asset.mimeType || 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      // Delete old image from storage when replacing
      if (imagePath && !imagePath.startsWith('http')) {
        supabase.storage.from('banners').remove([imagePath]);
      }

      setImageUri(asset.uri);
      setImagePath(fileName);
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload image.');
    } finally {
      if (mounted.current) setUploading(false);
    }
  }

  function removeImage() {
    if (imagePath && !imagePath.startsWith('http')) {
      supabase.storage.from('banners').remove([imagePath]);
    }
    setImageUri(null);
    setImagePath(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveError('');

    if (!imagePath) {
      setSaveError('Please upload a banner image.');
      return;
    }
    if ((bannerType === 'image_text' || bannerType === 'image_text_cta') && !title.trim()) {
      setSaveError('Please enter a title.');
      return;
    }
    if (bannerType === 'image_text_cta' && !ctaLabel.trim()) {
      setSaveError('Please enter a CTA label.');
      return;
    }
    if (scopeType === 'school' && !schoolId) {
      setSaveError('Please select a school.');
      return;
    }
    if (scopeType === 'branch' && (!schoolId || !branchId)) {
      setSaveError('Please select a school and branch.');
      return;
    }
    if (!startDate.trim()) {
      setSaveError('Please enter a start date (YYYY-MM-DD).');
      return;
    }

    const payload = {
      banner_type:     bannerType,
      title:           bannerType !== 'image_only' ? title.trim() || null : null,
      body_text:       bannerType !== 'image_only' ? bodyText.trim() || null : null,
      cta_label:       bannerType === 'image_text_cta' ? ctaLabel.trim() || null : null,
      cta_type:        bannerType === 'image_text_cta' ? ctaType : null,
      cta_url:         bannerType === 'image_text_cta' && ctaType === 'url' ? ctaUrl.trim() || null : null,
      cta_info:        bannerType === 'image_text_cta' && ctaType === 'info' ? ctaInfo.trim() || null : null,
      text_color:      bannerType !== 'image_only' ? textColor : null,
      text_align_v:    bannerType !== 'image_only' ? textAlignV : 'bottom',
      text_align_h:    bannerType !== 'image_only' ? textAlignH : 'left',
      overlay_color:   overlayColor,
      overlay_opacity: overlayOpacity,
      bg_image_path:   imagePath,
      school_id:       scopeType !== 'global' ? schoolId || null : null,
      branch_id:       scopeType === 'branch'  ? branchId || null : null,
      start_date:      startDate.trim(),
      end_date:        endDate.trim() || null,
      sort_order:      parseInt(sortOrder, 10) || 0,
      is_active:       isActive,
    };

    setSaving(true);
    try {
      let error;
      if (isEdit) {
        ({ error } = await supabase.from('banners').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', bannerId));
      } else {
        ({ error } = await supabase.from('banners').insert(payload));
      }
      if (error) throw error;
      invalidateBannerListCache();
      router.back();
    } catch (err) {
      setSaveError(err.message || 'Failed to save banner.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    Alert.alert(
      'Delete banner',
      'This will deactivate and delete this banner. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (imagePath && !imagePath.startsWith('http')) {
                await supabase.storage.from('banners').remove([imagePath]);
              }
              const { error } = await supabase.from('banners').delete().eq('id', bannerId);
              if (error) throw error;
              invalidateBannerListCache();
              router.back();
            } catch (err) {
              if (mounted.current) {
                setSaving(false);
                setSaveError(err.message || 'Failed to delete.');
              }
            }
          },
        },
      ]
    );
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (fetching) {
    return (
      <ScreenWrapper>
        <View style={S.centerFill}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (fetchError) {
    return (
      <ScreenWrapper>
        <View style={S.centerFill}>
          <Text style={S.errorText}>{fetchError}</Text>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={S.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Preview image URL ─────────────────────────────────────────────────────
  const previewUri = imageUri || (imagePath ? getBannerImageUrl(imagePath) : null);
  const showText   = bannerType === 'image_text' || bannerType === 'image_text_cta';
  const showCta    = bannerType === 'image_text_cta';

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.headerBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={hp(2.8)} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>{isEdit ? 'Edit Banner' : 'New Banner'}</Text>
          {isEdit && (
            <TouchableOpacity onPress={handleDelete} style={S.headerAction} hitSlop={8} disabled={saving}>
              <Ionicons name="trash-outline" size={hp(2.4)} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Image section ── */}
          <SectionLabel>Banner Image</SectionLabel>
          <TouchableOpacity
            style={S.imagePicker}
            onPress={pickAndUploadImage}
            activeOpacity={0.8}
            disabled={uploading}
          >
            {previewUri ? (
              <>
                <Image source={{ uri: previewUri }} style={S.imagePreview} contentFit="cover" />
                {/* Bottom strip: shows "Change" action */}
                <View style={S.imageStrip}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={hp(1.9)} color={Colors.white} />
                      <Text style={S.imageEditText}>Tap to change image</Text>
                    </>
                  )}
                </View>
                {/* Remove button top-right */}
                <TouchableOpacity style={S.imageRemoveBtn} onPress={removeImage} hitSlop={10}>
                  <Ionicons name="close-circle" size={hp(2.8)} color={Colors.danger} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={S.imagePlaceholder}>
                {uploading ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={hp(4)} color={Colors.border} />
                    <Text style={S.imagePlaceholderText}>Tap to pick image</Text>
                    <Text style={S.imagePlaceholderSub}>Recommended: 1200 × 480 px · max 5 MB</Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* ── Banner type ── */}
          <SectionLabel>Banner Type</SectionLabel>
          <SegmentControl options={BANNER_TYPES} value={bannerType} onChange={setBannerType} />

          {/* ── Overlay ── */}
          <SectionLabel>Image Overlay</SectionLabel>
          <View style={S.field}>
            <FieldLabel>Colour</FieldLabel>
            <View style={S.colourRow}>
              {OVERLAY_COLOURS.map((c) => (
                <ColourDot key={c} colour={c} selected={overlayColor === c} onPress={() => setOverlayColor(c)} />
              ))}
            </View>
          </View>
          <View style={S.field}>
            <View style={S.sliderRow}>
              <FieldLabel>Opacity</FieldLabel>
              <View style={S.opacityControl}>
                <TouchableOpacity
                  style={S.opacityBtn}
                  onPress={() => setOverlayOpacity((v) => Math.max(0, parseFloat((v - 0.05).toFixed(2))))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={hp(2)} color={Colors.ink} />
                </TouchableOpacity>
                <Text style={S.sliderVal}>{Math.round(overlayOpacity * 100)}%</Text>
                <TouchableOpacity
                  style={S.opacityBtn}
                  onPress={() => setOverlayOpacity((v) => Math.min(1, parseFloat((v + 0.05).toFixed(2))))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={hp(2)} color={Colors.ink} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Text content ── */}
          {showText && (
            <>
              <SectionLabel>Text Content</SectionLabel>
              <View style={S.field}>
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  style={S.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Banner headline…"
                  placeholderTextColor={Colors.muted}
                  maxLength={80}
                />
              </View>
              <View style={S.field}>
                <FieldLabel>Body text (optional)</FieldLabel>
                <TextInput
                  style={[S.input, S.inputMulti]}
                  value={bodyText}
                  onChangeText={setBodyText}
                  placeholder="Supporting text…"
                  placeholderTextColor={Colors.muted}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>
              <View style={S.field}>
                <FieldLabel>Text colour</FieldLabel>
                <TextInput
                  style={S.input}
                  value={textColor}
                  onChangeText={setTextColor}
                  placeholder="#ffffff"
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="none"
                  maxLength={9}
                />
              </View>
              <View style={S.field}>
                <FieldLabel>Vertical alignment</FieldLabel>
                <SegmentControl options={ALIGN_V_OPTIONS} value={textAlignV} onChange={setTextAlignV} />
              </View>
              <View style={S.field}>
                <FieldLabel>Horizontal alignment</FieldLabel>
                <SegmentControl options={ALIGN_H_OPTIONS} value={textAlignH} onChange={setTextAlignH} />
              </View>
            </>
          )}

          {/* ── CTA ── */}
          {showCta && (
            <>
              <SectionLabel>Call to Action</SectionLabel>
              <View style={S.field}>
                <FieldLabel>Button label</FieldLabel>
                <TextInput
                  style={S.input}
                  value={ctaLabel}
                  onChangeText={setCtaLabel}
                  placeholder="e.g. Learn more"
                  placeholderTextColor={Colors.muted}
                  maxLength={40}
                />
              </View>
              <View style={S.field}>
                <FieldLabel>Action type</FieldLabel>
                <SegmentControl options={CTA_TYPES} value={ctaType} onChange={setCtaType} />
              </View>
              {ctaType === 'url' && (
                <View style={S.field}>
                  <FieldLabel>URL</FieldLabel>
                  <TextInput
                    style={S.input}
                    value={ctaUrl}
                    onChangeText={setCtaUrl}
                    placeholder="https://…"
                    placeholderTextColor={Colors.muted}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              )}
              {ctaType === 'info' && (
                <View style={S.field}>
                  <FieldLabel>Info text</FieldLabel>
                  <TextInput
                    style={[S.input, S.inputMulti, { minHeight: hp(10) }]}
                    value={ctaInfo}
                    onChangeText={setCtaInfo}
                    placeholder="Text shown when user taps the button…"
                    placeholderTextColor={Colors.muted}
                    multiline
                  />
                </View>
              )}
            </>
          )}

          {/* ── Scope ── */}
          <SectionLabel>Audience</SectionLabel>
          <SegmentControl options={SCOPE_TYPES} value={scopeType} onChange={handleScopeChange} />

          {scopeType !== 'global' && (
            <View style={S.scopeList}>
              <FieldLabel>Select school</FieldLabel>
              {schools.length === 0 ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <View style={S.pillRow}>
                  {schools.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[S.pill, schoolId === s.id && S.pillActive]}
                      onPress={() => handleSchoolSelect(s.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[S.pillText, schoolId === s.id && S.pillTextActive]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {scopeType === 'branch' && schoolId && (
            <View style={S.scopeList}>
              <FieldLabel>Select branch</FieldLabel>
              {branches.length === 0 ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <View style={S.pillRow}>
                  {branches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[S.pill, branchId === b.id && S.pillActive]}
                      onPress={() => setBranchId(b.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[S.pillText, branchId === b.id && S.pillTextActive]} numberOfLines={1}>
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Schedule ── */}
          <SectionLabel>Schedule</SectionLabel>
          <View style={S.row2}>
            <View style={[S.field, { flex: 1 }]}>
              <FieldLabel>Start date</FieldLabel>
              <TextInput
                style={S.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={[S.field, { flex: 1 }]}>
              <FieldLabel>End date (optional)</FieldLabel>
              <TextInput
                style={S.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
          </View>

          {/* ── Settings ── */}
          <SectionLabel>Settings</SectionLabel>
          <View style={S.field}>
            <FieldLabel>Sort order (lower = first)</FieldLabel>
            <TextInput
              style={S.input}
              value={sortOrder}
              onChangeText={setSortOrder}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.muted}
              maxLength={4}
            />
          </View>
          <View style={S.switchRow}>
            <Text style={S.switchLabel}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={isActive ? Colors.primary : Colors.soft}
            />
          </View>

          {/* ── Error ── */}
          {saveError ? <Text style={S.saveError}>{saveError}</Text> : null}

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[S.saveBtn, saving && S.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving || uploading}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={S.saveBtnText}>{isEdit ? 'Save changes' : 'Create banner'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: wp(6) },
  errorText:  { fontSize: hp(1.8), fontFamily: Fonts.regular, color: Colors.danger, textAlign: 'center', marginBottom: hp(2) },
  backBtn:    { paddingHorizontal: wp(6), paddingVertical: hp(1.2), backgroundColor: Colors.primary, borderRadius: 12 },
  backBtnText: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.white },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(1),
    gap: wp(2),
  },
  headerBack:  { width: hp(4.4), height: hp(4.4), borderRadius: 12, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: hp(2.1), fontFamily: Fonts.bold, color: Colors.ink, letterSpacing: -0.3 },
  headerAction: { width: hp(4.4), height: hp(4.4), borderRadius: 12, backgroundColor: Colors.dangerLight || '#FEF2F2', alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(6), gap: hp(1.2) },

  sectionLabel: {
    fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.soft,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: hp(1.5), marginBottom: hp(0.3),
  },
  fieldLabel: { fontSize: hp(1.55), fontFamily: Fonts.medium, color: Colors.soft, marginBottom: hp(0.5) },

  field: { gap: hp(0.5) },
  row2:  { flexDirection: 'row', gap: wp(3) },

  // Image picker
  imagePicker: {
    height: hp(22), borderRadius: 16, overflow: 'hidden',
    backgroundColor: Colors.canvas, borderWidth: 1.5,
    borderColor: Colors.border, borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: hp(0.8),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  imageEditText: { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.white },
  imageRemoveBtn: { position: 'absolute', top: 6, right: 6 },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(0.8) },
  imagePlaceholderText: { fontSize: hp(1.7), fontFamily: Fonts.medium, color: Colors.soft },
  imagePlaceholderSub:  { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted },

  // Input
  input: {
    backgroundColor: Colors.canvas, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.3), fontSize: hp(1.7), fontFamily: Fonts.regular,
    color: Colors.ink,
  },
  inputMulti: { textAlignVertical: 'top', minHeight: hp(8) },

  // Segment
  segment: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segBtn: {
    paddingHorizontal: wp(3.5), paddingVertical: hp(0.9),
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  segBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segText:      { fontSize: hp(1.55), fontFamily: Fonts.medium, color: Colors.soft },
  segTextActive: { color: Colors.white },

  // Colour dots
  colourRow:       { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  colourDot:       { width: hp(3.5), height: hp(3.5), borderRadius: hp(1.75) },
  colourDotSelected: { borderWidth: 3, borderColor: Colors.primary },

  // Opacity control
  sliderRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderVal:     { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.ink, minWidth: 40, textAlign: 'center' },
  opacityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  opacityBtn:    { width: hp(3.6), height: hp(3.6), borderRadius: 10, backgroundColor: Colors.canvas, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  // Scope
  scopeList: { marginTop: hp(0.8), gap: hp(0.5) },
  pillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: wp(3.5), paddingVertical: hp(0.85),
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, maxWidth: '60%',
  },
  pillActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:     { fontSize: hp(1.5), fontFamily: Fonts.medium, color: Colors.soft },
  pillTextActive: { color: Colors.white },

  // Switch
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.canvas, borderRadius: 12, padding: wp(4),
    borderWidth: 1, borderColor: Colors.border,
  },
  switchLabel: { fontSize: hp(1.7), fontFamily: Fonts.medium, color: Colors.ink },

  // Error
  saveError: { fontSize: hp(1.55), fontFamily: Fonts.regular, color: Colors.danger, textAlign: 'center', marginTop: hp(0.5) },

  // Save button
  saveBtn: {
    marginTop: hp(1), height: hp(6.5), borderRadius: 16,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: hp(1.9), fontFamily: Fonts.bold, color: Colors.white, letterSpacing: -0.2 },
});
