/**
 * ShopNavbar — bottom tab bar for the shop/staff module.
 *
 * Auto-hides on the shop-login screen (staff don't need navigation until signed in).
 * Tabs: Dashboard · Orders · Stock · Scan
 */

import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const items = [
  {
    icon: "home" as const,
    label: "Dashboard",
    path: "/shop-dashboard",
    route: "/(shop)/shop-dashboard",
  },
  {
    icon: "tags" as const,
    label: "Products",
    path: "/shop-management",
    route: "/(shop)/shop-management",
  },
  {
    icon: "list-alt" as const,
    label: "Orders",
    path: "/new-orders",
    route: "/(shop)/new-orders",
  },
  {
    icon: "cube" as const,
    label: "Stock",
    path: "/stock-update",
    route: "/(shop)/stock-update",
  },
  {
    icon: "qrcode" as const,
    label: "Scan",
    path: "/qr-verification",
    route: "/(shop)/qr-verification",
  },
];

/** Paths on which the navbar is hidden entirely. */
const HIDDEN_PATHS = ["/login"];

export function ShopNavbar() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((p) => pathname.endsWith(p))) return null;

  return (
    <View style={styles.shell}>
      <View style={styles.navbar}>
        {items.map((item) => {
          const active = pathname.endsWith(item.path);
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              key={item.path}
              onPress={() => router.replace(item.route as never)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
                <FontAwesome
                  color={active ? colors.mint : "rgba(255,255,255,0.4)"}
                  name={item.icon}
                  size={20}
                />
              </View>
              <Text style={[styles.label, active && styles.activeLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    bottom: 0,
    left: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
  },
  navbar: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.nightSoft,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 6,
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  item: { alignItems: "center", flex: 1, paddingBottom: 8, paddingTop: 2 },
  pressed: { opacity: 0.6 },
  iconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 30,
    justifyContent: "center",
    width: 44,
  },
  activeIconWrap: { backgroundColor: colors.nightSoft },
  label: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 2,
  },
  activeLabel: { color: colors.mint },
});
