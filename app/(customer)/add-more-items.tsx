import { ActionButton, Card, ErrorText, LinkButton, OrderPage, SectionTitle, money, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { newCheckoutId } from "@/services/cartService";
import { loadAddableOrderProducts } from "@/services/orderService";
import type { AddableOrderProduct } from "@/types/order";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

function additionMessage(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  const raw = (cause as { message?: unknown } | null)?.message;
  const message = typeof raw === "string" ? raw : "";
  if (/may have saved|could not be refreshed/i.test(message)) return "We could not confirm the latest order. Retry this selection to check safely.";
  if (/can no longer accept|unpaid pickup payment/i.test(message)) return "This order can no longer accept more items. Check its latest status in Order Details.";
  if (/selected product is unavailable|quantity/i.test(message)) return "One or more products are no longer available in that quantity. Adjust your selection and try again.";
  if (/pickup time is too close|pickup.*unavailable/i.test(message)) return "The pickup time is too close or unavailable. Please contact the shop about this order.";
  if (/prices changed/i.test(message)) return "A product price changed. Review the latest prices and try again.";
  if (/order total changed/i.test(message)) return "Your order total changed. Refresh and review the new total before adding items.";
  if (/sign in as a customer|sign in to add/i.test(message)) return "Sign in to add items to your order.";
  if (/order not found/i.test(message)) return "This order could not be found for your account.";
  if (/already used/i.test(message)) return "This request was already used. Review the order before trying again.";
  if (code === "PGRST202") return "Adding items is not available yet. Please try again later.";
  return "We could not add these items. Check your connection and retry this selection.";
}

export default function AddMoreItems() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, reloadOrders, addMoreItems } = useOrders();
  const order = orders.find(value => value.id === id);
  const orderId = order?.id;
  const [catalog, setCatalog] = useState<AddableOrderProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const requestId = useRef(newCheckoutId());
  const savingRef = useRef(false);

  useEffect(() => { void reloadOrders(); }, [reloadOrders]);
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    loadAddableOrderProducts(orderId).then((products: AddableOrderProduct[]) => {
      if (active) { setCatalog(products); setLoadedOrderId(orderId); setError(""); }
    }).catch(() => {
      if (active) { setCatalog([]); setLoadedOrderId(orderId); setError("Products could not be loaded. Check your connection and try again."); }
    }).finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, [orderId]);

  const eligible = order?.status === "placed" && order.draft.paymentMethod === "pickup"
    && order.paymentStatus === "pay_at_pickup";
  const productsReady = !!order && !loadingProducts && loadedOrderId === order.id;
  const selected: AddableOrderProduct[] = catalog.filter((item: AddableOrderProduct) =>
    (quantities[item.product.id] ?? 0) > 0);
  const selectedUnavailable = selected.some(item => quantities[item.product.id] > item.stock);
  const addedCost = selected.reduce((sum, item) => sum + item.product.price * quantities[item.product.id], 0);
  const refreshProducts = async () => {
    if (!order || outcomeUnknown || savingRef.current) return;
    setLoadingProducts(true);
    try {
      const latest: AddableOrderProduct[] = await loadAddableOrderProducts(order.id);
      const currentIds = new Set(latest.map(item => item.product.id));
      setCatalog(previous => [...latest, ...previous.filter(item =>
        (quantities[item.product.id] ?? 0) > 0 && !currentIds.has(item.product.id))
        .map(item => ({ ...item, stock: 0 }))]);
      setLoadedOrderId(order.id);
      requestId.current = newCheckoutId();
      setError("");
      await reloadOrders();
    } catch {
      setError("Products could not be refreshed. Keep your selection and try again.");
    } finally { setLoadingProducts(false); }
  };
  const changeQuantity = (productId: string, delta: number, stock: number) => {
    if (savingRef.current || outcomeUnknown) return;
    requestId.current = newCheckoutId();
    setError("");
    setQuantities(previous => ({ ...previous,
      [productId]: Math.max(0, Math.min(stock, 99, (previous[productId] ?? 0) + delta)),
    }));
  };
  const confirm = async () => {
    if (!order || !eligible || !selected.length || selectedUnavailable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await addMoreItems(order.id, requestId.current, selected.map(item => ({
        productId: item.product.id, quantity: quantities[item.product.id],
      })), addedCost, order.total);
      router.replace({ pathname: "/(customer)/order-details", params: { id: order.id } });
    } catch (cause) {
      setError(additionMessage(cause));
      // A failed refresh or transport error may follow a successful commit.
      // Keep the payload and request ID fixed so a retry cannot add it twice.
      const code = (cause as { code?: unknown } | null)?.code;
      if (code !== "P0001") setOutcomeUnknown(true);
      void reloadOrders();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!order) return <OrderPage title="Add more items" back={() => router.back()}>
    <Card><Text style={styles.help}>Loading your order, or it is not available for this account.</Text>
      <LinkButton label="My orders" onPress={() => router.replace("/(customer)/my-orders")} /></Card>
  </OrderPage>;
  return <OrderPage title="Add more items" eyebrow={order.reference} back={() => router.back()} footer={
    <View style={styles.footer}><View style={styles.footerTotals}><Text style={styles.footerLabel}>Additional cost</Text><Text style={styles.footerValue}>{money(addedCost)}</Text></View>
      <ActionButton label="Confirm additional items" icon="check" loading={saving} disabled={!eligible || !selected.length || selectedUnavailable || !productsReady} onPress={() => { void confirm(); }} /></View>
  }>
    <Card dark><Text style={styles.shop}>{order.shop.name}</Text><Text style={styles.shopMeta}>Pickup {prettySlot(order.draft.pickupSlot)}</Text></Card>
    {!eligible ? <Card><Text style={styles.help}>This order can no longer accept more items. Only placed orders paid at pickup are eligible.</Text></Card> : null}
    {outcomeUnknown ? <Card><Text style={styles.help}>Keep this selection while we confirm the last request. You can retry safely with the same request.</Text></Card> : null}
    <ErrorText message={error} />
    {error && !outcomeUnknown ? <LinkButton label="Refresh product prices and stock" icon="refresh" loading={loadingProducts} onPress={() => { void refreshProducts(); }} /> : null}
    {selectedUnavailable ? <Card><Text style={styles.help}>A selected quantity is no longer available. Reduce it before confirming.</Text></Card> : null}
    <SectionTitle title="Choose from this shop" />
    {!productsReady ? <Card><ActivityIndicator color={colors.ink} /><Text style={styles.help}>Loading available products…</Text></Card> : catalog.length ? catalog.map(({ product, stock }) => {
      const quantity = quantities[product.id] ?? 0;
      return <Card key={product.id}><View style={styles.productRow}>
        <Image source={product.image} contentFit="cover" accessibilityLabel={product.name} style={styles.image} />
        <View style={styles.productCopy}><Text style={styles.name}>{product.name}</Text><Text style={styles.meta}>{product.unit} · {money(product.price)}</Text><Text style={styles.stock}>{stock} available</Text></View>
      </View><View style={styles.quantityRow}><Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`} accessibilityState={{ disabled: !eligible || quantity === 0 || saving || outcomeUnknown }} disabled={!eligible || quantity === 0 || saving || outcomeUnknown} onPress={() => changeQuantity(product.id, -1, stock)} style={styles.step}><FontAwesome name="minus" color={colors.ink} size={13} /></Pressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`} accessibilityState={{ disabled: !eligible || quantity >= Math.min(stock, 99) || saving || outcomeUnknown }} disabled={!eligible || quantity >= Math.min(stock, 99) || saving || outcomeUnknown} onPress={() => changeQuantity(product.id, 1, stock)} style={styles.step}><FontAwesome name="plus" color={colors.ink} size={13} /></Pressable>
        </View>
      </View></Card>;
    }) : <Card><Text style={styles.help}>No additional products are available from this shop right now.</Text><LinkButton label="Retry loading products" onPress={() => { void refreshProducts(); }} /></Card>}
    <SectionTitle title="Review your addition" />
    <Card><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Current order</Text><Text style={styles.summaryValue}>{money(order.total)}</Text></View>
      <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Additional items</Text><Text style={styles.summaryValue}>{money(addedCost)}</Text></View>
      <View style={styles.rule} /><View style={styles.summaryRow}><Text style={styles.totalLabel}>New total</Text><Text style={styles.totalLabel}>{money(order.total + addedCost)}</Text></View>
      <Text style={styles.note}>Prices and stock are checked again when you confirm. Your original item prices stay as they were.</Text></Card>
  </OrderPage>;
}

const styles = StyleSheet.create({
  footer: { gap: 10 }, footerTotals: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, footerValue: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  shop: { color: colors.white, fontSize: 16, fontWeight: "800" }, shopMeta: { color: "#D8D6E8", fontSize: 11, marginTop: 6 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 70 },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  quantityLabel: { color: colors.muted, fontSize: 11 },
  image: { width: 58, height: 58, borderRadius: 12, backgroundColor: colors.lilac },
  productCopy: { flex: 1, minWidth: 0 }, name: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4 }, stock: { color: "#07856A", fontSize: 10, marginTop: 3 },
  stepper: { flexDirection: "row", alignItems: "center" }, step: { width: 40, height: 44, alignItems: "center", justifyContent: "center", borderColor: colors.line, borderWidth: 1, borderRadius: 10 },
  quantity: { minWidth: 26, textAlign: "center", color: colors.ink, fontSize: 13, fontWeight: "800" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }, summaryLabel: { color: colors.muted, fontSize: 12 },
  summaryValue: { color: colors.ink, fontSize: 12, fontWeight: "700" }, totalLabel: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 8 }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 9 },
});
