/**
 * imageCache.js
 *
 * Professional image caching helper built on expo-image.
 *
 * expo-image has built-in disk + memory caching. This helper adds:
 *  - Supabase signed-URL generation with in-memory URL cache (TTL-based)
 *  - A ready-to-use <CachedImage> component
 *  - A <CachedAvatar> component with initials fallback
 *  - prefetch() utility for warming the cache ahead of time
 *
 * Usage:
 *   import { CachedImage, CachedAvatar, getSignedUrl } from '../helpers/imageCache';
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';

// ─── Signed-URL in-memory cache ───────────────────────────────────────────────
// Signed URLs expire after SIGN_TTL seconds on Supabase side.
// We cache them locally for URL_CACHE_TTL ms so we don't re-sign on every render.
const SIGN_TTL_SECONDS = 3600;        // 1 hour — Supabase signed URL validity
const URL_CACHE_TTL    = 3_300_000;   // 55 minutes — refresh before Supabase expiry

const urlCache = new Map(); // key: `${bucket}/${path}` → { url, expiresAt }

/**
 * getSignedUrl(bucket, path)
 * Returns a signed URL for a private Supabase Storage object.
 * Caches the result; re-signs if within 5 minutes of expiry.
 */
export async function getSignedUrl(bucket, path) {
  if (!bucket || !path) return null;
  const key = `${bucket}/${path}`;
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cached.url;
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  urlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + URL_CACHE_TTL });
  return data.signedUrl;
}

/**
 * prefetch(bucket, path)
 * Resolves the signed URL and tells expo-image to prefetch it into disk cache.
 */
export async function prefetch(bucket, path) {
  const url = await getSignedUrl(bucket, path);
  if (url) await Image.prefetch(url);
}

/**
 * clearUrlCache()
 * Wipe the in-memory signed-URL cache (e.g. after logout).
 */
export function clearUrlCache() {
  urlCache.clear();
}

// ─── expo-image shared props ──────────────────────────────────────────────────
// contentFit, transition, and cachePolicy applied consistently everywhere.
const BASE_IMAGE_PROPS = {
  contentFit:   'cover',
  transition:   200,
  cachePolicy:  'disk',           // expo-image disk cache
  recyclingKey: undefined,        // set per-instance
};

// ─── CachedImage ──────────────────────────────────────────────────────────────
/**
 * <CachedImage bucket="chat-images" path="school/file.jpg" style={...} />
 *
 * For private buckets: generates a signed URL before rendering.
 * For public URLs: pass `uri` directly instead of bucket+path.
 * Shows a shimmer placeholder while loading.
 */
export function CachedImage({ bucket, path, uri, style, contentFit = 'cover', onLoad, onError }) {
  const [resolvedUri, setResolvedUri] = useState(uri || null);
  const [errored,     setErrored]     = useState(false);

  useEffect(() => {
    if (uri) { setResolvedUri(uri); return; }
    if (!bucket || !path) return;
    let cancelled = false;
    getSignedUrl(bucket, path).then((url) => {
      if (!cancelled) setResolvedUri(url);
    });
    return () => { cancelled = true; };
  }, [bucket, path, uri]);

  if (errored || (!resolvedUri && !uri)) {
    return <View style={[S.placeholder, style]} />;
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={style}
      contentFit={contentFit}
      transition={200}
      cachePolicy="disk"
      recyclingKey={resolvedUri}
      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
      onLoad={onLoad}
      onError={() => setErrored(true)}
    />
  );
}

// ─── CachedAvatar ─────────────────────────────────────────────────────────────
/**
 * <CachedAvatar name="John Doe" avatarUrl="https://..." size={40} />
 *
 * Shows profile image if available (public URL, no signing needed).
 * Falls back to initials circle.
 */
export function CachedAvatar({ name, avatarUrl, size = 40, style }) {
  const [errored, setErrored] = useState(false);

  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const isValidUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http');

  if (isValidUrl && !errored) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        contentFit="cover"
        transition={150}
        cachePolicy="disk"
        recyclingKey={avatarUrl}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <View style={[
      S.initialsWrap,
      { width: size, height: size, borderRadius: size / 2 },
      style,
    ]}>
      <Text style={[S.initialsText, { fontSize: size * 0.36 }]}>
        {initials || '?'}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.borderLight,
  },
  initialsWrap: {
    backgroundColor: Colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  initialsText: {
    fontFamily: Fonts.bold,
    color:      Colors.primary,
  },
});
