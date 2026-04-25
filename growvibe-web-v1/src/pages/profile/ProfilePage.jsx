import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Formik, Field, Form } from 'formik';
import * as Yup from 'yup';
import { updateProfileThunk } from '../../store/authSlice';
import { C, FONT, RADIUS } from '../../styles/colors';
import { useBreakpoint } from '../dashboard/AdminDashboard';

// ─── Validation ───────────────────────────────────────────────────────────────
const EditSchema = Yup.object({
  bio:           Yup.string().max(300, 'Max 300 characters'),
  date_of_birth: Yup.string(),
  facebook_url:  Yup.string().url('Enter a valid URL (include https://)').nullable(),
  instagram_url: Yup.string().url('Enter a valid URL (include https://)').nullable(),
  interests:     Yup.string(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin:       { label: 'Admin',       bg: C.purpleLight,  text: C.purple },
  owner:       { label: 'Owner',       bg: C.dangerLight,  text: C.dangerText },
  principal:   { label: 'Principal',   bg: C.primaryLight, text: C.primaryDark },
  coordinator: { label: 'Coordinator', bg: C.orangeLight,  text: C.orange },
  teacher:     { label: 'Teacher',     bg: C.successLight, text: C.success },
  student:     { label: 'Student',     bg: C.hover,        text: C.soft },
};

function getRoleCfg(role) {
  return ROLE_CONFIG[role] || { label: role || '—', bg: C.hover, text: C.soft };
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 72 }) {
  const fontSize = Math.round(size * 0.36);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: C.primaryLight,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize, fontWeight: 700, color: C.primary, fontFamily: FONT,
    }}>
      {initials(name)}
    </div>
  );
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = getRoleCfg(role);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      backgroundColor: cfg.bg, color: cfg.text, fontSize: 12, fontWeight: 600, fontFamily: FONT,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, last = false }) {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${C.borderLight}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: C.ink }}>{value}</span>
    </div>
  );
}

// ─── SocialLink ───────────────────────────────────────────────────────────────
function SocialLink({ href, label, iconSvg, color }) {
  const [hovered, setHovered] = useState(false);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: RADIUS.md, textDecoration: 'none',
        border: `1px solid ${hovered ? color + '60' : C.border}`,
        backgroundColor: hovered ? color + '0D' : C.white,
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      {/* Brand icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        backgroundColor: color + '1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {iconSvg}
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: hovered ? color : C.ink, fontFamily: FONT, transition: 'color 0.15s' }}>
        {label}
      </span>
      {/* external link icon */}
      <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

// ─── SVG brand icons ──────────────────────────────────────────────────────────
const FacebookSVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramSVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <defs>
      <radialGradient id="ig" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497"/>
        <stop offset="5%" stopColor="#fdf497"/>
        <stop offset="45%" stopColor="#fd5949"/>
        <stop offset="60%" stopColor="#d6249f"/>
        <stop offset="90%" stopColor="#285AEB"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig)"/>
    <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.8"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
  </svg>
);

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label }) {
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
      backgroundColor: C.primaryLight, color: C.primaryDark,
      fontSize: 12, fontWeight: 500, fontFamily: FONT,
    }}>
      {label}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: RADIUS.xl,
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

function CardSection({ title, children }) {
  return (
    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.borderLight}` }}>
      {title && (
        <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px', fontFamily: FONT }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────
function FormField({ label, name, type = 'text', placeholder, hint, readOnly = false, as }) {
  return (
    <Field name={name}>
      {({ field, form }) => {
        const error = form.touched[name] && form.errors[name];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.soft, fontFamily: FONT }}>{label}</label>
            {as === 'textarea' ? (
              <textarea
                {...field}
                placeholder={placeholder}
                rows={3}
                disabled={readOnly}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: RADIUS.md,
                  border: `1.5px solid ${error ? C.danger : C.border}`,
                  fontSize: 13, color: readOnly ? C.muted : C.ink, fontFamily: FONT,
                  backgroundColor: readOnly ? C.canvas : C.white,
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  opacity: readOnly ? 0.7 : 1,
                }}
                onFocus={(e) => { if (!readOnly) e.target.style.borderColor = C.primary; }}
                onBlur={(e) => { e.target.style.borderColor = error ? C.danger : C.border; field.onBlur(e); }}
              />
            ) : (
              <input
                {...field}
                type={type}
                placeholder={placeholder}
                disabled={readOnly}
                style={{
                  width: '100%', height: 38, padding: '0 12px', borderRadius: RADIUS.md,
                  border: `1.5px solid ${error ? C.danger : C.border}`,
                  fontSize: 13, color: readOnly ? C.muted : C.ink, fontFamily: FONT,
                  backgroundColor: readOnly ? C.canvas : C.white,
                  outline: 'none', boxSizing: 'border-box',
                  opacity: readOnly ? 0.7 : 1,
                }}
                onFocus={(e) => { if (!readOnly) e.target.style.borderColor = C.primary; }}
                onBlur={(e) => { e.target.style.borderColor = error ? C.danger : C.border; field.onBlur(e); }}
              />
            )}
            {hint && !error && <span style={{ fontSize: 11, color: C.muted }}>{hint}</span>}
            {error && <span style={{ fontSize: 11, color: C.danger }}>{error}</span>}
          </div>
        );
      }}
    </Field>
  );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────
function EditDrawer({ open, profile, onClose }) {
  const dispatch = useDispatch();
  const [saveError, setSaveError] = useState('');
  const [closeBtnH, setCloseBtnH] = useState(false);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  async function handleSave(values, { setSubmitting }) {
    setSaveError('');
    const interestsArray = values.interests.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await dispatch(updateProfileThunk({
        id: profile.id,
        updates: {
          bio:           values.bio.trim()           || null,
          date_of_birth: values.date_of_birth        || null,
          facebook_url:  values.facebook_url.trim()  || null,
          instagram_url: values.instagram_url.trim() || null,
          interests:     interestsArray.length ? interestsArray : null,
        },
      })).unwrap();
      onClose();
    } catch (err) {
      setSaveError(err || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 100,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, backgroundColor: C.white,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 22px', height: 60, flexShrink: 0,
          borderBottom: `1px solid ${C.borderLight}`,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: FONT }}>Edit Profile</span>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseBtnH(true)}
            onMouseLeave={() => setCloseBtnH(false)}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: closeBtnH ? C.hover : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.15s',
            }}
          >
            {/* × icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.soft} strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>

          {/* Read-only block */}
          <div style={{
            backgroundColor: C.canvas, borderRadius: RADIUS.lg,
            border: `1px solid ${C.borderLight}`, marginBottom: 20, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
              <Avatar name={profile?.name} url={profile?.avatar_url} size={40} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: 0, fontFamily: FONT }}>{profile?.name || '—'}</p>
                <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0', fontFamily: FONT }}>{profile?.email || '—'}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: 0, padding: '8px 16px', fontFamily: FONT }}>
              Name and email cannot be changed from here.
            </p>
          </div>

          {/* Error banner */}
          {saveError && (
            <div style={{
              padding: '10px 14px', borderRadius: RADIUS.md, marginBottom: 18,
              backgroundColor: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
              fontSize: 13, color: C.dangerText, fontFamily: FONT,
            }}>
              {saveError}
            </div>
          )}

          <Formik
            initialValues={{
              bio:           profile?.bio           || '',
              date_of_birth: profile?.date_of_birth || '',
              facebook_url:  profile?.facebook_url  || '',
              instagram_url: profile?.instagram_url || '',
              interests:     interests.join(', '),
            }}
            validationSchema={EditSchema}
            onSubmit={handleSave}
            enableReinitialize
          >
            {({ isSubmitting }) => (
              <Form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  <FormField label="Bio" name="bio" as="textarea" placeholder="Write something about yourself…" hint="Max 300 characters" />

                  <FormField label="Date of Birth" name="date_of_birth" type="date" hint="Your birthday" />

                  <FormField label="Interests" name="interests" placeholder="math, football, art" hint="Comma-separated list" />

                  <FormField label="Facebook URL" name="facebook_url" placeholder="https://facebook.com/yourname" />

                  <FormField label="Instagram URL" name="instagram_url" placeholder="https://instagram.com/yourname" />

                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <CancelBtn onClick={onClose} />
                    <SaveBtn loading={isSubmitting} />
                  </div>

                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </>
  );
}

// ─── Button helpers ───────────────────────────────────────────────────────────
function CancelBtn({ onClick }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 36, padding: '0 18px', borderRadius: RADIUS.md, cursor: 'pointer',
        border: `1.5px solid ${C.border}`, backgroundColor: h ? C.hover : C.white,
        color: C.soft, fontSize: 13, fontWeight: 600, fontFamily: FONT, transition: 'background-color 0.15s',
      }}>
      Cancel
    </button>
  );
}

function SaveBtn({ loading }) {
  const [h, setH] = useState(false);
  return (
    <button type="submit" disabled={loading}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        flex: 1, height: 36, padding: '0 20px', borderRadius: RADIUS.md,
        cursor: loading ? 'default' : 'pointer', border: 'none',
        backgroundColor: h && !loading ? C.primaryDark : C.primary,
        color: C.white, fontSize: 13, fontWeight: 600, fontFamily: FONT,
        opacity: loading ? 0.7 : 1, transition: 'background-color 0.15s',
      }}>
      {loading ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const bp = useBreakpoint();
  const profile = useSelector((s) => s.auth.profile);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editBtnH, setEditBtnH] = useState(false);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 24px', fontFamily: FONT }}>

      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.3px' }}>My Profile</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0', fontFamily: FONT }}>View and manage your personal information.</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          onMouseEnter={() => setEditBtnH(true)}
          onMouseLeave={() => setEditBtnH(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 16px', borderRadius: RADIUS.md, border: 'none', cursor: 'pointer',
            backgroundColor: editBtnH ? C.primaryDark : C.primary,
            color: C.white, fontSize: 13, fontWeight: 600, fontFamily: FONT,
            transition: 'background-color 0.15s',
          }}
        >
          {/* pencil icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit Profile
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: bp === 'xs' ? '1fr' : '240px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: identity card ── */}
        <Card>
          <div style={{ padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.borderLight}` }}>
            <Avatar name={profile?.name} url={profile?.avatar_url} size={76} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: '0 0 3px', letterSpacing: '-0.3px', fontFamily: FONT }}>{profile?.name || '—'}</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px', fontFamily: FONT }}>{profile?.email || '—'}</p>
              <RoleBadge role={profile?.role} />
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Status</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: profile?.is_active ? C.success : C.danger, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: profile?.is_active ? C.success : C.danger, fontFamily: FONT }}>
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </span>
            </div>
            {profile?.grow_coins != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>GrowCoins</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, fontFamily: FONT }}>★ {profile.grow_coins.toLocaleString()}</span>
              </div>
            )}
            {profile?.date_of_birth && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Birthday</span>
                <span style={{ fontSize: 12, color: C.ink, fontFamily: FONT }}>{formatDate(profile.date_of_birth)}</span>
              </div>
            )}
            {profile?.created_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Joined</span>
                <span style={{ fontSize: 12, color: C.ink, fontFamily: FONT }}>{formatDate(profile.created_at)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* ── Right: content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bio */}
          {profile?.bio && (
            <Card>
              <CardSection title="About">
                <p style={{ fontSize: 14, color: C.soft, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>{profile.bio}</p>
              </CardSection>
            </Card>
          )}

          {/* Interests */}
          {interests.length > 0 && (
            <Card>
              <CardSection title="Interests">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {interests.map((i) => <Chip key={i} label={i} />)}
                </div>
              </CardSection>
            </Card>
          )}

          {/* Account details — no school/branch/class */}
          <Card>
            <CardSection title="Account Details">
              <InfoRow label="Full Name"     value={profile?.name} />
              <InfoRow label="Email"         value={profile?.email} />
              <InfoRow label="Role"          value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : null} />
              <InfoRow label="Date of Birth" value={formatDate(profile?.date_of_birth)} />
              <InfoRow label="Last Updated"  value={formatDate(profile?.updated_at)} last />
            </CardSection>
          </Card>

          {/* Social links — clickable with brand icons */}
          {(profile?.facebook_url || profile?.instagram_url) && (
            <Card>
              <CardSection title="Social Links">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile?.facebook_url && (
                    <SocialLink href={profile.facebook_url} label="Facebook" color="#1877F2" iconSvg={FacebookSVG} />
                  )}
                  {profile?.instagram_url && (
                    <SocialLink href={profile.instagram_url} label="Instagram" color="#E1306C" iconSvg={InstagramSVG} />
                  )}
                </div>
              </CardSection>
            </Card>
          )}

        </div>
      </div>

      <EditDrawer open={drawerOpen} profile={profile} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
