import { ActionButton, Card, ErrorText, InfoRow, LinkButton, OrderPage, PriceSummary, ProductLine, SectionTitle, StatusBadge, StatusTimeline, money, preferenceText, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { SHOP, alternatives } from "@/services/cartService";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, loading, changeStatus, reorder } = useOrders();
  const [error, setError] = useState("");
  const order = orders.find(value => value.id === id);
  if (!order) return <OrderPage title="Order details" back={() => router.back()}><Card><Text style={styles.empty}>{loading ? "Loading order details…" : "We couldn't find this order."}</Text><LinkButton label="My orders" onPress={() => router.replace("/(customer)/my-orders")} /></Card></OrderPage>;
  const canCancel = order.status === "placed" || order.status === "accepted";
  const cancel = () => Alert.alert("Cancel this order?", "The shop will no longer prepare this basket.", [{ text: "Keep order", style: "cancel" }, { text: "Cancel order", style: "destructive", onPress: () => { changeStatus(order.id, "cancelled").catch(cause => setError(cause instanceof Error ? cause.message : "Could not cancel this order.")); } }]);
  return <OrderPage title="Order details" eyebrow={order.reference} back={() => router.back()} footer={order.status !== "cancelled" && order.status !== "collected" ? <ActionButton label="Track this order" icon="arrow-right" onPress={() => router.push({ pathname: "/(customer)/order-tracking", params: { id: order.id } })} /> : <ActionButton label="Reorder items" icon="repeat" onPress={() => { reorder(order); router.push("/(customer)/cart"); }} />}>
    <ErrorText message={error} />
    <Card dark><Text style={styles.darkLabel}>ORDER REFERENCE</Text><Text style={styles.reference}>{order.reference}</Text><Text style={styles.darkMeta}>Placed {new Date(order.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</Text><View style={styles.badgeWrap}><StatusBadge status={order.status} /></View></Card>
    <SectionTitle title="Pickup and payment" />
    <Card><InfoRow icon="shopping-basket" label="Shop" value={SHOP.name} /><InfoRow icon="map-marker" label="Pickup point" value={`${SHOP.counter}, ${SHOP.address}`} /><InfoRow icon="calendar" label="Pickup window" value={prettySlot(order.draft.pickupSlot)} /><InfoRow icon="credit-card" label="Payment status" value={order.paymentStatus === "pay_at_pickup" ? "Pay at pickup" : "Paid (demo payment)"} /></Card>
    <SectionTitle title={`Items · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} units`} />
    <Card>{order.items.map(item => <ProductLine key={item.product.id} item={item} detail={`Substitution: ${preferenceText(item.substitution, alternatives[item.product.id])}`} />)}</Card>
    <SectionTitle title="Customer details" />
    <Card><InfoRow icon="user" label="Name" value={order.draft.customerName} /><InfoRow icon="phone" label="Mobile" value={order.draft.phone} /><InfoRow icon="road" label="Travelling by" value={order.draft.travelMethod === "car" ? "Car or tuk" : order.draft.travelMethod === "motorcycle" ? "Motorcycle" : "Walking"} /><InfoRow icon="sticky-note-o" label="Packing instructions" value={order.draft.packingInstructions || "No special instructions"} /></Card>
    <PriceSummary subtotal={order.subtotal} savings={order.savings} fee={order.serviceFee} />
    <StatusTimeline status={order.status} />
    <LinkButton label={`Contact ${SHOP.name}`} icon="phone" onPress={() => Alert.alert("Shop contact", "Live shop contact details will be available when ordering is connected to the shop database.")} />
    {canCancel ? <LinkButton label="Cancel order" icon="times-circle" onPress={cancel} /> : null}
    <Text style={styles.totalNote}>Order total: {money(order.total)}</Text>
  </OrderPage>;
}
const styles = StyleSheet.create({ darkLabel: { color: colors.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1 }, reference: { color: colors.white, fontSize: 23, fontWeight: "900", marginTop: 7 }, darkMeta: { color: "#D6D4E8", fontSize: 11, marginTop: 7 }, badgeWrap: { marginTop: 14 }, empty: { color: colors.muted, fontSize: 13, marginBottom: 12 }, totalNote: { color: colors.muted, fontSize: 11, textAlign: "center", marginBottom: 5 } });
