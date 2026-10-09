import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { FontAwesome } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function CartHeaderButton() {
  const { totals, openCartSheet } = useCart();
  const count = totals.units;

  return (
    <Pressable
      accessibilityLabel={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
      accessibilityRole="button"
      onPress={openCartSheet}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <FontAwesome color={colors.ink} name="shopping-basket" size={17} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginRight: 4,
    width: 44,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderColor: colors.paper,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 17,
    paddingHorizontal: 3,
    position: "absolute",
    right: -3,
    top: -5,
  },
  badgeText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  pressed: { opacity: 0.68 },
});
