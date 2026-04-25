/**
 * TopBar.jsx
 *
 * Role-aware top bar:
 *   admin       → "GrowVibe" + "Founder of GrowVibe"  (no DB fetch)
 *   owner       → school name + "Entire School"        (fetch school only)
 *   principal / coordinator / teacher / student
 *               → school name + branch name             (fetch school + branch)
 *
 * School + branch meta is cached at module level so re-mounts don't re-fetch.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { CachedAvatar } from '../helpers/imageCache';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';

// Module-level cache — survives re-mounts within the same app session
// key: schoolId  →  { schoolName, logoUrl }
const metaCache = {};

export function invalidateTopBarCache(schoolId) {
  if (schoolId) delete metaCache[schoolId];
  else Object.keys(metaCache).forEach((k) => delete metaCache[k]);
}

export default function TopBar() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);

  const role     = profile?.role;
  const schoolId = profile?.school_id;
  const branchId = profile?.branch_id;

  // ── Admin gets a static display — no DB fetch needed ──────────────────────
  const isAdmin = role === 'admin';

  const [meta,    setMeta]    = useState(schoolId ? (metaCache[schoolId] || null) : null);
  const [loading, setLoading] = useState(!isAdmin && !!schoolId && !metaCache[schoolId]);

  useEffect(() => {
    if (isAdmin) return;           // admin: nothing to fetch
    if (!schoolId) { setLoading(false); return; }
    if (metaCache[schoolId]) { setMeta(metaCache[schoolId]); setLoading(false); return; }

    let cancelled = false;
    async function load() {
      const [schoolRes, branchRes] = await Promise.all([
        supabase.from('schools').select('name, logo_url').eq('id', schoolId).maybeSingle(),
        (role !== 'owner' && branchId)
          ? supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const result = {
        schoolName: schoolRes.data?.name  || 'School',
        branchName: branchRes.data?.name  || null,
        logoUrl:    schoolRes.data?.logo_url || null,
      };
      metaCache[schoolId] = result;
      setMeta(result);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isAdmin, schoolId, branchId, role]);

  // ── Derive display values ──────────────────────────────────────────────────
  let displayName, displaySub, displayLogoUrl;

  if (isAdmin) {
    displayName    = 'GrowVibe';
    displaySub     = 'Founder of GrowVibe';
    displayLogoUrl = null; // shows "G" initials — replace with GrowVibe logo asset if available
  } else if (role === 'owner') {
    displayName    = meta?.schoolName || (loading ? '…' : 'School');
    displaySub     = 'Entire School';
    displayLogoUrl = meta?.logoUrl || null;
  } else {
    displayName    = meta?.schoolName || (loading ? '…' : 'School');
    displaySub     = meta?.branchName || null;
    displayLogoUrl = meta?.logoUrl || null;
  }

  return (
    <View style={S.wrap}>
      {/* Left: school logo + name */}
      <View style={S.left}>
        {loading ? (
          <View style={[S.logoWrap, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : displayLogoUrl ? (
          <Image
            source={{ uri: displayLogoUrl }}
            style={S.logo}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
        ) : (
          <View style={[S.logoWrap, S.logoInitials]}>
            <Text style={S.logoInitialsText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View style={S.nameCol}>
          <Text style={S.schoolName} numberOfLines={1} ellipsizeMode="tail">
            {loading ? '…' : displayName}
          </Text>
          {(loading || displaySub) ? (
            <Text style={S.branchName} numberOfLines={1} ellipsizeMode="tail">
              {loading ? '…' : displaySub}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right: user avatar → taps to Profile tab */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/profile')}
        hitSlop={8}
        activeOpacity={0.8}
      >
        {loading ? (
          <View style={[S.avatarWrap, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <CachedAvatar
            name={profile?.name || ''}
            avatarUrl={profile?.avatar_url || null}
            size={wp(12)}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    gap: wp(3),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    flex: 1,
  },
  logoWrap: {
    width: wp(12), height: wp(12), borderRadius: wp(1.5),
    flexShrink: 0, overflow: 'hidden',
  },
  logo: {
    width: wp(12), height: wp(12), borderRadius: wp(1.5),
  },
  logoInitials: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitialsText: {
    fontSize: wp(5.5), fontFamily: Fonts.bold, color: Colors.primary,
  },
  nameCol: {
    flex: 1, gap: 1,
  },
  schoolName: {
    fontSize: wp(4.8),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  branchName: {
    fontSize: wp(3.5),
    fontFamily: Fonts.regular,
    color: Colors.soft,
    letterSpacing: -0.2,
    lineHeight: wp(4.5),
  },
  avatarWrap: {
    width: wp(12), height: wp(12), borderRadius: wp(6),
    backgroundColor: Colors.borderLight,
  },
});
