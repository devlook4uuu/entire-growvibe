/**
 * Skeleton.jsx
 *
 * Pulsing placeholder used while data is loading.
 * Usage:
 *   <Skeleton width={200} height={16} radius={8} />
 *   <Skeleton width="100%" height={12} />
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors } from '../constant/colors';

export default function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: Colors.canvas,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Pre-composed skeleton shapes ────────────────────────────────────────────

/** Full-width card placeholder */
export function SkeletonCard({ height = 120, style }) {
  return (
    <View style={[S.card, style]}>
      <Skeleton width={120} height={14} radius={7} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={10} radius={6} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={10} radius={6} />
    </View>
  );
}

/** Two-column stat grid skeleton (2 cards side by side) */
export function SkeletonStatGrid() {
  return (
    <View style={S.statGrid}>
      {[0, 1].map((i) => (
        <View key={i} style={S.statCard}>
          <Skeleton width={36} height={36} radius={10} style={{ marginBottom: 10 }} />
          <Skeleton width={60} height={18} radius={6} style={{ marginBottom: 6 }} />
          <Skeleton width={80} height={10} radius={5} />
        </View>
      ))}
    </View>
  );
}

/** Single-row widget skeleton */
export function SkeletonWidget({ style }) {
  return (
    <View style={[S.card, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Skeleton width={40} height={40} radius={12} />
        <Skeleton width={120} height={13} radius={6} />
      </View>
      <Skeleton width="100%" height={10} radius={6} style={{ marginBottom: 6 }} />
      <Skeleton width="55%" height={10} radius={6} />
    </View>
  );
}

const S = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.canvas,
    borderRadius: 16,
    padding: 14,
  },
});
