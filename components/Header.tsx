import { colors } from "@/constants/colors";
import { CartHeaderButton } from "@/components/CartHeaderButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const focusedPaths = [
  "/add-more-items",
  "/cart",
  "/category-products",
  "/checkout",
  "/nearby-shops",
  "/notifications",
  "/my-orders",
  "/order-confirmation",
  "/order-details",
  "/order-tracking",
  "/payment",
  "/pickup-schedule",
  "/product-details",
  "/profile",
  "/shop-products",
  "/substitute-selection",
];

export function Header() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      AsyncStorage.getItem(`profile-photo:${id}`).then((uri) => {
        if (active) setPhotoUri(uri);
      });
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  if (focusedPaths.some((path) => pathname.endsWith(path))) return null;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.brandMark}>
        <Image
          accessibilityLabel="Grab And Go logo"
          source={require("../assets/images/grab-and-go-logo.png")}
          style={styles.brandLogo}
        />
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.eyebrow}>GRAB &amp; GO</Text>
        <View style={styles.locationRow}>
          <View style={styles.liveDot} />
          <Text numberOfLines={1} style={styles.location}>Malabe Bazaar Hub</Text>
          <Text style={styles.chevron}>⌄</Text>
        </View>
      </View>
      <CartHeaderButton />
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
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.headerAvatarImage} />
        ) : (
          <Text style={styles.avatarText}>DP</Text>
        )}
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
  brandLogo: { height: 34, width: 34 },
  brandCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
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
  location: { color: colors.ink, flexShrink: 1, fontSize: 11, fontWeight: "700" },
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
  headerAvatarImage: { borderRadius: 18, height: 36, width: 36 },
});
