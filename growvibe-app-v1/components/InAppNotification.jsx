/**
 * InAppNotification
 *
 * A clean white banner that slides down from the top when a push notification
 * arrives while the app is foregrounded. Auto-dismisses after 4 seconds.
 * Tap to dismiss manually.
 *
 * The OS system banner is suppressed (shouldShowBanner: false in notifications.js)
 * so only this component shows — no double notifications.
 *
 * Usage: render once at the root layout, inside the Redux <Provider>.
 *   <InAppNotification />
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';

const BANNER_HEIGHT = hp(9);
const AUTO_DISMISS  = 4500; // ms

export default function InAppNotification() {
  const translateY = useSharedValue(-(BANNER_HEIGHT + 60));
  const timer      = useRef(null);

  const [title, setTitle] = useState('');
  const [body,  setBody]  = useState('');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  function dismiss() {
    if (timer.current) clearTimeout(timer.current);
    translateY.value = withTiming(-(BANNER_HEIGHT + 60), { duration: 250 });
  }

  function show(notifTitle, notifBody) {
    setTitle(notifTitle || '');
    setBody(notifBody  || '');

    if (timer.current) clearTimeout(timer.current);

    // Slide in with spring
    translateY.value = withSpring(0, { damping: 20, stiffness: 220, mass: 0.8 });

    // Auto-dismiss
    timer.current = setTimeout(() => {
      runOnJS(dismiss)();
    }, AUTO_DISMISS);
  }

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const t = notification.request.content.title ?? '';
      const b = notification.request.content.body  ?? '';
      runOnJS(show)(t, b);
    });

    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Sit just below the status bar
  const topOffset = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24) + 8
    : 52;

  return (
    <Animated.View
      style={[styles.banner, { top: topOffset }, animatedStyle]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={dismiss}
        style={styles.card}
      >
        {/* Left accent bar */}
        <View style={styles.accent} />

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={hp(2.4)} color={Colors.primary} />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          {!!title && (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          )}
          {!!body && (
            <Text style={styles.body} numberOfLines={2}>{body}</Text>
          )}
        </View>

        {/* Dismiss button */}
        <TouchableOpacity onPress={dismiss} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={hp(2)} color={Colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:  'absolute',
    left:      wp(4),
    right:     wp(4),
    zIndex:    9999,
    elevation: 20,
    // Shadow
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    16,
    overflow:        'hidden',
    minHeight:       BANNER_HEIGHT,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
  },
  accent: {
    width:           4,
    alignSelf:       'stretch',
    backgroundColor: Colors.primary,
  },
  iconWrap: {
    width:            hp(4.2),
    height:           hp(4.2),
    borderRadius:     hp(2.1),
    backgroundColor:  Colors.primaryLight,
    alignItems:       'center',
    justifyContent:   'center',
    marginLeft:       wp(3),
    flexShrink:       0,
  },
  textWrap: {
    flex:            1,
    paddingVertical: hp(1.2),
    paddingLeft:     wp(2.5),
    paddingRight:    wp(1),
  },
  title: {
    fontSize:     hp(1.65),
    fontFamily:   Fonts.semiBold,
    color:        Colors.ink,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  body: {
    fontSize:   hp(1.45),
    fontFamily: Fonts.regular,
    color:      Colors.soft,
    lineHeight: hp(2),
  },
  closeBtn: {
    padding:     wp(3),
    flexShrink:  0,
  },
});
