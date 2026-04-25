import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';

/**
 * SectionCard
 * White rounded card with an optional title and action slot.
 *
 * Props:
 *   title     — string  (optional section heading)
 *   action    — React element  (optional right-side element in header)
 *   children  — content
 *   style     — extra style for card container
 */
export default function SectionCard({ title, action, children, style }) {
  const hasHeader = title || action;

  return (
    <View style={[S.card, style]}>
      {hasHeader && (
        <View style={S.header}>
          {title && <Text style={S.title}>{title}</Text>}
          {action && <View>{action}</View>}
        </View>
      )}
      {children}
    </View>
  );
}

const S = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(1.8),
    marginBottom: hp(1.8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1.4),
  },
  title: {
    fontSize: hp(1.7),
    fontFamily: Fonts.semiBold,
    color: Colors.ink,
    letterSpacing: -0.3,
  },
});
