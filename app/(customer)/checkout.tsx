import { ActionButton, Card, Choice, ErrorText, InfoRow, OrderPage, PriceSummary, ProductLine, SectionTitle, ShopCard, money, preferenceText, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { isValidPhone } from "@/services/cartService";
import { hasPickupSlot, loadPickupSlots } from "@/services/pickupService";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function Checkout() {
  const { cart, draft, totals, shop, alternatives, updateDraft, error } = useCart();
  const [validation, setValidation] = useState("");
  const continueToPayment = async () => {
    if (!draft.customerName.trim()) return setValidation("Enter your name to continue.");
    if (!isValidPhone(draft.phone)) return setValidation("Enter a valid phone number with at least 9 digits.");
    if (!shop || !draft.pickupSlot?.id) return setValidation("Choose an available pickup time.");
    if (!cart.length) return setValidation("Your cart is empty.");
    try {
      const availability = await loadPickupSlots(shop.id);
      if (!hasPickupSlot(availability, draft.pickupSlot)) {
        return setValidation("That pickup time is no longer available. Choose another.");
      }
    } catch (cause) {
      return setValidation(cause instanceof Error ? cause.message : "Could not check pickup availability.");
    }
    setValidation(""); router.push("/(customer)/payment");
  };
  return <OrderPage title="Checkout" eyebrow="ALMOST THERE" back={() => router.back()} footer={<><View style={styles.footerRow}><Text style={styles.footerLabel}>Amount to pay</Text><Text style={styles.footerTotal}>{money(totals.subtotal)}</Text></View><ActionButton label="Continue to payment" icon="arrow-right" disabled={!cart.length} onPress={continueToPayment} /></>}>
    <ErrorText message={validation || error} />
    <ShopCard shop={shop} />
    <SectionTitle title="Pickup time" action="Edit" onAction={() => router.push("/(customer)/pickup-schedule")} />
    <Card><InfoRow icon="calendar" label="Selected window" value={prettySlot(draft.pickupSlot)} /><ActionButton label={draft.pickupSlot ? "Change pickup time" : "Choose pickup time"} light icon="arrow-right" onPress={() => router.push("/(customer)/pickup-schedule")} /></Card>
    <SectionTitle title="Contact details" />
    <Card><Text style={styles.fieldLabel}>Your name *</Text><TextInput accessibilityLabel="Your name" autoCapitalize="words" placeholder="Full name" placeholderTextColor={colors.muted} value={draft.customerName} onChangeText={customerName => updateDraft({ customerName })} style={styles.input} /><Text style={styles.fieldLabel}>Mobile number *</Text><TextInput accessibilityLabel="Mobile number" keyboardType="phone-pad" placeholder="e.g. +94 77 123 4567" placeholderTextColor={colors.muted} value={draft.phone} onChangeText={phone => updateDraft({ phone })} style={styles.input} /></Card>
    <SectionTitle title="How are you travelling?" />
    <View style={styles.choices}><Choice title="Walking" icon="male" selected={draft.travelMethod === "walking"} onPress={() => updateDraft({ travelMethod: "walking" })} /><Choice title="Motorcycle" icon="motorcycle" selected={draft.travelMethod === "motorcycle"} onPress={() => updateDraft({ travelMethod: "motorcycle" })} /><Choice title="Car or tuk" icon="car" selected={draft.travelMethod === "car"} onPress={() => updateDraft({ travelMethod: "car" })} /></View>
    <SectionTitle title="Packing instructions" />
    <Card><TextInput accessibilityLabel="Packing instructions" multiline placeholder="e.g. Please separate the eggs and use my reusable bag" placeholderTextColor={colors.muted} value={draft.packingInstructions} onChangeText={packingInstructions => updateDraft({ packingInstructions })} style={styles.instructions} /></Card>
    <SectionTitle title={`Order summary · ${totals.units} items`} />
    <Card>{cart.map(item => <ProductLine key={item.product.id} item={item} detail={preferenceText(item.substitution, alternatives[item.product.id])} />)}</Card>
    <PriceSummary subtotal={totals.subtotal} savings={totals.savings} />
  </OrderPage>;
}
const styles = StyleSheet.create({ footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, footerLabel: {fontWeight: "400", color: colors.muted, fontSize: 12 }, footerTotal: { color: colors.ink, fontSize: 18, fontWeight: "700" }, fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "500", marginBottom: 7, marginTop: 6 }, input: {fontWeight: "400", borderColor: colors.line, borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, color: colors.ink, fontSize: 16, marginBottom: 12 }, choices: { gap: 9 }, instructions: {fontWeight: "400", minHeight: 88, textAlignVertical: "top", color: colors.ink, fontSize: 13 } });
