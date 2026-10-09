import { money } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import type { CartItem } from "@/types/cart";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function CartSheet() {
  const { cart, totals, loading, shop, cartSheetOpen, closeCartSheet, setQuantity, removeItem } = useCart();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const goToCart = () => {
    closeCartSheet();
    if (!pathname.endsWith("/cart")) router.push("/(customer)/cart");
  };
  const goToCheckout = () => {
    if (!cart.length) return;
    closeCartSheet();
    router.push("/(customer)/substitute-selection");
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={closeCartSheet}
      presentationStyle="overFullScreen"
      transparent
      visible={cartSheetOpen}
    >
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close cart preview" accessibilityRole="button" onPress={closeCartSheet} style={styles.backdrop} />
        <View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>YOUR BASKET · {(shop?.name ?? "GRAB & GO").toUpperCase()}</Text>
              <Text style={styles.title}>Cart preview</Text>
              <Text style={styles.count}>{totals.units} {totals.units === 1 ? "item" : "items"} · {totals.count} {totals.count === 1 ? "product" : "products"}</Text>
            </View>
            <Pressable accessibilityLabel="Close cart preview" accessibilityRole="button" onPress={closeCartSheet} style={styles.close}>
              <FontAwesome color={colors.ink} name="times" size={15} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={[styles.list, { maxHeight: height * 0.43 }]}
          >
            {loading ? <Text style={styles.emptyCopy}>Loading your cart…</Text> : cart.length ? cart.map(item => (
              <CartSheetItem
                item={item}
                key={item.product.id}
                onDecrease={() => item.quantity === 1 ? removeItem(item.product.id) : setQuantity(item.product.id, item.quantity - 1)}
                onIncrease={() => setQuantity(item.product.id, item.quantity + 1)}
                onRemove={() => removeItem(item.product.id)}
              />
            )) : <View style={styles.empty}><FontAwesome color={colors.muted} name="shopping-basket" size={27} /><Text style={styles.emptyTitle}>Your basket is empty</Text><Text style={styles.emptyCopy}>Add a fresh pick to get started.</Text></View>}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.subtotalRow}><Text style={styles.subtotalLabel}>Subtotal</Text><Text style={styles.subtotal}>{money(totals.subtotal)}</Text></View>
            <Pressable accessibilityLabel="Continue shopping" accessibilityRole="button" onPress={closeCartSheet} style={styles.continueButton}><Text style={styles.continueText}>Continue Shopping</Text></Pressable>
            <View style={styles.actionRow}>
              <Pressable accessibilityLabel="View full cart" accessibilityRole="button" onPress={goToCart} style={styles.viewButton}><Text style={styles.viewText}>View Cart</Text></Pressable>
              <Pressable accessibilityLabel="Checkout" accessibilityRole="button" accessibilityState={{ disabled: !cart.length || loading }} disabled={!cart.length || loading} onPress={goToCheckout} style={[styles.checkoutButton, (!cart.length || loading) && styles.disabled]}><Text style={styles.checkoutText}>Checkout</Text><FontAwesome color={colors.white} name="arrow-right" size={13} /></Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CartSheetItem({ item, onDecrease, onIncrease, onRemove }: { item: CartItem; onDecrease: () => void; onIncrease: () => void; onRemove: () => void }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <Image accessibilityLabel={item.product.name} contentFit="cover" source={item.product.image} style={styles.image} />
        <View style={styles.itemCopy}>
          <Text numberOfLines={2} style={styles.productName}>{item.product.name}</Text>
          <Text style={styles.unit}>{item.product.unit}</Text>
          <Text style={styles.price}>{money(item.product.price)} each</Text>
        </View>
        <Pressable accessibilityLabel={`Remove ${item.product.name}`} accessibilityRole="button" onPress={onRemove} style={styles.remove}><FontAwesome color={colors.coral} name="trash-o" size={18} /></Pressable>
      </View>
      <View style={styles.itemBottom}>
        <Text style={styles.lineTotal}>{money(item.product.price * item.quantity)}</Text>
        <View style={styles.quantity}>
          <Pressable accessibilityLabel={`Decrease ${item.product.name} quantity`} accessibilityRole="button" onPress={onDecrease} style={styles.quantityButton}><FontAwesome color={colors.ink} name="minus" size={12} /></Pressable>
          <Text accessibilityLabel={`${item.quantity} in cart`} style={styles.quantityText}>{item.quantity}</Text>
          <Pressable accessibilityLabel={`Increase ${item.product.name} quantity`} accessibilityRole="button" onPress={onIncrease} style={styles.quantityButton}><FontAwesome color={colors.ink} name="plus" size={12} /></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(17,24,39, 0.48)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 9, width: "100%" },
  handle: { alignSelf: "center", backgroundColor: "#D1D5DB", borderRadius: 3, height: 5, width: 38 },
  heading: { alignItems: "center", flexDirection: "row", paddingTop: 17, paddingBottom: 13 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#15803D", fontSize: 12, fontWeight: "600", letterSpacing: 0.8 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700", marginTop: 3 },
  count: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 13, borderWidth: 1, height: 44, justifyContent: "center", marginLeft: 10, width: 44 },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingBottom: 6 },
  item: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 17, borderWidth: 1, marginBottom: 10, padding: 12 },
  itemTop: { alignItems: "center", flexDirection: "row" },
  image: { backgroundColor: colors.lilac, borderRadius: 12, height: 60, width: 60 },
  itemCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
  productName: { color: colors.ink, fontSize: 15, fontWeight: "500" },
  unit: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 },
  price: { color: colors.ink, fontSize: 16, fontWeight: "700", marginTop: 5 },
  remove: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  itemBottom: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  lineTotal: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  quantity: { alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row" },
  quantityButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  quantityText: { color: colors.ink, fontSize: 13, fontWeight: "600", minWidth: 24, textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 25 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600", marginTop: 10 },
  emptyCopy: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: "center" },
  footer: { borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 12 },
  subtotalRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  subtotalLabel: {fontWeight: "400", color: colors.muted, fontSize: 13 },
  subtotal: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  continueButton: { alignItems: "center", borderColor: colors.line, borderRadius: 13, borderWidth: 1, justifyContent: "center", minHeight: 48, backgroundColor: colors.white },
  continueText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 9 },
  viewButton: { alignItems: "center", backgroundColor: colors.mintSoft, borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 50 },
  viewText: { color: "#15803D", fontSize: 13, fontWeight: "600" },
  checkoutButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 13, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 50 },
  checkoutText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
