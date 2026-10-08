import { ActionButton, Card, InfoRow, LinkButton, OrderPage, ProductLine, SectionTitle, money, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useOrders } from "@/hooks/useOrders";
import { FontAwesome } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function OrderConfirmation() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { orders, loading } = useOrders();
  const order = orders.find(value => value.id === id);
  if (!order) return (
    <OrderPage title="Order confirmation" back={() => router.replace("/(customer)/home")}>
      <Card>
        <Text style={styles.missing}>
          {loading ? "Loading your order…" : "We couldn't find this order. Check My Orders for your latest purchases."}
        </Text>
        <LinkButton label="My orders" onPress={() => router.replace("/(customer)/my-orders")} />
      </Card>
    </OrderPage>
  );

  const details = () => router.push({ pathname: "/(customer)/order-details", params: { id: order.id } });
  const tracking = () => router.push({ pathname: "/(customer)/order-tracking", params: { id: order.id } });
  return <OrderPage title="Order confirmed" eyebrow="YOU'RE ALL SET" back={() => router.replace("/(customer)/my-orders")} footer={<View style={styles.footerActions}><ActionButton label="Track your order" icon="arrow-right" onPress={tracking} /><LinkButton label="Continue Shopping" icon="shopping-basket" onPress={() => router.replace("/(customer)/home")} /></View>}>
    <View style={styles.success}><View style={styles.successIcon}><FontAwesome name="check" size={30} color={colors.ink} /></View><Text style={styles.successTitle}>See you at pickup!</Text><Text style={styles.successCopy}>Your order has been sent to {order.shop.name}.</Text></View>
    <Card dark><Text style={styles.passLabel}>PICKUP REFERENCE</Text><Text style={styles.reference}>{order.reference}</Text><View style={styles.passRule} /><Text style={styles.pinLabel}>Show this pickup PIN at the counter</Text><Text style={styles.pin}>{order.pin}</Text></Card>
    <SectionTitle title="Pickup details" />
    <Card><InfoRow icon="shopping-basket" label="Shop" value={order.shop.name} /><InfoRow icon="map-marker" label="Collection point" value={order.shop.counter} /><InfoRow icon="calendar" label="Pickup window" value={prettySlot(order.draft.pickupSlot)} /><InfoRow icon="credit-card" label="Payment" value={order.paymentStatus === "pay_at_pickup" ? `${money(order.total)} · Pay at pickup` : order.paymentStatus === "paid" ? `${money(order.total)} · Paid` : order.paymentStatus === "failed" ? "Payment failed" : "Demo · no payment collected"} /></Card>
    <SectionTitle title="Your basket" />
    <Card>{order.items.map(item => <ProductLine key={item.id} item={item} />)}</Card>
    <LinkButton label="View order details" icon="list-alt" onPress={details} />
  </OrderPage>;
}
const styles = StyleSheet.create({ footerActions: { gap: 10 }, success: { alignItems: "center", paddingVertical: 12 }, successIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }, successTitle: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 13 }, successCopy: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: "center" }, passLabel: { color: colors.mint, fontSize: 10, letterSpacing: 1.2, fontWeight: "800" }, reference: { color: colors.white, fontSize: 22, fontWeight: "900", marginTop: 7 }, passRule: { backgroundColor: "#46436C", height: 1, marginVertical: 16 }, pinLabel: { color: "#D8D6E8", fontSize: 11 }, pin: { color: colors.white, fontSize: 30, letterSpacing: 8, fontWeight: "900", marginTop: 5 }, missing: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 15 } });
