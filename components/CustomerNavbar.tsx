import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const items = [
  { icon: "home", label: "Home", path: "/home" },
  { icon: "search", label: "Search", path: "/search" },
  { icon: "list-alt", label: "Orders", path: "/my-orders" },
  { icon: "user", label: "Profile", path: "/profile" },
] as const;

const hiddenPaths = [
  "/cart",
  "/checkout",
  "/order-confirmation",
  "/order-details",
  "/order-tracking",
  "/payment",
  "/pickup-schedule",
  "/product-details",
  "/substitute-selection",
];

export function CustomerNavbar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (hiddenPaths.some((path) => pathname.endsWith(path))) return null;

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.navbar}>
        {items.map((item) => {
          const active = pathname.endsWith(item.path);
          return (
            <Pressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              key={item.path}
              onPress={() => router.replace(item.path as never)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
                <FontAwesome
                  color={active ? colors.white : "#8B899B"}
                  name={item.icon}
                  size={17}
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    position: "absolute",
    right: 0,
  },
  navbar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderColor: "#E5E4EF",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 9,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 7,
    paddingTop: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  item: { alignItems: "center", flex: 1, minHeight: 50 },
  pressed: { opacity: 0.65 },
  iconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 28,
    justifyContent: "center",
    width: 42,
  },
  activeIconWrap: { backgroundColor: colors.ink },
  label: { color: "#8B899B", fontSize: 9, fontWeight: "700", marginTop: 3 },
  activeLabel: { color: colors.ink },
});
