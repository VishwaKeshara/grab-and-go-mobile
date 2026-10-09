import { ActionButton, Card, Choice, ErrorText, OrderPage, ProductLine, SectionTitle, money } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import type { SubstitutePreference } from "@/types/cart";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function SubstituteSelection() {
  const { cart, alternatives, setSubstitution, error } = useCart();
  const applyAll = (value: SubstitutePreference) => cart.forEach(item => setSubstitution(item.product.id, value));
  return <OrderPage title="Substitutions" eyebrow="MAKE IT YOURS" back={() => router.back()} footer={<ActionButton label="Continue to checkout" icon="arrow-right" disabled={!cart.length} onPress={() => router.push("/(customer)/checkout")} />}>
    <ErrorText message={error} />
    <Card dark><Text style={styles.heroTitle}>Fresh plans, even when stock changes.</Text><Text style={styles.heroCopy}>Tell the shop what to do if an item is unavailable. Your choice is saved as you go.</Text></Card>
    <SectionTitle title="Apply to all" />
    <View style={styles.quickRow}><Pressable accessibilityRole="button" onPress={() => applyAll({ type: "call" })} style={styles.quick}><Text style={styles.quickText}>Call me first</Text></Pressable><Pressable accessibilityRole="button" onPress={() => applyAll({ type: "none" })} style={styles.quick}><Text style={styles.quickText}>No substitutes</Text></Pressable></View>
    {cart.map((item, index) => <View key={item.product.id}><SectionTitle title={`${String(index + 1).padStart(2, "0")}  ${item.product.name}`} /><Card><ProductLine item={item} /><View style={styles.options}>{(alternatives[item.product.id] ?? []).map(alt => <Choice key={alt.id} title={alt.name} subtitle={`${alt.unit} · ${money(alt.price)} · ${alt.price - item.product.price >= 0 ? "+" : "−"}${money(Math.abs(alt.price - item.product.price))} vs original`} selected={item.substitution.type === "alternative" && item.substitution.productId === alt.id} onPress={() => setSubstitution(item.product.id, { type: "alternative", productId: alt.id })} />)}<Choice title="Call me before substituting" subtitle="The shop will confirm an alternative with you." icon="phone" selected={item.substitution.type === "call"} onPress={() => setSubstitution(item.product.id, { type: "call" })} /><Choice title="Do not substitute" subtitle="Remove this item if it is unavailable." icon="ban" selected={item.substitution.type === "none"} onPress={() => setSubstitution(item.product.id, { type: "none" })} /></View></Card></View>)}
    {!cart.length ? <Card><Text style={styles.empty}>Your cart is empty. Add items before choosing substitutions.</Text></Card> : null}
  </OrderPage>;
}
const styles = StyleSheet.create({ heroTitle: { color: colors.white, fontSize: 24, fontWeight: "700" }, heroCopy: {fontWeight: "400", color: "#D1D5DB", lineHeight: 19, fontSize: 12, marginTop: 8 }, quickRow: { flexDirection: "row", gap: 9 }, quick: { backgroundColor: colors.mintSoft, borderRadius: 12, paddingHorizontal: 16, minHeight: 43, alignItems: "center", justifyContent: "center" }, quickText: { color: "#15803D", fontSize: 12, fontWeight: "600" }, options: { gap: 9, marginTop: 11 }, empty: {fontWeight: "400", color: colors.muted, fontSize: 13 } });
