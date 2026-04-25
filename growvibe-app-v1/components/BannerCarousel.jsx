/**
 * BannerCarousel.jsx — App home screen banner carousel
 *
 * - Auto-advances every 5s, pauses while info sheet is open
 * - Dot indicators below the slide
 * - CTA "url"  → Linking.openURL
 * - CTA "info" → inline info sheet slides up below carousel
 * - Images cached to disk via expo-image cachePolicy="disk"
 * - Renders nothing if no banners
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp, wp } from '../helpers/dimension';
import { getBannerImageUrl } from '../hooks/useBanners';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_H = hp(22);       // ~190 px on a standard phone
const AUTO_INTERVAL = 5000;

// ─── Single slide ─────────────────────────────────────────────────────────────
function BannerSlide({ item, onCtaPress }) {
  const imgUrl = getBannerImageUrl(item.bg_image_path);
  const showText = item.banner_type === 'image_text' || item.banner_type === 'image_text_cta';
  const showCta  = item.banner_type === 'image_text_cta';

  return (
    <View style={[S.slide, { width: SCREEN_W - wp(8) }]}>
      {/* Background image */}
      {imgUrl ? (
        <Image
          source={{ uri: imgUrl }}
          style={S.bgImage}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[S.bgImage, { backgroundColor: Colors.canvas }]} />
      )}

      {/* Overlay */}
      {item.overlay_opacity > 0 && (
        <View style={[
          S.overlay,
          { backgroundColor: item.overlay_color || '#000', opacity: item.overlay_opacity },
        ]} />
      )}

      {/* Text content */}
      {showText && (
        <View style={[
          S.textWrap,
          {
            justifyContent: item.text_align_v === 'top' ? 'flex-start' : item.text_align_v === 'center' ? 'center' : 'flex-end',
            alignItems:     item.text_align_h === 'right' ? 'flex-end' : item.text_align_h === 'center' ? 'center' : 'flex-start',
          },
        ]}>
          {item.title ? (
            <Text style={[S.title, { color: item.text_color || '#fff', textAlign: item.text_align_h || 'left' }]} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}
          {item.body_text ? (
            <Text style={[S.body, { color: item.text_color || '#fff', textAlign: item.text_align_h || 'left' }]} numberOfLines={3}>
              {item.body_text}
            </Text>
          ) : null}
          {showCta && item.cta_label ? (
            <TouchableOpacity
              style={S.ctaBtn}
              onPress={() => onCtaPress(item)}
              activeOpacity={0.8}
            >
              <Text style={[S.ctaText, { color: item.text_color || '#fff' }]}>
                {item.cta_label}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── Info sheet modal ─────────────────────────────────────────────────────────
function InfoSheet({ visible, banner, onClose }) {
  if (!banner) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={S.modalBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={S.sheet}>
          <View style={S.sheetHandle} />
          <View style={S.sheetHeader}>
            <Text style={S.sheetTitle}>{banner.cta_label || 'Info'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={hp(2.4)} color={Colors.soft} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={S.sheetBody}>{banner.cta_info}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
export default function BannerCarousel({ banners }) {
  const [active,      setActive]      = useState(0);
  const [infoSheet,   setInfoSheet]   = useState(null);  // banner object or null
  const flatRef     = useRef(null);
  const intervalRef = useRef(null);
  const activeRef   = useRef(0);

  // Keep ref in sync
  activeRef.current = active;

  const goNext = useCallback(() => {
    if (banners.length <= 1) return;
    const next = (activeRef.current + 1) % banners.length;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setActive(next);
  }, [banners.length]);

  // Auto-advance — pause when info sheet is open
  useEffect(() => {
    if (banners.length <= 1 || infoSheet) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(goNext, AUTO_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [banners.length, infoSheet, goNext]);

  function handleCtaPress(item) {
    if (item.cta_type === 'url' && item.cta_url) {
      Linking.openURL(item.cta_url).catch(() => {});
    } else if (item.cta_type === 'info' && item.cta_info) {
      setInfoSheet(item);
    }
  }

  function handleScrollEnd(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - wp(8)));
    setActive(idx);
  }

  if (!banners || banners.length === 0) return null;

  return (
    <View style={S.container}>
      <FlatList
        ref={flatRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled={false}
        snapToInterval={SCREEN_W - wp(8)}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <BannerSlide item={item} onCtaPress={handleCtaPress} />
        )}
        contentContainerStyle={{ gap: wp(3) }}
        getItemLayout={(_, index) => ({
          length: SCREEN_W - wp(8),
          offset: (SCREEN_W - wp(8) + wp(3)) * index,
          index,
        })}
      />

      {/* Dots */}
      {banners.length > 1 && (
        <View style={S.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                S.dot,
                i === active && S.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Info sheet */}
      <InfoSheet
        visible={!!infoSheet}
        banner={infoSheet}
        onClose={() => setInfoSheet(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container: { marginBottom: hp(2) },

  slide: {
    height: SLIDE_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  textWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: wp(4),
    gap: hp(0.7),
  },
  title: {
    fontSize: hp(2.1),
    fontFamily: Fonts.bold,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: {
    fontSize: hp(1.5),
    fontFamily: Fonts.regular,
    lineHeight: hp(2.1),
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaBtn: {
    marginTop: hp(0.6),
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  ctaText: {
    fontSize: hp(1.55),
    fontFamily: Fonts.semiBold,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: hp(1),
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // Info sheet modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: wp(5),
    paddingTop: wp(3),
    gap: hp(1.2),
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: hp(0.8),
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink,
    letterSpacing: -0.3, flex: 1,
  },
  sheetBody: {
    fontSize: hp(1.65), fontFamily: Fonts.regular, color: Colors.soft,
    lineHeight: hp(2.5), paddingBottom: hp(4),
  },
});
