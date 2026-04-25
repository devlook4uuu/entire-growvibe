import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp } from '../helpers/dimension';

/**
 * Reusable Button component.
 *
 * Props:
 *   title         — string
 *   onPress       — function
 *   loading       — bool  (shows spinner, disables press)
 *   disabled      — bool
 *   bgColor       — string  (default: Colors.primary)
 *   textColor     — string  (default: Colors.white)
 *   size          — 'default' | 'small'
 *   style         — extra style for outer TouchableOpacity
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  bgColor = Colors.primary,
  textColor = Colors.white,
  size = 'default',
  style,
}) {
  const isDisabled = disabled || loading;

  const height = size === 'small' ? hp(5.6) : hp(6.2);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        S.btn,
        { backgroundColor: bgColor, height },
        isDisabled && S.btnDisabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[S.label, { color: textColor }]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  btn: {
    width: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  label: {
    fontSize: hp(1.8),
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.2,
  },
});
