import { C, FONT } from '../../styles/colors';

const FEATURES = [
  'Smart Attendance Tracking',
  'GrowCoins Reward System',
  'Real-time Group Chat',
  'Academic Results & Exams',
  'Online Classes',
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  panel: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '45%',
    flexShrink: 0,
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
    padding: '48px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  bubble1: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
  },
  bubble2: {
    position: 'absolute', bottom: -60, left: -60,
    width: 220, height: 220, borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
  },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    background: 'rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, backdropFilter: 'blur(10px)',
  },
  logoLetter: {
    fontSize: 36, fontWeight: 800, color: '#ffffff',
    letterSpacing: '-0.5px', fontFamily: FONT,
  },
  brandName: {
    fontSize: 32, fontWeight: 800, color: '#ffffff',
    letterSpacing: '-0.5px', marginBottom: 12, fontFamily: FONT,
  },
  tagline: {
    fontSize: 15, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', lineHeight: 1.6,
    maxWidth: 280, fontWeight: 400, fontFamily: FONT,
  },
  featureList: {
    marginTop: 44, display: 'flex', flexDirection: 'column',
    gap: 14, width: '100%', maxWidth: 300,
  },
  featureRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    color: 'rgba(255,255,255,0.88)', fontSize: 14,
    fontWeight: 500, fontFamily: FONT,
  },
  featureDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'rgba(255,255,255,0.65)', flexShrink: 0,
  },
};

/**
 * BrandingPanel — left half of the login split-screen.
 * Hidden on screens narrower than the responsive breakpoint (controlled by parent).
 *
 * @param {boolean} visible — when false, display is set to 'none'
 */
export default function BrandingPanel({ visible }) {
  return (
    <div style={{ ...S.panel, display: visible ? 'flex' : 'none' }}>
      <div style={S.bubble1} />
      <div style={S.bubble2} />

      <div style={S.logoBox}>
        <span style={S.logoLetter}>G</span>
      </div>

      <div style={S.brandName}>GrowVibe</div>

      <div style={S.tagline}>
        The complete school management platform — attendance, academics, and more.
      </div>

      <div style={S.featureList}>
        {FEATURES.map((feature) => (
          <div key={feature} style={S.featureRow}>
            <div style={S.featureDot} />
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}
