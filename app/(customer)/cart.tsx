import {
  ActionButton,
  Card,
  ErrorText,
  OrderPage,
  PriceSummary,
  ProductLine,
  SectionTitle,
  ShopCard,
  money,
  preferenceText,
} from "@/components/OrderUI";
import { OrderActionDialog } from "@/components/OrderActionDialog";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Cart() {
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const {
    cart,
    totals,
    loading,
    error,
    shop,
    products,
    alternatives,
    setQuantity,
    removeItem,
    addItem,
    clearCart,
  } = useCart();
  const confirmClear = () => setClearConfirmationOpen(true);
  const clearConfirmed = () => {
    setClearConfirmationOpen(false);
    clearCart();
  };
  return (
    <>
    <OrderPage
      title="Your cart"
      eyebrow={`${totals.units} ITEMS READY TO GO`}
      back={() => router.back()}
      footer={
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.total}>{money(totals.subtotal)}</Text>
          </View>

          <ActionButton
            label="Choose substitutions"
            icon="arrow-right"
            disabled={!cart.length || loading}
            onPress={() =>
              router.push("/(customer)/substitute-selection")
            }
          />
        </>
      }
    >
      <ErrorText message={error} />

      <ShopCard shop={shop} />

      <SectionTitle
        title={`Your basket · ${totals.count} products`}
        action={cart.length ? "Clear cart" : undefined}
        onAction={confirmClear}
      />

      {loading ? (
        <Text style={styles.empty}>Loading your cart…</Text>
      ) : cart.length ? (
        <Card>
          {cart.map((item) => (
            <View key={item.product.id} style={styles.item}>
              <ProductLine
                item={item}
                detail={preferenceText(
                  item.substitution,
                  alternatives[item.product.id],
                )}
              />

              <View style={styles.controls}>
                <Pressable
                  accessibilityLabel={`Remove ${item.product.name}`}
                  accessibilityRole="button"
                  onPress={() => removeItem(item.product.id)}
                  style={styles.remove}
                >
                  <FontAwesome
                    name="trash-o"
                    color={colors.coral}
                    size={17}
                  />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>

                <View style={styles.quantity}>
                  <Pressable
                    accessibilityLabel={`Decrease ${item.product.name} quantity`}
                    accessibilityRole="button"
                    onPress={() =>
                      item.quantity === 1
                        ? removeItem(item.product.id)
                        : setQuantity(
                            item.product.id,
                            item.quantity - 1,
                          )
                    }
                    style={styles.quantityButton}
                  >
                    <FontAwesome
                      name="minus"
                      color={colors.ink}
                      size={12}
                    />
                  </Pressable>

                  <Text style={styles.quantityText}>
                    {item.quantity}
                  </Text>

                  <Pressable
                    accessibilityLabel={`Increase ${item.product.name} quantity`}
                    accessibilityRole="button"
                    onPress={() =>
                      setQuantity(
                        item.product.id,
                        item.quantity + 1,
                      )
                    }
                    style={styles.quantityButton}
                  >
                    <FontAwesome
                      name="plus"
                      color={colors.ink}
                      size={12}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.emptyWrap}>
              <FontAwesome
                name="shopping-basket"
                color={colors.muted}
                size={29}
              />
              <Text style={styles.emptyTitle}>
                Your basket is empty
              </Text>
              <Text style={styles.empty}>
                Add a few fresh picks to start your order.
              </Text>
            </View>
          </Card>

          <SectionTitle title="Fresh picks 🌿" />

          <Card>
            {products.map((product) => (
              <ProductLine
                key={product.id}
                item={{
                  product,
                  quantity: 1,
                  substitution: { type: "call" },
                }}
                trailing={
                  <Pressable
                    accessibilityLabel={`Add ${product.name} to cart`}
                    accessibilityRole="button"
                    onPress={() => addItem(product)}
                    style={styles.add}
                  >
                    <FontAwesome
                      name="plus"
                      color={colors.white}
                      size={13}
                    />
                  </Pressable>
                }
              />
            ))}
          </Card>
        </>
      )}

      {cart.length ? (
        <>
          <Card style={styles.saving}>
            <FontAwesome
              name="tag"
              size={15}
              color={colors.primaryDark}
            />
            <Text style={styles.savingText}>
              You’re saving {money(totals.savings)} on this basket
            </Text>
          </Card>

          <PriceSummary
            subtotal={totals.subtotal}
            savings={totals.savings}
          />
        </>
      ) : null}
    </OrderPage>
    <OrderActionDialog
      dialog={clearConfirmationOpen ? { tone: "confirm", title: "Clear your cart?", message: "All items will be removed from this cart." } : null}
      onClose={() => setClearConfirmationOpen(false)}
      primaryLabel="Clear cart"
      onPrimary={clearConfirmed}
      secondaryLabel="Keep items"
      destructive
    />
    </>
  );
}

const styles = StyleSheet.create({
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  totalLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  total: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  item: {
    paddingBottom: 11,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginBottom: 7,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 7,
  },
  remove: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7 },
  removeText: { color: colors.coral, fontSize: 12, fontWeight: "700" },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  quantityButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: { color: colors.ink, fontWeight: "800" },
  saving: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.mintSoft,
    borderColor: colors.mintSoft,
  },
  savingText: { color: "#15803D", fontSize: 12, fontWeight: "600" },
  emptyWrap: { alignItems: "center", gap: 12, paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  empty: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  add: {
    marginTop: 5,
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
