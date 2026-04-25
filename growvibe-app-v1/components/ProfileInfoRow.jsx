import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp } from '../helpers/dimension';

/**
 * ProfileInfoRow
 * A single labeled read-only info row for the profile screen.
 *
 * Props:
 *   label     — string  (e.g. "Email")
 *   value     — string  (e.g. "user@school.com")
 *   icon      — React element  (optional left icon)
 *   last      — bool  (removes bottom border on last item)
 */
export default function ProfileInfoRow({ label, value, icon, last = false }) {
  return (
    <View style={[S.row, last && S.rowLast]}>
      {icon && <View style={S.iconWrap}>{icon}</View>}
      <View style={S.text}>
        <Text style={S.label}>{label}</Text>
        <Text style={S.value} numberOfLines={1} ellipsizeMode="tail">
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.6),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  value: {
    fontSize: hp(1.7),
    fontFamily: Fonts.medium,
    color: Colors.ink,
    letterSpacing: -0.2,
  },
});
