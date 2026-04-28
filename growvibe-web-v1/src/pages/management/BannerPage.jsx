/**
 * BannerPage.jsx — Admin banner management
 *
 * Full CRUD for promotional banners shown on all role dashboards.
 * Supports 3 types: image_only | image_text | image_text_cta
 * Targeting: global | school-wide | branch-specific
 * Scheduling: start_date + end_date
 * Image upload to Supabase Storage bucket "banners"
 *
 * Recommended banner image: 1200 × 480 px (2.5:1), WebP/JPEG, max 5 MB
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { C, PageHeader } from '../dashboard/AdminDashboard';
import { supabase } from '../../lib/supabase';
import {
  makePageCache, usePageList,
  SlideOver, Field, TextInput, SaveBtn, CancelBtn, FormError,
  SearchBar, CardGrid, EmptyBlock, ErrorBlock, LoadMoreBtn,
} from '../../components/shared/webListHelpers';
import Image  from '../../assets/icons/Image';
import Plus   from '../../assets/icons/Plus';
import Pen    from '../../assets/icons/Pen';
import Trash  from '../../assets/icons/Trash';
import School from '../../assets/icons/School';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getBannerImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('banners').getPublicUrl(path);
  return data?.publicUrl || null;
}

const BANNER_TYPES = [
  { value: 'image_only',     label: 'Image Only',          desc: 'Background image, no text overlay' },
  { value: 'image_text',     label: 'Image + Text',        desc: 'Image with title & body text' },
  { value: 'image_text_cta', label: 'Image + Text + CTA',  desc: 'Image, text, and a call-to-action button' },
];

const CTA_TYPES = [
  { value: 'url',  label: 'External / Deep Link URL' },
  { value: 'info', label: 'Info sheet (text shown on tap)' },
];

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = makePageCache(30_000, (scope, q) => `${scope}|${q || '__all__'}`);
const PAGE_SIZE = 12;

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ height: 140, backgroundColor: C.borderLight }} />
      <div style={{ padding: 14 }}>
        <div style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 8 }} />
        <div style={{ height: 10, width: '75%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ height: 24, width: 50, borderRadius: 6, backgroundColor: C.borderLight }} />
          <div style={{ height: 24, width: 50, borderRadius: 6, backgroundColor: C.borderLight }} />
        </div>
      </div>
    </div>
  );
}

// ─── Banner preview card ───────────────────────────────────────────────────────
function BannerCard({ item, onEdit, onDelete, toggling, onToggleActive }) {
  const [hov, setHov] = useState(false);
  const imgUrl = getBannerImageUrl(item.bg_image_path);
  const isActive = item.is_active;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.white, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${hov ? C.blue : C.border}`,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? '0 2px 12px rgba(59,130,246,0.10)' : 'none',
        display: 'flex', flexDirection: 'column',
        opacity: isActive ? 1 : 0.65,
      }}
    >
      {/* Preview */}
      <div style={{
        height: 140, position: 'relative', overflow: 'hidden',
        backgroundColor: C.canvas,
        backgroundImage: imgUrl ? `url(${imgUrl})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        {/* Overlay */}
        {item.overlay_opacity > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: item.overlay_color || '#000',
            opacity: item.overlay_opacity,
          }} />
        )}
        {/* Text preview */}
        {(item.banner_type === 'image_text' || item.banner_type === 'image_text_cta') && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            justifyContent: item.text_align_v === 'top' ? 'flex-start' : item.text_align_v === 'center' ? 'center' : 'flex-end',
            alignItems: item.text_align_h === 'left' ? 'flex-start' : item.text_align_h === 'center' ? 'center' : 'flex-end',
            padding: '10px 12px', gap: 4,
            textAlign: item.text_align_h || 'left',
          }}>
            {item.title && (
              <div style={{ fontSize: 13, fontWeight: 700, color: item.text_color || '#fff', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {item.title}
              </div>
            )}
            {item.body_text && (
              <div style={{ fontSize: 11, color: item.text_color || '#fff', opacity: 0.9, lineHeight: 1.4, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {item.body_text.length > 60 ? item.body_text.slice(0, 60) + '…' : item.body_text}
              </div>
            )}
            {item.banner_type === 'image_text_cta' && item.cta_label && (
              <div style={{
                alignSelf: 'flex-start', marginTop: 4,
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                backgroundColor: 'rgba(255,255,255,0.25)', color: item.text_color || '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
              }}>
                {item.cta_label}
              </div>
            )}
          </div>
        )}
        {/* No image placeholder */}
        {!imgUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
            <Image size={28} color={C.muted} strokeWidth={1.4} />
            <span style={{ fontSize: 11, color: C.muted }}>No image</span>
          </div>
        )}
        {/* Type badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600,
          backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
        }}>
          {BANNER_TYPES.find((t) => t.value === item.banner_type)?.label || item.banner_type}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <School size={11} color={C.muted} strokeWidth={1.6} />
          <span style={{ fontSize: 11, color: C.muted }}>
            {item.school_id ? (item.branch_id ? 'Branch-specific' : 'School-specific') : 'Global'}
          </span>
          <span style={{ fontSize: 11, color: C.borderLight, marginInline: 2 }}>•</span>
          <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(item.start_date)} → {item.end_date ? fmtDate(item.end_date) : 'No end'}</span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${C.borderLight}` }}>
          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => !toggling && onToggleActive(item)}
              title={isActive ? 'Deactivate' : 'Activate'}
              style={{
                width: 36, height: 20, borderRadius: 999, border: 'none',
                cursor: toggling ? 'not-allowed' : 'pointer', padding: 0,
                backgroundColor: isActive ? C.green : C.muted,
                opacity: toggling ? 0.5 : 1,
                transition: 'background-color 0.2s', position: 'relative', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2,
                left: isActive ? 16 : 2,
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            <span style={{ fontSize: 11, color: C.muted }}>{isActive ? 'Active' : 'Inactive'}</span>
          </div>
          {/* Edit / Delete */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onEdit(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                height: 28, paddingInline: 10, borderRadius: 6,
                border: `1px solid ${C.border}`,
                backgroundColor: hov ? C.blueBg : C.white,
                cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.blue,
              }}
            >
              <Pen size={11} color={C.blue} /> Edit
            </button>
            <button
              onClick={() => onDelete(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                height: 28, paddingInline: 10, borderRadius: 6,
                border: `1px solid ${C.border}`,
                backgroundColor: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 500, color: C.red,
              }}
            >
              <Trash size={11} color={C.red} strokeWidth={1.8} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Image upload zone ────────────────────────────────────────────────────────
function ImageUploadZone({ currentPath, originalPath, onUploaded, onRemove, uploading, setUploading }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const previewUrl = currentPath ? getBannerImageUrl(currentPath) : null;

  async function handleFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Only JPEG, PNG, WebP, or GIF images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { alert('Upload failed: ' + error.message); return; }
    // Delete the old image from storage if there was one
    if (currentPath && !currentPath.startsWith('http')) {
      supabase.storage.from('banners').remove([currentPath]);
    }
    onUploaded(path);
  }

  async function handleRemove() {
    // Delete from storage if it's not an external URL
    if (currentPath && !currentPath.startsWith('http')) {
      // Only delete from storage if it's the original saved path (not a newly uploaded one
      // that hasn't been committed yet — but we track that via originalPath)
      supabase.storage.from('banners').remove([currentPath]);
    }
    onRemove();
  }

  return (
    <div>
      {previewUrl ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <img src={previewUrl} alt="Banner preview" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6,
          }}>
            <button
              onClick={() => inputRef.current?.click()}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Change
            </button>
            <button
              onClick={handleRemove}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          style={{
            height: 140, borderRadius: 10, border: `2px dashed ${dragOver ? C.blue : C.border}`,
            backgroundColor: dragOver ? C.blueBg : C.canvas,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
        >
          <Image size={28} color={dragOver ? C.blue : C.muted} strokeWidth={1.4} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.soft }}>{uploading ? 'Uploading…' : 'Click or drag to upload'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>JPEG · PNG · WebP · GIF — max 5 MB</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Recommended: 1200 × 480 px (2.5:1)</div>
          </div>
        </div>
      )}
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── Colour picker row ─────────────────────────────────────────────────────────
function ColorField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 12, color: C.soft, minWidth: 90 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <input
          type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', padding: 2 }}
        />
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </div>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────
function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer', fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            backgroundColor: value === opt.value ? C.blue : C.white,
            color: value === opt.value ? '#fff' : C.soft,
            borderRight: i < options.length - 1 ? `1px solid ${C.border}` : 'none',
            transition: 'background-color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Scope selector ───────────────────────────────────────────────────────────
function ScopeSelector({ targetType, setTargetType, schoolId, setSchoolId, branchId, setBranchId }) {
  const SCOPE_OPTS = [
    { value: 'global', label: 'Global' },
    { value: 'school', label: 'School' },
    { value: 'branch', label: 'Branch' },
  ];

  const [schools,        setSchools]        = useState([]);
  const [branches,       setBranches]       = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingBranches,setLoadingBranches]= useState(false);

  // Load schools when switching to school/branch scope
  async function handleScopeChange(v) {
    setTargetType(v);
    if (v === 'global') { setSchoolId(''); setBranchId(''); return; }
    if (v === 'school') { setBranchId(''); }
    if (schools.length === 0) {
      setLoadingSchools(true);
      const { data } = await supabase.from('schools').select('id, name').eq('is_active', true).order('name');
      setSchools(data || []);
      setLoadingSchools(false);
    }
  }

  // Load branches when a school is selected
  async function handleSchoolSelect(id) {
    setSchoolId(id);
    setBranchId('');
    setBranches([]);
    if (!id || targetType !== 'branch') return;
    setLoadingBranches(true);
    const { data } = await supabase.from('branches').select('id, name').eq('school_id', id).eq('is_active', true).order('name');
    setBranches(data || []);
    setLoadingBranches(false);
  }

  // When targetType is already 'branch' and school changes, reload branches
  async function handleSchoolSelectForBranch(id) {
    setSchoolId(id);
    setBranchId('');
    if (!id) { setBranches([]); return; }
    setLoadingBranches(true);
    const { data } = await supabase.from('branches').select('id, name').eq('school_id', id).eq('is_active', true).order('name');
    setBranches(data || []);
    setLoadingBranches(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SegmentedControl options={SCOPE_OPTS} value={targetType} onChange={handleScopeChange} />

      {/* School list */}
      {(targetType === 'school' || targetType === 'branch') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.soft, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Select School</div>
          {loadingSchools ? (
            <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Loading schools…</div>
          ) : schools.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>No active schools found.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {schools.map((s) => (
                <button
                  key={s.id}
                  onClick={() => targetType === 'branch' ? handleSchoolSelectForBranch(s.id) : handleSchoolSelect(s.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', border: `1.5px solid ${schoolId === s.id ? C.blue : C.border}`,
                    backgroundColor: schoolId === s.id ? C.blueBg : C.white,
                    color: schoolId === s.id ? C.blue : C.soft,
                    transition: 'all 0.15s',
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Branch list */}
      {targetType === 'branch' && schoolId && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.soft, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Select Branch <span style={{ fontWeight: 400, color: C.muted, textTransform: 'none' }}>(optional — leave unselected for school-wide)</span>
          </div>
          {loadingBranches ? (
            <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Loading branches…</div>
          ) : branches.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>No branches found for this school.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBranchId(branchId === b.id ? '' : b.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', border: `1.5px solid ${branchId === b.id ? C.blue : C.border}`,
                    backgroundColor: branchId === b.id ? C.blueBg : C.white,
                    color: branchId === b.id ? C.blue : C.soft,
                    transition: 'all 0.15s',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Banner form ───────────────────────────────────────────────────────────────
function BannerForm({ banner, profile, onSave, onClose }) {
  const isEdit = !!banner?.id;

  // Type
  const [bannerType,   setBannerType]   = useState(banner?.banner_type    || 'image_only');
  // Content
  const [title,        setTitle]        = useState(banner?.title          || '');
  const [bodyText,     setBodyText]     = useState(banner?.body_text       || '');
  // CTA
  const [ctaType,      setCtaType]      = useState(banner?.cta_type        || 'url');
  const [ctaLabel,     setCtaLabel]     = useState(banner?.cta_label       || '');
  const [ctaUrl,       setCtaUrl]       = useState(banner?.cta_url         || '');
  const [ctaInfo,      setCtaInfo]      = useState(banner?.cta_info        || '');
  // Visuals
  const [bgImagePath,  setBgImagePath]  = useState(banner?.bg_image_path   || '');
  const [overlayColor, setOverlayColor] = useState(banner?.overlay_color   || '#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(
    banner?.overlay_opacity != null ? String(banner.overlay_opacity) : '0'
  );
  const [textColor,    setTextColor]    = useState(banner?.text_color      || '#FFFFFF');
  const [textAlignV,   setTextAlignV]   = useState(banner?.text_align_v    || 'bottom');
  const [textAlignH,   setTextAlignH]   = useState(banner?.text_align_h    || 'left');
  // Scheduling
  const [startDate,    setStartDate]    = useState(banner?.start_date      || new Date().toISOString().split('T')[0]);
  const [endDate,      setEndDate]      = useState(banner?.end_date        || '');
  const [isActive,     setIsActive]     = useState(banner?.is_active       ?? true);
  const [sortOrder,    setSortOrder]    = useState(String(banner?.sort_order ?? 0));
  // Targeting
  const initTargetType = banner?.branch_id ? 'branch' : banner?.school_id ? 'school' : 'global';
  const [targetType,   setTargetType]   = useState(initTargetType);
  const [schoolId,     setSchoolId]     = useState(banner?.school_id  || '');
  const [branchId,     setBranchId]     = useState(banner?.branch_id  || '');

  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const showText = bannerType === 'image_text' || bannerType === 'image_text_cta';
  const showCta  = bannerType === 'image_text_cta';

  async function handleSave() {
    if (!bgImagePath) { setError('Please upload a banner image.'); return; }
    if (showText && !title.trim()) { setError('Title is required for this banner type.'); return; }
    if (showCta && !ctaLabel.trim()) { setError('CTA button label is required.'); return; }
    if (showCta && ctaType === 'url') {
      const trimmed = ctaUrl.trim();
      if (!trimmed) { setError('CTA URL is required when link type is URL.'); return; }
      if (!/^https?:\/\/.+/.test(trimmed)) { setError('CTA URL must start with http:// or https://'); return; }
    }
    if (endDate && endDate <= startDate) { setError('End date must be after start date.'); return; }
    const opac = parseFloat(overlayOpacity);
    if (isNaN(opac) || opac < 0 || opac > 1) { setError('Overlay opacity must be 0–1 (e.g. 0.4).'); return; }

    const payload = {
      banner_type:     bannerType,
      title:           showText ? title.trim() || null : null,
      body_text:       showText ? bodyText.trim() || null : null,
      cta_type:        showCta ? ctaType : null,
      cta_label:       showCta ? ctaLabel.trim() || null : null,
      cta_url:         showCta && ctaType === 'url'  ? ctaUrl.trim()  || null : null,
      cta_info:        showCta && ctaType === 'info' ? ctaInfo.trim() || null : null,
      bg_image_path:   bgImagePath,
      overlay_color:   overlayColor,
      overlay_opacity: opac,
      text_color:      textColor,
      text_align_v:    textAlignV,
      text_align_h:    textAlignH,
      start_date:      startDate,
      end_date:        endDate || null,
      is_active:       isActive,
      sort_order:      parseInt(sortOrder, 10) || 0,
      school_id:       targetType !== 'global' ? schoolId || null : null,
      branch_id:       targetType === 'branch' ? branchId || null : null,
    };

    setError(''); setSaving(true);
    try {
      if (isEdit) {
        const { error: err } = await supabase.from('banners').update(payload).eq('id', banner.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('banners').insert({ ...payload, created_by: profile.id });
        if (err) throw err;
      }
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <FormError message={error} />

      {/* Banner type */}
      <Field label="Banner Type">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {BANNER_TYPES.map((t) => (
            <label
              key={t.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${bannerType === t.value ? C.blue : C.border}`,
                backgroundColor: bannerType === t.value ? C.blueBg : C.white,
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio" name="bannerType" value={t.value}
                checked={bannerType === t.value}
                onChange={() => setBannerType(t.value)}
                style={{ marginTop: 2, accentColor: C.blue }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: bannerType === t.value ? C.blue : C.ink }}>{t.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {/* Image upload */}
      <Field label="Background Image">
        <ImageUploadZone
          currentPath={bgImagePath}
          onUploaded={setBgImagePath}
          onRemove={() => setBgImagePath('')}
          uploading={uploading}
          setUploading={setUploading}
          originalPath={banner?.bg_image_path || ''}
        />
      </Field>

      {/* Overlay */}
      <Field label="Image Overlay">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ColorField label="Overlay colour" value={overlayColor} onChange={setOverlayColor} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: C.soft, minWidth: 90 }}>Opacity (0–1)</label>
            <div style={{ flex: 1 }}>
              <input
                type="range" min="0" max="1" step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(e.target.value)}
                style={{ width: '100%', accentColor: C.blue }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Current: {overlayOpacity}</div>
            </div>
          </div>
        </div>
      </Field>

      {/* Text fields */}
      {showText && (
        <>
          <Field label="Title">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Get Free Delivery On Your First Order" />
          </Field>
          <Field label="Body Text" optional>
            <textarea
              value={bodyText} onChange={(e) => setBodyText(e.target.value)}
              placeholder="Short description or tagline…"
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit', backgroundColor: C.white,
              }}
            />
          </Field>
          <Field label="Text Colour">
            <ColorField label="Text colour" value={textColor} onChange={setTextColor} />
          </Field>
          <Field label="Text Alignment">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Vertical */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: C.soft, minWidth: 90 }}>Vertical</span>
                <SegmentedControl
                  options={[{ value: 'top', label: 'Top' }, { value: 'center', label: 'Center' }, { value: 'bottom', label: 'Bottom' }]}
                  value={textAlignV}
                  onChange={setTextAlignV}
                />
              </div>
              {/* Horizontal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: C.soft, minWidth: 90 }}>Horizontal</span>
                <SegmentedControl
                  options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
                  value={textAlignH}
                  onChange={setTextAlignH}
                />
              </div>
            </div>
          </Field>
        </>
      )}

      {/* CTA */}
      {showCta && (
        <Field label="Call-to-Action Button">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Button Label">
              <TextInput value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="e.g. Shop Now →" />
            </Field>
            <Field label="Action Type">
              <div style={{ display: 'flex', gap: 8 }}>
                {CTA_TYPES.map((t) => (
                  <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.soft, cursor: 'pointer' }}>
                    <input type="radio" name="ctaType" value={t.value} checked={ctaType === t.value} onChange={() => setCtaType(t.value)} style={{ accentColor: C.blue }} />
                    {t.label}
                  </label>
                ))}
              </div>
            </Field>
            {ctaType === 'url' && (
              <Field label="URL / Deep Link">
                <TextInput value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://… or app://screen" />
              </Field>
            )}
            {ctaType === 'info' && (
              <Field label="Info Text (shown on tap)">
                <textarea
                  value={ctaInfo} onChange={(e) => setCtaInfo(e.target.value)}
                  placeholder="Full information text shown when user taps the button…"
                  rows={4}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: `1px solid ${C.border}`, fontSize: 13, color: C.ink,
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'inherit', backgroundColor: C.white,
                  }}
                />
              </Field>
            )}
          </div>
        </Field>
      )}

      {/* Scheduling */}
      <Field label="Schedule">
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Start date</div>
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', backgroundColor: C.white }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>End date (optional)</div>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', backgroundColor: C.white }}
            />
          </div>
        </div>
      </Field>

      {/* Sort order */}
      <Field label="Sort Order">
        <TextInput value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" type="number" />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Lower number = appears first in carousel.</div>
      </Field>

      {/* Active */}
      <Field label="Status">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <button
            onClick={() => setIsActive((v) => !v)}
            style={{
              width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
              backgroundColor: isActive ? C.green : C.muted, transition: 'background-color 0.2s', position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: isActive ? 21 : 3, width: 18, height: 18,
              borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          <span style={{ fontSize: 13, color: C.soft }}>{isActive ? 'Active — visible to users' : 'Inactive — hidden from users'}</span>
        </label>
      </Field>

      {/* Targeting */}
      <Field label="Target Audience">
        <ScopeSelector
          targetType={targetType} setTargetType={setTargetType}
          schoolId={schoolId} setSchoolId={setSchoolId}
          branchId={branchId} setBranchId={setBranchId}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <SaveBtn label={isEdit ? 'Save Changes' : 'Create Banner'} loading={saving || uploading} onClick={handleSave} />
        <CancelBtn onClick={onClose} />
      </div>
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────
function DeleteModal({ visible, entry, onClose, onConfirm, deleting }) {
  const [hov, setHov] = useState(false);
  if (!visible) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.redBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash size={20} color={C.red} strokeWidth={1.6} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>Delete Banner</p>
            <p style={{ fontSize: 13, color: C.soft, margin: '2px 0 0' }}>This cannot be undone. The image will also be removed from storage.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: C.soft, backgroundColor: C.white }}>Cancel</button>
          <button
            onClick={onConfirm} disabled={deleting}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: hov && !deleting ? '#DC2626' : C.red, opacity: deleting ? 0.65 : 1 }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BannerPage() {
  const profile = useSelector((s) => s.auth.profile);

  const [slideOpen,   setSlideOpen]   = useState(false);
  const [editEntry,   setEditEntry]   = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [togglingId,  setTogglingId]  = useState(null);

  const scope = 'banners';

  const buildQuery = useCallback((sb, _sc, query, from, to) => {
    let q = sb
      .from('banners')
      .select('id, banner_type, title, body_text, cta_label, cta_type, cta_url, cta_info, bg_image_path, overlay_color, overlay_opacity, text_color, text_align_v, text_align_h, start_date, end_date, is_active, sort_order, school_id, branch_id, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (query) q = q.ilike('title', `%${query}%`);
    return q;
  }, []);

  const { items, loading, loadingMore, hasMore, error, search, setSearch, loadMore, reload } =
    usePageList({ cache, scope, pageSize: PAGE_SIZE, buildQuery });

  function openCreate() { setEditEntry(null); setSlideOpen(true); }
  function openEdit(entry) { setEditEntry(entry); setSlideOpen(true); }

  function handleSaved() {
    setSlideOpen(false);
    cache.invalidateAll();
    reload();
  }

  async function handleToggleActive(item) {
    setTogglingId(item.id);
    await supabase.from('banners').update({ is_active: !item.is_active }).eq('id', item.id);
    setTogglingId(null);
    cache.invalidateAll();
    reload();
  }

  async function handleDelete() {
    if (!deleteEntry) return;
    setDeleting(true);
    // Remove image from storage first
    if (deleteEntry.bg_image_path && !deleteEntry.bg_image_path.startsWith('http')) {
      await supabase.storage.from('banners').remove([deleteEntry.bg_image_path]);
    }
    await supabase.from('banners').delete().eq('id', deleteEntry.id);
    setDeleting(false);
    setDeleteEntry(null);
    cache.invalidateAll();
    reload();
  }

  return (
    <div>
      <PageHeader
        greeting="Banners"
        subtitle="Create and manage promotional banners shown on all user dashboards."
        actions={<AddBtn onClick={openCreate} />}
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search banners…" />

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading ? (
        <CardGrid skeletonCount={6} SkeletonCard={SkeletonCard} />
      ) : items.length === 0 ? (
        <EmptyBlock search={search} emptyText="No banners yet. Create your first banner." />
      ) : (
        <>
          <CardGrid>
            {items.map((item) => (
              <BannerCard
                key={item.id}
                item={item}
                onEdit={openEdit}
                onDelete={setDeleteEntry}
                toggling={togglingId === item.id}
                onToggleActive={handleToggleActive}
              />
            ))}
          </CardGrid>
          {hasMore && <LoadMoreBtn loadingMore={loadingMore} onClick={loadMore} />}
        </>
      )}

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editEntry ? 'Edit Banner' : 'New Banner'}
        width={520}
      >
        <BannerForm
          key={editEntry?.id ?? 'new'}
          banner={editEntry}
          profile={profile}
          onSave={handleSaved}
          onClose={() => setSlideOpen(false)}
        />
      </SlideOver>

      <DeleteModal
        visible={!!deleteEntry}
        entry={deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

function AddBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 10, border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
        backgroundColor: hov ? '#2563EB' : C.blue, transition: 'background-color 0.15s',
      }}
    >
      <Plus size={15} color="#fff" strokeWidth={2} /> New Banner
    </button>
  );
}
