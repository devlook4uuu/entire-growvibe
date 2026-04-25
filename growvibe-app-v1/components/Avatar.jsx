import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';

/**
 * Avatar
 * Shows profile image if url provided, otherwise shows initials.
 *
 * Props:
 *   url       — string | null
 *   name      — string  (used for initials fallback)
 *   size      — number  (diameter in px, default 72)
 *   borderColor — string (optional ring color)
 */
export default function Avatar({ url, name = '', size = 72, borderColor }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  const fontSize = size * 0.36;
  const borderWidth = borderColor ? 2.5 : 0;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[
          S.img,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor: borderColor || 'transparent',
          },
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        S.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: borderColor || 'transparent',
        },
      ]}
    >
      <Text style={[S.initials, { fontSize }]}>{initials || '?'}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  img: {
    backgroundColor: Colors.borderLight,
  },
  fallback: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
});
