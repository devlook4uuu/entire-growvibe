/**
 * BannerCarousel.jsx — Web dashboard banner carousel
 *
 * - Fetches active banners scoped to the current user (global + school + branch)
 * - Module-level cache (60s TTL) keyed by profile id — avoids re-fetch on tab switch
 * - Auto-advances every 5 s, pauses on hover
 * - Dot indicators + left/right arrow buttons
 * - Renders nothing if no active banners
 * - CTA type "url"  → opens link in new tab
 * - CTA type "info" → opens inline info sheet below carousel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C } from '../../pages/dashboard/AdminDashboard';

// ─── Module-level cache ────────────────────────────────────────────────────────
const CACHE_TTL = 60_000;
const bannerCache = {};

function cacheKey(profileId) { return profileId || '__anon__'; }
function isFresh(key) { return bannerCache[key] && Date.now() - bannerCache[key].ts < CACHE_TTL; }

function getBannerImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('banners').getPublicUrl(path);
  return data?.publicUrl || null;
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
export default function BannerCarousel() {
  const profile = useSelector((s) => s.auth.profile);

  const [banners,    setBanners]    = useState([]);
  const [loaded,     setLoaded]     = useState(false);
  const [active,     setActive]     = useState(0);
  const [hovered,    setHovered]    = useState(false);
  const [infoOpen,   setInfoOpen]   = useState(false);  // inline info sheet
  const intervalRef  = useRef(null);

  // Fetch
  useEffect(() => {
    if (!profile?.id) return;
    const key = cacheKey(profile.id);
    if (isFresh(key)) {
      setBanners(bannerCache[key].items);
      setLoaded(true);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('banners')
      .select('id, banner_type, title, body_text, cta_label, cta_type, cta_url, cta_info, bg_image_path, overlay_color, overlay_opacity, text_color, text_align_v, text_align_h')
      .eq('is_active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const items = data || [];
        bannerCache[key] = { items, ts: Date.now() };
        setBanners(items);
        setLoaded(true);
      });
  }, [profile?.id]);

  // Auto-advance
  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % banners.length);
    setInfoOpen(false);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || hovered) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(goNext, 5000);
    return () => clearInterval(intervalRef.current);
  }, [banners.length, hovered, goNext]);

  function goPrev() { setActive((i) => (i - 1 + banners.length) % banners.length); setInfoOpen(false); }
  function goTo(i)  { setActive(i); setInfoOpen(false); }

  if (!loaded || banners.length === 0) return null;

  const banner = banners[active];
  const imgUrl = getBannerImageUrl(banner.bg_image_path);
  const showText = banner.banner_type === 'image_text' || banner.banner_type === 'image_text_cta';
  const showCta  = banner.banner_type === 'image_text_cta';

  function handleCta() {
    if (banner.cta_type === 'url' && banner.cta_url) {
      window.open(banner.cta_url, '_blank', 'noopener,noreferrer');
    } else if (banner.cta_type === 'info') {
      setInfoOpen((v) => !v);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Slide */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          height: 220, cursor: 'default',
          backgroundColor: C.canvas,
          backgroundImage: imgUrl ? `url(${imgUrl})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          userSelect: 'none',
        }}
      >
        {/* Overlay */}
        {(banner.overlay_opacity > 0) && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: banner.overlay_color || '#000',
            opacity: banner.overlay_opacity,
          }} />
        )}

        {/* No image placeholder */}
        {!imgUrl && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: C.muted }}>No image</span>
          </div>
        )}

        {/* Text content */}
        {showText && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            justifyContent: banner.text_align_v === 'top' ? 'flex-start' : banner.text_align_v === 'center' ? 'center' : 'flex-end',
            alignItems: banner.text_align_h === 'left' ? 'flex-start' : banner.text_align_h === 'center' ? 'center' : 'flex-end',
            textAlign: banner.text_align_h || 'left',
            padding: '20px 24px', gap: 6,
          }}>
            {banner.title && (
              <div style={{
                fontSize: 20, fontWeight: 800, lineHeight: 1.25,
                color: banner.text_color || '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                maxWidth: '75%',
              }}>
                {banner.title}
              </div>
            )}
            {banner.body_text && (
              <div style={{
                fontSize: 13, lineHeight: 1.5,
                color: banner.text_color || '#fff', opacity: 0.9,
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                maxWidth: '70%',
              }}>
                {banner.body_text}
              </div>
            )}
            {showCta && banner.cta_label && (
              <button
                onClick={handleCta}
                style={{
                  marginTop: 6,
                  padding: '8px 20px', borderRadius: 24,
                  border: `2px solid ${banner.text_color || '#fff'}`,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  color: banner.text_color || '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.30)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)'}
              >
                {banner.cta_label}
              </button>
            )}
          </div>
        )}

        {/* Prev / Next arrows — only if multiple banners */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goPrev}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                backgroundColor: 'rgba(0,0,0,0.35)', color: '#fff',
                cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)', transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)'}
            >‹</button>
            <button
              onClick={goNext}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                backgroundColor: 'rgba(0,0,0,0.35)', color: '#fff',
                cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)', transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)'}
            >›</button>
          </>
        )}

        {/* Dots */}
        {banners.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === active ? 20 : 7, height: 7, borderRadius: 999, border: 'none',
                  backgroundColor: i === active ? '#fff' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', padding: 0,
                  transition: 'width 0.25s, background-color 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info sheet (CTA type = info) */}
      {infoOpen && banner.cta_info && (
        <div style={{
          marginTop: 10, borderRadius: 12, padding: '14px 16px',
          backgroundColor: C.canvas, border: `1px solid ${C.border}`,
          fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: C.ink }}>{banner.cta_label}</span>
            <button onClick={() => setInfoOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.muted, lineHeight: 1, padding: 2 }}>×</button>
          </div>
          {banner.cta_info}
        </div>
      )}
    </div>
  );
}
