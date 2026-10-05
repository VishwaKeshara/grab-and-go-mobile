import { ActionButton, Card, Choice, ErrorText, InfoRow, OrderPage, PriceSummary, SectionTitle, money, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function Payment() {
  const { cart, draft, totals, shop, updateDraft, submitOrder, submitting } = useCart();
  const [failure, setFailure] = useState("");
  const pay = async () => {
    if (submitting) return;
    setFailure("");
    try { const order = await submitOrder(); router.replace({ pathname: "/(customer)/order-confirmation", params: { id: order.id } }); }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : "We couldn't place your order. Please retry."); }
  };
  return <OrderPage title="Payment" eyebrow="SECURE CHECKOUT" back={() => router.back()} footer={<><View style={styles.payRow}><Text style={styles.payLabel}>Payable amount</Text><Text style={styles.payTotal}>{money(totals.subtotal)}</Text></View><ActionButton label={submitting ? "Placing order…" : failure ? "Retry placing order" : draft.paymentMethod === "pickup" ? "Place order" : "Place demo order"} icon="lock" loading={submitting} disabled={(!cart.length && !failure) || !draft.pickupSlot?.id || !shop} onPress={pay} /></>}>
    <ErrorText message={failure} />
    <Card dark><Text style={styles.heroLabel}>TOTAL DUE</Text><Text style={styles.heroTotal}>{money(totals.subtotal)}</Text><Text style={styles.heroMeta}>{shop?.name ?? ""} · {prettySlot(draft.pickupSlot)}</Text></Card>
    <SectionTitle title="Choose how to pay" />
    <View style={styles.choices}><Choice title="LankaQR / wallet" subtitle="Demo payment · no wallet connection" icon="qrcode" selected={draft.paymentMethod === "wallet"} onPress={() => updateDraft({ paymentMethod: "wallet" })} /><Choice title="Credit or debit card" subtitle="Demo payment · no card details collected" icon="credit-card" selected={draft.paymentMethod === "card"} onPress={() => updateDraft({ paymentMethod: "card" })} /><Choice title="Pay at pickup" subtitle="Pay the shop when you collect your order" icon="money" selected={draft.paymentMethod === "pickup"} onPress={() => updateDraft({ paymentMethod: "pickup" })} /></View>
    <Card><InfoRow icon="info-circle" label="Payment status" value={draft.paymentMethod === "pickup" ? "Due at pickup counter" : "Demo only — no real charge"} /><Text style={styles.note}>Your order is created only after this step succeeds. Please tap once and wait for confirmation.</Text></Card>
    <PriceSummary subtotal={totals.subtotal} savings={totals.savings} />
  </OrderPage>;
}
const styles = StyleSheet.create({ payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, payLabel: { color: colors.muted, fontSize: 12 }, payTotal: { color: colors.ink, fontSize: 18, fontWeight: "900" }, heroLabel: { color: colors.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1 }, heroTotal: { color: colors.white, fontSize: 30, fontWeight: "900", marginTop: 8 }, heroMeta: { color: "#D7D5E8", fontSize: 11, marginTop: 9 }, choices: { gap: 10 }, note: { color: colors.muted, lineHeight: 18, fontSize: 11, marginTop: 5 } });
