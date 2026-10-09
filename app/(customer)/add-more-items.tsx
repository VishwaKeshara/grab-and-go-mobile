import { ActionButton, Card, ErrorText, LinkButton, OrderPage, SectionTitle, money, prettySlot } from "@/components/OrderUI";
import { OrderActionDialog, type OrderDialogContent } from "@/components/OrderActionDialog";
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

const PICKUP_PASSED_MESSAGE = "Pickup time has passed. You can’t add more items.";

function localShopTimestamp(value: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(valuePart => valuePart.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

function hasPickupPassed(
  slot: { date: string; start: string } | null,
  timezone: string,
  now: number,
): boolean {
  if (!slot) return false;
  const start = slot.start.length === 5 ? `${slot.start}:00` : slot.start;
  return `${slot.date}T${start}` <= localShopTimestamp(now, timezone);
}

function additionMessage(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  const raw = (cause as { message?: unknown } | null)?.message;
  const message = typeof raw === "string" ? raw : "";
  if (/pickup time has passed/i.test(message)) return PICKUP_PASSED_MESSAGE;
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
  const [additionComplete, setAdditionComplete] = useState(false);
  const [dialog, setDialog] = useState<OrderDialogContent | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const requestId = useRef(newCheckoutId());
  const savingRef = useRef(false);

  useEffect(() => { void reloadOrders(); }, [reloadOrders]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
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
  const pickupPassed = order
    ? hasPickupPassed(order.draft.pickupSlot, order.shop.timezone, clock)
    : false;
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
    if (!order || !eligible || pickupPassed || additionComplete
      || !selected.length || selectedUnavailable || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await addMoreItems(order.id, requestId.current, selected.map(item => ({
        productId: item.product.id, quantity: quantities[item.product.id],
      })), addedCost, order.total);
      setAdditionComplete(true);
      setDialog({
        tone: "success",
        title: "Items added successfully",
        message: "Your additional items and updated order total have been saved.",
      });
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
  return <><OrderPage title="Add more items" eyebrow={order.reference} back={() => router.back()} footer={
    <View style={styles.footer}><View style={styles.footerTotals}><Text style={styles.footerLabel}>Additional cost</Text><Text style={styles.footerValue}>{money(addedCost)}</Text></View>
      <ActionButton label="Confirm additional items" icon="check" loading={saving} disabled={!eligible || pickupPassed || additionComplete || !selected.length || selectedUnavailable || !productsReady} onPress={() => { void confirm(); }} /></View>
  }>
    <Card dark><Text style={styles.shop}>{order.shop.name}</Text><Text style={styles.shopMeta}>Pickup {prettySlot(order.draft.pickupSlot)}</Text></Card>
    {!eligible ? <Card><Text style={styles.help}>This order can no longer accept more items. Only placed orders paid at pickup are eligible.</Text></Card> : null}
    {outcomeUnknown ? <Card><Text style={styles.help}>Keep this selection while we confirm the last request. You can retry safely with the same request.</Text></Card> : null}
    {pickupPassed ? <View accessibilityRole="alert" style={styles.pickupWarning}>
      <View style={styles.pickupWarningIcon}>
        <FontAwesome name="clock-o" size={20} color={colors.error} />
      </View>
      <Text style={styles.pickupWarningText}>{PICKUP_PASSED_MESSAGE}</Text>
    </View> : <ErrorText message={error} />}
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`} accessibilityState={{ disabled: !eligible || pickupPassed || additionComplete || quantity === 0 || saving || outcomeUnknown }} disabled={!eligible || pickupPassed || additionComplete || quantity === 0 || saving || outcomeUnknown} onPress={() => changeQuantity(product.id, -1, stock)} style={styles.step}><FontAwesome name="minus" color={colors.ink} size={13} /></Pressable>
          <Text style={styles.quantity}>{quantity}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`} accessibilityState={{ disabled: !eligible || pickupPassed || additionComplete || quantity >= Math.min(stock, 99) || saving || outcomeUnknown }} disabled={!eligible || pickupPassed || additionComplete || quantity >= Math.min(stock, 99) || saving || outcomeUnknown} onPress={() => changeQuantity(product.id, 1, stock)} style={styles.step}><FontAwesome name="plus" color={colors.ink} size={13} /></Pressable>
        </View>
      </View></Card>;
    }) : <Card><Text style={styles.help}>No additional products are available from this shop right now.</Text><LinkButton label="Retry loading products" onPress={() => { void refreshProducts(); }} /></Card>}
    <SectionTitle title="Review your addition" />
    <Card><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Current order</Text><Text style={styles.summaryValue}>{money(order.total)}</Text></View>
      <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Additional items</Text><Text style={styles.summaryValue}>{money(addedCost)}</Text></View>
      <View style={styles.rule} /><View style={styles.summaryRow}><Text style={styles.totalLabel}>New total</Text><Text style={styles.totalLabel}>{money(order.total + addedCost)}</Text></View>
      <Text style={styles.note}>Prices and stock are checked again when you confirm. Your original item prices stay as they were.</Text></Card>
  </OrderPage><OrderActionDialog
    dialog={dialog}
    onClose={() => setDialog(null)}
    primaryLabel="View Order"
    onPrimary={() => router.replace({ pathname: "/(customer)/order-details", params: { id: order.id } })}
  /></>;
}

const styles = StyleSheet.create({
  footer: { gap: 10 }, footerTotals: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, footerValue: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  shop: { color: colors.white, fontSize: 16, fontWeight: "600" }, shopMeta: {fontWeight: "400", color: "#D1D5DB", fontSize: 12, marginTop: 6 },
  help: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  pickupWarning: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEE2E2", borderRadius: 16, borderColor: "#FEE2E2", borderWidth: 1, paddingHorizontal: 15, paddingVertical: 14 },
  pickupWarningIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FEE2E2" },
  pickupWarningText: { flex: 1, color: "#DC2626", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 70 },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  quantityLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  image: { width: 58, height: 58, borderRadius: 12, backgroundColor: colors.lilac },
  productCopy: { flex: 1, minWidth: 0 }, name: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  meta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 }, stock: {fontWeight: "400", color: "#15803D", fontSize: 12, marginTop: 3 },
  stepper: { flexDirection: "row", alignItems: "center" }, step: { width: 40, height: 44, alignItems: "center", justifyContent: "center", borderColor: colors.line, borderWidth: 1, borderRadius: 10 },
  quantity: { minWidth: 26, textAlign: "center", color: colors.ink, fontSize: 13, fontWeight: "600" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }, summaryLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  summaryValue: { color: colors.ink, fontSize: 12, fontWeight: "700" }, totalLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 8 }, note: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 9 },
});
