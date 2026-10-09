import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The home hero, as a self-rotating carousel.
 *
 * Built from scratch rather than pulled in as a dependency: the whole thing is a
 * fixed-size box, an absolutely positioned image per slide, and a timer, and a
 * library would add a peer dependency to an app that has none for this.
 *
 * expo-image's own `transition` provides the fade, which is why each slide is a
 * separate absolutely-positioned Image rather than one image whose source is
 * swapped: a crossfade needs both images mounted at once.
 */

export type HeroSlide = {
  /** Absolute URL. */
  image: string;
  /** Small label above the headline, e.g. "THIS WEEK". */
  badge: string;
  /** Two or three short lines. A literal \n starts a new line. */
  title: string;
  /** One sentence under the headline. */
  copy: string;
  /** Button text. */
  cta: string;
};

/** How long each slide holds before the timer advances. */
export const CAROUSEL_INTERVAL_MS = 4200;

/** The crossfade length. Kept under the interval so it always finishes. */
const FADE_MS = 500;

export function HeroCarousel({
  slides,
  onCtaPress,
}: {
  slides: readonly HeroSlide[];
  onCtaPress: (slide: HeroSlide) => void;
}) {
  const [index, setIndex] = useState(0);
  // Set once the shopper touches anything, which stops the timer for good rather
  // than for one tick. Resuming on its own would fight the reader: they moved the
  // carousel deliberately, and having it slide away from the slide they chose is
  // the behaviour people describe as "jumpy".
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = slides.length;

  const goTo = useCallback(
    (next: number) => {
      // Modulo rather than clamping so an arrow tapped repeatedly at the end
      // wraps to the start instead of sticking on the last slide.
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % count);
  }, [count]);

  useEffect(() => {
    if (paused || count < 2) return;

    timer.current = setInterval(advance, CAROUSEL_INTERVAL_MS);

    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [advance, paused, count]);

  // Nothing to rotate through, or the slide count shrank under us.
  if (!count) return null;

  const current = slides[Math.min(index, count - 1)];

  return (
    <View
      accessibilityLabel="Featured offers"
      // onPointerDown rather than onTouchEnd: on web a drag that ends outside the
      // carousel never fires touchEnd, so the timer would keep running through a
      // swipe. Pointer events fire on press regardless of where the pointer ends.
      onPointerDown={() => setPaused(true)}
      style={styles.frame}
    >
      {slides.map((slide, slideIndex) => (
        <Image
          accessibilityLabel={slide.badge}
          // Only the active slide is announced to a screen reader; the rest are
          // decoration behind it.
          accessibilityElementsHidden={slideIndex !== index}
          contentFit="cover"
          importantForAccessibility={
            slideIndex === index ? "auto" : "no-hide-descendants"
          }
          key={slide.image}
          pointerEvents="none"
          source={slide.image}
          // expo-image crossfades, and each slide mounts separately, so the fade
          // is between two mounted images rather than a repaint of one.
          style={[styles.slide, slideIndex !== index && styles.slideHidden]}
          transition={FADE_MS}
        />
      ))}

      {/* One shade over the whole stack rather than one per slide: drawn per slide
          it would double up during the crossfade and flash darker. */}
      <View pointerEvents="none" style={styles.shade} />

      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{current.badge}</Text>
        </View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.copy}>{current.copy}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPaused(true);
            onCtaPress(current);
          }}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{current.cta}</Text>
          <FontAwesome color={colors.ink} name="arrow-right" size={12} />
        </Pressable>
      </View>

      {count > 1 ? (
        <>
          <Pressable
            accessibilityLabel="Previous slide"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              setPaused(true);
              goTo(index - 1);
            }}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowLeft,
              pressed && styles.arrowPressed,
            ]}
          >
            <FontAwesome color={colors.white} name="chevron-left" size={13} />
          </Pressable>

          <Pressable
            accessibilityLabel="Next slide"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              setPaused(true);
              goTo(index + 1);
            }}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowRight,
              pressed && styles.arrowPressed,
            ]}
          >
            <FontAwesome color={colors.white} name="chevron-right" size={13} />
          </Pressable>

          <View style={styles.dots}>
            {slides.map((slide, slideIndex) => (
              <Pressable
                accessibilityLabel={`Go to slide ${slideIndex + 1}`}
                accessibilityRole="button"
                hitSlop={10}
                key={slide.image}
                onPress={() => {
                  setPaused(true);
                  goTo(slideIndex);
                }}
                style={[
                  styles.dot,
                  slideIndex === index && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 22,
    height: 214,
    marginTop: 20,
    overflow: "hidden",
  },
  // Every slide occupies the whole frame. The hidden one stays mounted at zero
  // opacity, which is what lets expo-image crossfade between them.
  slide: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  slideHidden: { opacity: 0 },
  shade: {
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  content: { padding: 20 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.mint,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 27,
    marginTop: 12,
  },
  copy: {fontWeight: "400", color: "#F3F4F6", fontSize: 14, lineHeight: 15, marginTop: 7, maxWidth: 210 },
  cta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 13,
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  arrow: {
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    top: "38%",
    width: 32,
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  arrowPressed: { backgroundColor: "rgba(17, 24, 39, 0.8)" },
  dots: {
    bottom: 12,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  dot: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  dotActive: { backgroundColor: colors.white, width: 16 },
});

/** Kept out of the component so the styles above stay the only stylesheet. */
export const CarouselSpinner = () => (
  <ActivityIndicator color={colors.white} size="small" />
);