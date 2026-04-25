/**
 * useBanners.js — Fetch active banners for the current user
 *
 * Module-level cache (60s TTL) keyed by profile.id
 * Returns: { banners, loading, refresh }
 *
 * Image caching: expo-image with cachePolicy="disk" handles this
 * at the component level — no extra work needed here.
 */

import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';

const CACHE_TTL = 60_000;
const cache = {};

function cacheKey(profileId) { return profileId || '__anon__'; }
function isFresh(key) { return cache[key] && Date.now() - cache[key].ts < CACHE_TTL; }

export function getBannerImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('banners').getPublicUrl(path);
  return data?.publicUrl || null;
}

export function useBanners(profileId) {
  const [banners,  setBanners]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const hasMounted = useRef(false);

  const fetchBanners = useCallback(async ({ showLoading = false } = {}) => {
    if (!profileId) return;
    const key = cacheKey(profileId);

    if (isFresh(key)) {
      setBanners(cache[key].items);
      return;
    }

    if (showLoading) setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('banners')
      .select('id, banner_type, title, body_text, cta_label, cta_type, cta_url, cta_info, bg_image_path, overlay_color, overlay_opacity, text_color, text_align_v, text_align_h')
      .eq('is_active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('sort_order', { ascending: true });

    const items = data || [];
    cache[key] = { items, ts: Date.now() };
    setBanners(items);
    if (showLoading) setLoading(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      fetchBanners({ showLoading: true });
    } else {
      // On re-focus: only refresh if cache is stale
      fetchBanners({ showLoading: false });
    }
  }, [fetchBanners]));

  function refresh() {
    const key = cacheKey(profileId);
    delete cache[key];
    fetchBanners({ showLoading: false });
  }

  return { banners, loading, refresh };
}
