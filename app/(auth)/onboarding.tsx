import { colors } from "@/constants/colors";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Onboarding() {
  const [slide, setSlide] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));

  const changeSlide = (nextSlide: number) => {
    Animated.sequence([
      Animated.timing(fade, {
        duration: 100,
        toValue: 0.2,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        duration: 240,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    setSlide(nextSlide);
  };

  const finish = () => router.replace("/(auth)/login");

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={styles.brandLockup}>
          <View style={styles.brandLogoFrame}>
            <Image
              accessibilityLabel="Grab And Go logo"
              source={require("../../assets/images/grab-and-go-logo.png")}
              style={styles.brandLogo}
            />
          </View>
          <View>
            <Text style={styles.brandName}>Grab &amp; Go</Text>
            <Text style={styles.brandCaption}>FRESH PICKS • FASTER PICKUP</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={finish}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.content, { opacity: fade }]}>
        {slide === 0 && <PriceSlide />}
        {slide === 1 && <FreshSlide />}
        {slide === 2 && <PickupSlide />}
      </Animated.View>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((dot) => (
            <View
              key={dot}
              style={[styles.dot, dot === slide && styles.activeDot]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (slide === 2 ? finish() : changeSlide(slide + 1))}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>
            {slide === 2 ? "Let’s get started" : "Continue"}
          </Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Already have an account? </Text>
          <Pressable onPress={finish}>
            <Text style={styles.loginLink}>Log in</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PriceSlide() {
  return (
    <>
      <View style={styles.heroImage}>
        <View style={styles.shelf} />
        <View style={[styles.product, styles.productOne]} />
        <View style={[styles.product, styles.productTwo]} />
        <View style={[styles.product, styles.productThree]} />
        <Text style={styles.shelfLabel}>MALABE • FRESH • LOCAL</Text>
      </View>
      <View style={styles.productCard}>
        <Text style={styles.productName}>Keeri Samba Premium (5kg)</Text>
        <View style={styles.priceRow}>
          <Text style={styles.oldPrice}>Bazaar{`\n`}LKR 1,620</Text>
          <Text style={styles.oldPrice}>Super C{`\n`}LKR 1,590</Text>
          <View style={styles.bestPrice}>
            <Text style={styles.bestCaption}>Grab &amp; Go</Text>
            <Text style={styles.bestValue}>LKR 1,480</Text>
          </View>
        </View>
      </View>
      <View style={styles.mintLabel}>
        <Text style={styles.mintLabelText}>
          ⌁ Malabe, Keells &amp; Cargills Matrix
        </Text>
      </View>
      <Text style={styles.heading}>Live Price Comparison</Text>
      <Text style={styles.body}>
        Compare fresh produce &amp; pantry staples across local marts in
        real-time. Never overpay on daily essentials.
      </Text>
    </>
  );
}

function FreshSlide() {
  return (
    <>
      <View style={styles.illustrationPanel}>
        <Text style={styles.illustrationEyebrow}>YOUR WEEK, SORTED</Text>
        <Text style={styles.illustrationTitle}>
          Good food{`\n`}starts nearby.
        </Text>
        <View style={styles.marketCircle}>
          <Text style={styles.marketEmoji}>✦</Text>
        </View>
        <View style={styles.floatingCard}>
          <Text style={styles.floatingSmall}>TODAY’S PICK</Text>
          <Text style={styles.floatingMain}>Fresh &amp; fair</Text>
          <Text style={styles.floatingSmall}>From your local shelves</Text>
        </View>
        <View style={styles.stem} />
        <View style={styles.leaf} />
      </View>
      <View style={styles.mintLabel}>
        <Text style={styles.mintLabelText}>⌁ CURATED FOR MALABE</Text>
      </View>
      <Text style={styles.heading}>Fresh finds, closer to home</Text>
      <Text style={styles.body}>
        See what is actually in stock nearby, choose your favourites, and build
        a basket that feels like you.
      </Text>
    </>
  );
}

function PickupSlide() {
  return (
    <>
      <View style={styles.illustrationPanel}>
        <Text style={styles.illustrationEyebrow}>PICKUP, YOUR WAY</Text>
        <View style={styles.locker}>
          <View style={styles.lockerTop}>
            <Text style={styles.lockerBrand}>GRAB &amp; GO</Text>
            <View style={styles.signal}>
              <View style={styles.signalDot} />
            </View>
          </View>
          <View style={styles.lockerGrid}>
            {["01", "02", "03", "04", "05", "06"].map((slot) => (
              <View
                key={slot}
                style={[
                  styles.lockerSlot,
                  slot === "03" && styles.selectedSlot,
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    slot === "03" && styles.selectedSlotText,
                  ]}
                >
                  {slot}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.pickupBadge}>
          <Text style={styles.pickupBadgeNumber}>03</Text>
          <Text style={styles.pickupBadgeText}>Your locker is ready</Text>
        </View>
      </View>
      <View style={styles.mintLabel}>
        <Text style={styles.mintLabelText}>⌁ NO QUEUES. NO GUESSWORK.</Text>
      </View>
      <Text style={styles.heading}>Pick a time. Skip the queue.</Text>
      <Text style={styles.body}>
        Your order waits safely in a nearby locker. Scan, tap, and walk away
        with more time for your day.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.paper,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brandLockup: {
    alignItems: "center",
    flexDirection: "row",
  },
  brandLogoFrame: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E6E7FF",
    borderRadius: 13,
    borderWidth: 1,
    elevation: 2,
    height: 44,
    justifyContent: "center",
    marginRight: 9,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    width: 44,
  },
  brandLogo: { height: 42, width: 42 },
  brandName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  brandCaption: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.65,
    marginTop: 2,
  },
  skip: { color: colors.ink, fontSize: 12, fontWeight: "600", padding: 8 },
  content: { flex: 1, justifyContent: "center", paddingBottom: 16 },
  heroImage: {
    backgroundColor: "#DCE8D1",
    borderRadius: 17,
    height: 192,
    overflow: "hidden",
    position: "relative",
  },
  shelf: {
    backgroundColor: "#A26F46",
    bottom: 38,
    height: 12,
    left: 14,
    position: "absolute",
    right: 14,
  },
  product: {
    backgroundColor: colors.mint,
    borderRadius: 8,
    bottom: 49,
    height: 82,
    position: "absolute",
    width: 43,
  },
  productOne: {
    backgroundColor: "#F59B63",
    left: 45,
    transform: [{ rotate: "-8deg" }],
  },
  productTwo: {
    backgroundColor: "#F0CB63",
    left: 102,
    height: 110,
    transform: [{ rotate: "4deg" }],
  },
  productThree: {
    backgroundColor: "#83B76F",
    right: 47,
    height: 72,
    transform: [{ rotate: "10deg" }],
  },
  shelfLabel: {
    backgroundColor: "rgba(23,21,67,0.75)",
    bottom: 12,
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    left: 14,
    letterSpacing: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: "absolute",
  },
  productCard: {
    backgroundColor: colors.white,
    borderRadius: 13,
    elevation: 3,
    marginHorizontal: 12,
    marginTop: -16,
    padding: 13,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  productName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  oldPrice: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  bestPrice: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bestCaption: { color: colors.mint, fontSize: 8, fontWeight: "700" },
  bestValue: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  mintLabel: {
    alignSelf: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 15,
    marginTop: 21,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  mintLabelText: {
    color: "#118065",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heading: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 9,
    textAlign: "center",
  },
  body: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 16,
    marginTop: 8,
    textAlign: "center",
  },
  illustrationPanel: {
    backgroundColor: colors.night,
    borderRadius: 22,
    height: 300,
    overflow: "hidden",
    padding: 22,
    position: "relative",
  },
  illustrationEyebrow: {
    color: colors.mint,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  illustrationTitle: {
    color: colors.white,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 32,
    marginTop: 12,
  },
  marketCircle: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 78,
    bottom: -20,
    height: 160,
    justifyContent: "center",
    position: "absolute",
    right: -12,
    width: 160,
  },
  marketEmoji: {
    color: colors.ink,
    fontSize: 74,
    fontWeight: "200",
    marginTop: -24,
  },
  floatingCard: {
    backgroundColor: colors.paper,
    borderRadius: 13,
    bottom: 32,
    left: 22,
    padding: 13,
    position: "absolute",
    transform: [{ rotate: "-4deg" }],
  },
  floatingSmall: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  floatingMain: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginVertical: 5,
  },
  stem: {
    backgroundColor: colors.coral,
    bottom: 0,
    height: 145,
    left: 176,
    position: "absolute",
    transform: [{ rotate: "20deg" }],
    width: 7,
  },
  leaf: {
    backgroundColor: colors.amber,
    borderRadius: 50,
    bottom: 96,
    height: 24,
    left: 164,
    position: "absolute",
    transform: [{ rotate: "-35deg" }],
    width: 50,
  },
  locker: {
    backgroundColor: "#F4F0D8",
    borderRadius: 12,
    bottom: 26,
    left: 36,
    padding: 12,
    position: "absolute",
    right: 36,
  },
  lockerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  lockerBrand: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  signal: {
    alignItems: "center",
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  signalDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  lockerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  lockerSlot: {
    alignItems: "center",
    backgroundColor: "#D5D0AD",
    borderRadius: 4,
    height: 32,
    justifyContent: "center",
    width: "31%",
  },
  selectedSlot: { backgroundColor: colors.mint },
  slotText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  selectedSlotText: { color: colors.ink },
  pickupBadge: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderRadius: 12,
    bottom: 14,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: "absolute",
    right: 22,
    transform: [{ rotate: "4deg" }],
  },
  pickupBadgeNumber: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    marginRight: 7,
  },
  pickupBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    maxWidth: 68,
  },
  footer: { paddingBottom: 20 },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginBottom: 16,
  },
  dot: { backgroundColor: "#C7C7D3", borderRadius: 12, height: 22, width: 22 },
  activeDot: { backgroundColor: colors.ink },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 8,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 13,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  arrow: { color: colors.white, fontSize: 18, marginLeft: 7, marginTop: -2 },
  loginRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  loginHint: { color: colors.muted, fontSize: 10 },
  loginLink: { color: colors.ink, fontSize: 10, fontWeight: "800" },
});
