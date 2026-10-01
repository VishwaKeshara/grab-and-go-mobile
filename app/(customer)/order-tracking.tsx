import { ActionButton, Card, ErrorText, InfoRow, LinkButton, OrderPage, SectionTitle, StatusBadge, StatusTimeline, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { SHOP } from "@/services/cartService";
import type { OrderStatus } from "@/types/order";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

const next: Partial<Record<OrderStatus, OrderStatus>> = { placed: "accepted", accepted: "packing", packing: "ready", ready: "collected" };
export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, loading, changeStatus } = useOrders();
  const [qrFailed, setQrFailed] = useState(false);
  const [error, setError] = useState("");
  const order = orders.find(value => value.id === id);
  if (!order) return <OrderPage title="Order tracking" back={() => router.back()}><Card><Text style={styles.missing}>{loading ? "Loading tracking…" : "This order could not be found."}</Text><LinkButton label="My orders" onPress={() => router.replace("/(customer)/my-orders")} /></Card></OrderPage>;
  const qrData = `GRABGO:${order.reference}:${order.pin}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}`;
  const advance = async () => { const status = next[order.status]; if (!status) return; try { await changeStatus(order.id, status); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update demo status."); } };
  return <OrderPage title="Order tracking" eyebrow="LIVE ORDER PASS" back={() => router.back()} footer={<ActionButton label="View order details" icon="arrow-right" onPress={() => router.push({ pathname: "/(customer)/order-details", params: { id: order.id } })} />}>
    <ErrorText message={error} />
    <Card dark><View style={styles.passTop}><Text style={styles.passLabel}>GRAB & GO · PICKUP PASS</Text><FontAwesome name="shopping-basket" color={colors.mint} size={19} /></View><Text style={styles.reference}>{order.reference}</Text><Text style={styles.passMeta}>{SHOP.name} · {SHOP.counter}</Text><Text style={styles.passMeta}>{prettySlot(order.draft.pickupSlot)}</Text><View style={styles.qrWrap}>{qrFailed ? <Text style={styles.qrFallback}>QR unavailable.{"\n"}Use your pickup PIN below.</Text> : <Image source={qrUrl} accessibilityLabel={`Pickup QR code for ${order.reference}`} contentFit="contain" onError={() => setQrFailed(true)} style={styles.qr} />}</View><Text style={styles.pinLabel}>PICKUP PIN</Text><Text style={styles.pin}>{order.pin}</Text></Card>
    <View style={styles.statusRow}><SectionTitle title="Order status" /><StatusBadge status={order.status} /></View>
    <StatusTimeline status={order.status} />
    <Card><InfoRow icon="clock-o" label="Preparation" value={`Usually about ${SHOP.prepMinutes} minutes`} /><InfoRow icon="map-marker" label="Where to collect" value={`${SHOP.counter}, ${SHOP.address}`} /><InfoRow icon="phone" label="Shop phone" value={SHOP.phone} /><Text style={styles.instructions}>Show the QR code or PIN at the counter. Have your payment ready if you chose pay at pickup.</Text></Card>
    <LinkButton label="Contact the shop" icon="phone" onPress={() => Alert.alert("Shop contact", "Live shop contact details will be available when ordering is connected to the shop database.")} />
    {order.status !== "cancelled" && order.status !== "collected" ? <Card><Text style={styles.demoTitle}>Demo status simulation</Text><Text style={styles.demoCopy}>The live shop status integration is not connected yet. Advance this demo order to preview each state.</Text><ActionButton label={order.status === "ready" ? "Mark collected (demo)" : `Advance to ${next[order.status] === "ready" ? "ready for pickup" : next[order.status]} (demo)`} light onPress={advance} /></Card> : null}
  </OrderPage>;
}
const styles = StyleSheet.create({ passTop: { flexDirection: "row", justifyContent: "space-between" }, passLabel: { color: colors.mint, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, reference: { color: colors.white, fontSize: 25, fontWeight: "900", marginTop: 10 }, passMeta: { color: "#DDDCEC", fontSize: 11, marginTop: 6 }, qrWrap: { width: 182, height: 182, backgroundColor: colors.white, alignSelf: "center", borderRadius: 16, padding: 9, marginTop: 20, alignItems: "center", justifyContent: "center" }, qr: { width: 164, height: 164 }, qrFallback: { color: colors.muted, textAlign: "center", fontSize: 12 }, pinLabel: { color: colors.mint, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 16, letterSpacing: 1 }, pin: { color: colors.white, fontSize: 28, fontWeight: "900", letterSpacing: 8, textAlign: "center", marginTop: 4 }, statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, instructions: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 8 }, demoTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" }, demoCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 12 }, missing: { color: colors.muted, fontSize: 13, marginBottom: 13 } });
