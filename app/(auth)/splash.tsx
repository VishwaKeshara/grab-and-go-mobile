import { colors } from "@/constants/colors";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function Splash() {
  const [logoScale] = useState(() => new Animated.Value(0.86));

  useEffect(() => {
    Animated.spring(logoScale, {
      friction: 7,
      tension: 45,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => router.replace("/(auth)/onboarding"), 2200);
    return () => clearTimeout(timeout);
  }, [logoScale]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />
      <View style={styles.dashedPath} />
      <Pressable accessibilityRole="button" onPress={() => router.replace("/(auth)/onboarding")} style={styles.skip}>
        <Text style={styles.skipText}>Skip intro</Text>
      </Pressable>

      <Animated.View style={[styles.brandLockup, { transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoCard}>
          <Image source={require("../../assets/images/icon.png")} style={styles.logo} />
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>⚡ ZERO MIN WAIT</Text>
        </View>
        <Text style={styles.brand}>Grab &amp; Go</Text>
        <Text style={styles.location}>MALABE EXPRESS</Text>
        <Text style={styles.tagline}>Skip the grocery queues. Pick up{`\n`}in seconds.</Text>
        <View style={styles.serviceRow}>
          <View style={styles.servicePill}><Text style={styles.serviceIcon}>▣</Text><Text style={styles.serviceText}>Bazaar Locker</Text></View>
          <View style={styles.servicePill}><Text style={styles.serviceIcon}>⌘</Text><Text style={styles.serviceText}>Tap &amp; Collect</Text></View>
        </View>
      </Animated.View>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Connecting to Malabe Bazaar &amp; Kaduwela Hub...</Text>
      </View>
      <Text style={styles.serving}>➤ SERVING • MALABE • PITTUGALA • THALAHENA</Text>
      <View style={styles.homeIndicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.night, flex: 1, justifyContent: "center", overflow: "hidden", padding: 26 },
  orb: { borderColor: "rgba(151, 137, 255, 0.2)", borderRadius: 999, borderWidth: 1, position: "absolute" },
  orbTop: { height: 112, right: -6, top: 218, width: 112 },
  orbBottom: { bottom: -116, height: 300, left: 80, width: 300 },
  dashedPath: { borderColor: "rgba(95, 226, 185, 0.17)", borderRadius: 120, borderStyle: "dashed", borderWidth: 1, height: 124, left: -16, position: "absolute", top: 112, transform: [{ rotate: "18deg" }], width: 170 },
  skip: { padding: 10, position: "absolute", right: 20, top: 52 },
  skipText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  brandLockup: { alignItems: "center", marginTop: -32 },
  logoCard: { alignItems: "center", backgroundColor: colors.paper, borderRadius: 16, elevation: 12, height: 98, justifyContent: "center", shadowColor: colors.mint, shadowOpacity: 0.45, shadowRadius: 18, width: 98 },
  logo: { height: 66, width: 66 },
  pill: { backgroundColor: colors.mint, borderRadius: 20, marginTop: 4, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { color: colors.ink, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  brand: { color: colors.white, fontSize: 34, fontWeight: "800", letterSpacing: -1.2, marginTop: 2 },
  location: { backgroundColor: "#745B55", borderRadius: 8, color: "#FFE0B7", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 2, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3 },
  tagline: { color: "#E8E6F6", fontSize: 17, lineHeight: 24, marginTop: 20, textAlign: "center" },
  serviceRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  servicePill: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.12)", borderRadius: 15, borderWidth: 1, flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6 },
  serviceIcon: { color: colors.mint, fontSize: 12, marginRight: 5 },
  serviceText: { color: "#E8E6F6", fontSize: 11, fontWeight: "600" },
  statusCard: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(255,255,255,0.13)", borderColor: "rgba(255,255,255,0.12)", borderRadius: 14, borderWidth: 1, bottom: 82, flexDirection: "row", maxWidth: 296, paddingHorizontal: 12, paddingVertical: 11, position: "absolute" },
  statusDot: { backgroundColor: colors.mint, borderRadius: 8, height: 14, marginRight: 6, shadowColor: colors.mint, shadowOpacity: 0.9, shadowRadius: 8, width: 14 },
  statusText: { color: colors.white, flexShrink: 1, fontSize: 12 },
  serving: { bottom: 55, color: "#D8D4F4", fontSize: 9, fontWeight: "700", letterSpacing: 0.8, position: "absolute", textAlign: "center", width: "100%" },
  homeIndicator: { backgroundColor: "rgba(255,255,255,0.42)", borderRadius: 3, bottom: 24, height: 4, left: "35%", position: "absolute", width: "30%" },
});
