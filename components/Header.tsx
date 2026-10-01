import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const focusedPaths = [
  "/cart",
  "/checkout",
  "/notifications",
  "/my-orders",
  "/order-confirmation",
  "/order-details",
  "/order-tracking",
  "/payment",
  "/pickup-schedule",
  "/product-details",
  "/profile",
  "/substitute-selection",
];

export function Header() {
  const pathname = usePathname();

  if (focusedPaths.some((path) => pathname.endsWith(path))) return null;

  return (
    <View style={styles.header}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>▣</Text>
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.eyebrow}>GRAB &amp; GO</Text>
        <View style={styles.locationRow}>
          <View style={styles.liveDot} />
          <Text style={styles.location}>Malabe Bazaar Hub</Text>
          <Text style={styles.chevron}>⌄</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Notifications"
        onPress={() => router.push("/(customer)/notifications")}
        style={styles.iconButton}
      >
        <FontAwesome color={colors.ink} name="bell-o" size={16} />
        <View style={styles.badge} />
      </Pressable>
      <Pressable
        accessibilityLabel="Profile"
        onPress={() => router.push("/(customer)/profile")}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>DP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderBottomColor: "#ECEBF4",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  brandMarkText: { color: colors.mint, fontSize: 19 },
  brandCopy: { flex: 1, marginLeft: 10 },
  eyebrow: {
    color: "#07856A",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  locationRow: { alignItems: "center", flexDirection: "row", marginTop: 3 },
  liveDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 8,
    marginRight: 5,
    width: 8,
  },
  location: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  chevron: { color: colors.muted, fontSize: 14, marginLeft: 4, marginTop: -3 },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#EEF0FF",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginRight: 8,
    width: 36,
  },
  badge: {
    backgroundColor: colors.coral,
    borderColor: colors.paper,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: 7,
    top: 6,
    width: 10,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
});
