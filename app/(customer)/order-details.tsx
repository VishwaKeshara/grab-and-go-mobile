import { ActionButton, Card, ErrorText, InfoRow, LinkButton, OrderPage, PriceSummary, ProductLine, SectionTitle, StatusBadge, StatusTimeline, money, preferenceText, prettySlot } from "@/components/OrderUI";
import { OrderActionDialog, type OrderDialogContent } from "@/components/OrderActionDialog";
import { colors } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { callShop } from "@/services/shopContactService";
import type { Order } from "@/types/order";
import { shopTelUrl } from "@/utils/shopPhone";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

function addMoreUnavailableReason(order: Order): string | null {
  if (order.status === "cancelled") return "Cancelled orders cannot be changed.";
  if (order.status === "collected") return "This order has already been collected.";
  if (order.status !== "placed") return "The shop has started this order, so more items cannot be added.";
  if (order.draft.paymentMethod !== "pickup") return "Only Pay at Pickup orders can have items added.";
  if (order.paymentStatus !== "pay_at_pickup") return "This order is no longer awaiting payment at pickup.";
  return null;
}

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, loading, error: ordersError, alternatives, changeStatus, reloadOrders, reorder } = useOrders();
  const [dialog, setDialog] = useState<OrderDialogContent | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [calling, setCalling] = useState(false);
  const cancelInFlight = useRef(false);
  useEffect(() => { void reloadOrders(); }, [reloadOrders]);
  const order = orders.find(value => value.id === id);
  if (!order) return <OrderPage title="Order details" back={() => router.back()}><ErrorText message={ordersError} /><Card><Text style={styles.empty}>{loading ? "Loading order details…" : "We couldn't find this order."}</Text><LinkButton label="My orders" onPress={() => router.replace("/(customer)/my-orders")} /></Card></OrderPage>;
  const canCancel = order.status === "placed" || order.status === "accepted";
  const addMoreReason = addMoreUnavailableReason(order);
  const canAddMore = addMoreReason === null;
  const openAddMore = () => router.push({ pathname: "/(customer)/add-more-items", params: { id: order.id } });
  const cancelConfirmed = async () => {
    if (cancelInFlight.current) return;
    if (!canCancel) {
      setDialog({ tone: "info", title: "Order status changed", message: "This order can no longer be cancelled. Check its latest status before trying again." });
      return;
    }
    cancelInFlight.current = true;
    setCancelling(true);
    try {
      await changeStatus(order.id, "cancelled");
      setDialog({ tone: "success", title: "Order cancelled", message: "Your order has been cancelled. You can still find it in My Orders." });
    } catch (cause) {
      const changed = cause instanceof Error && /no longer be cancelled/i.test(cause.message);
      setDialog({ tone: "error", title: "Could not cancel order", message: changed ? "The shop has started preparing this order, so it can no longer be cancelled. Check its latest status." : "Your order was not cancelled. Please check your connection and try again." });
      if (changed) void reloadOrders();
    } finally {
      cancelInFlight.current = false;
      setCancelling(false);
    }
  };
  const cancel = () => {
    if (cancelInFlight.current || !canCancel) return;
    setDialog({ tone: "confirm", title: "Cancel this order?", message: "The shop will no longer prepare your basket. This action cannot be undone." });
  };
  const contact = async () => {
    if (calling) return;
    const phone = order.shop.phone;
    if (!phone?.trim()) {
      setDialog({ tone: "info", title: "Phone number unavailable", message: `${order.shop.name} has not shared a phone number yet. Please ask at the pickup counter.` });
      return;
    }
    const url = shopTelUrl(phone);
    if (!url) {
      setDialog({ tone: "info", title: "Phone number unavailable", message: "This shop's phone number could not be used. Please ask at the pickup counter for a current number." });
      return;
    }
    setCalling(true);
    setDialog(null);
    try {
      const notice = await callShop(phone);
      if (notice) setDialog({ tone: "info", title: "Call the shop", message: notice });
    } catch {
      setDialog({ tone: "error", title: "Could not open the dialer", message: `Your device could not open a phone app. You can call ${url.slice(4)} from a phone instead.` });
    } finally {
      setCalling(false);
    }
  };
  return <><OrderPage title="Order details" eyebrow={order.reference} back={() => router.back()} footer={<View style={styles.footerActions}>{canAddMore ? <LinkButton label="Add more items" icon="plus-circle" onPress={openAddMore} /> : <Text style={styles.footerNote}>Add more items: {addMoreReason}</Text>}{order.status !== "cancelled" && order.status !== "collected" ? <ActionButton label="Track this order" icon="arrow-right" onPress={() => router.push({ pathname: "/(customer)/order-tracking", params: { id: order.id } })} /> : <ActionButton label="Reorder items" icon="repeat" onPress={() => { reorder(order); router.push("/(customer)/cart"); }} />}</View>}>
    <Card dark><Text style={styles.darkLabel}>ORDER REFERENCE</Text><Text style={styles.reference}>{order.reference}</Text><Text style={styles.darkMeta}>Placed {new Date(order.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</Text><View style={styles.badgeWrap}><StatusBadge status={order.status} /></View></Card>
    <SectionTitle title="Pickup and payment" />
    <Card><InfoRow icon="shopping-basket" label="Shop" value={order.shop.name} /><InfoRow icon="map-marker" label="Pickup point" value={`${order.shop.counter}, ${order.shop.address}`} /><InfoRow icon="calendar" label="Pickup window" value={prettySlot(order.draft.pickupSlot)} /><InfoRow icon="credit-card" label="Payment status" value={order.paymentStatus === "pay_at_pickup" ? "Pay at pickup" : order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "failed" ? "Payment failed" : "Demo · no payment collected"} /></Card>
    <SectionTitle title={`Items · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} units`} />
    <Card>{order.items.map(item => <ProductLine key={item.id} item={item} detail={`Substitution: ${preferenceText(item.substitution, alternatives[item.product.id])}`} />)}</Card>
    <SectionTitle title="Customer details" />
    <Card><InfoRow icon="user" label="Name" value={order.draft.customerName} /><InfoRow icon="phone" label="Mobile" value={order.draft.phone} /><InfoRow icon="road" label="Travelling by" value={order.draft.travelMethod === "car" ? "Car or tuk" : order.draft.travelMethod === "motorcycle" ? "Motorcycle" : "Walking"} /><InfoRow icon="sticky-note-o" label="Packing instructions" value={order.draft.packingInstructions || "No special instructions"} /></Card>
    <PriceSummary subtotal={order.subtotal} savings={order.savings} fee={order.serviceFee} />
    <StatusTimeline status={order.status} />
    <LinkButton label={`Contact ${order.shop.name}`} icon="phone" loading={calling} onPress={() => { void contact(); }} />
    {canCancel ? <LinkButton label="Cancel order" icon="times-circle" loading={cancelling} onPress={cancel} /> : null}
    <Text style={styles.totalNote}>Order total: {money(order.total)}</Text>
  </OrderPage><OrderActionDialog dialog={dialog} onClose={() => setDialog(null)} primaryLabel={dialog?.tone === "confirm" ? "Cancel Order" : "Got it"} onPrimary={dialog?.tone === "confirm" ? () => { void cancelConfirmed(); } : undefined} secondaryLabel={dialog?.tone === "confirm" ? "Keep Order" : undefined} busy={cancelling} destructive={dialog?.tone === "confirm"} /></>;
}
const styles = StyleSheet.create({ footerActions: { gap: 10 }, footerNote: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" }, darkLabel: { color: colors.mint, fontSize: 12, fontWeight: "600", letterSpacing: 1 }, reference: { color: colors.white, fontSize: 23, fontWeight: "700", marginTop: 7 }, darkMeta: {fontWeight: "400", color: "#D1D5DB", fontSize: 12, marginTop: 7 }, badgeWrap: { marginTop: 14 }, empty: {fontWeight: "400", color: colors.muted, fontSize: 13, marginBottom: 12 }, totalNote: {fontWeight: "400", color: colors.muted, fontSize: 12, textAlign: "center", marginBottom: 5 } });
