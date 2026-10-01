import { ActionButton, Card, Choice, ErrorText, OrderPage, SectionTitle, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { SHOP } from "@/services/cartService";
import type { PickupSlot } from "@/types/cart";
import { isPickupSlotAvailable } from "@/utils/ordering";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const makeTime = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const dateOptions = () => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return { key: localDate(date), label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-LK", { weekday: "short" }), day: date.getDate() }; });
const slots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const endTime = (start: string) => { const date = new Date(); const [hour, minute] = start.split(":").map(Number); date.setHours(hour, minute + 30, 0, 0); return makeTime(date); };

export default function PickupSchedule() {
  const { draft, updateDraft } = useCart();
  const [day, setDay] = useState(draft.pickupSlot?.date ?? localDate(new Date()));
  const [selected, setSelected] = useState<PickupSlot | null>(draft.pickupSlot);
  const [error, setError] = useState("");
  const now = new Date(); const minimum = new Date(now.getTime() + SHOP.prepMinutes * 60000);
  const expressStart = new Date(Math.floor(minimum.getTime() / (15 * 60000) + 1) * 15 * 60000);
  const express: PickupSlot = { date: localDate(expressStart), start: makeTime(expressStart), end: makeTime(new Date(expressStart.getTime() + 20 * 60000)), mode: "express" };
  const available = (date: string, time: string) => isPickupSlotAvailable({ date, start: time, end: endTime(time), mode: "scheduled" }, SHOP.prepMinutes, now.getTime());
  const save = () => { if (!selected || !isPickupSlotAvailable(selected, SHOP.prepMinutes)) { setError("Select a future pickup time that allows preparation."); return; } updateDraft({ pickupSlot: selected }); router.back(); };
  return <OrderPage title="Pickup schedule" eyebrow="PLAN YOUR PICKUP" back={() => router.back()} footer={<ActionButton label="Use this pickup time" icon="check" disabled={!selected} onPress={save} />}>
    <ErrorText message={error} />
    <Card dark><View style={styles.heroRow}><FontAwesome name="clock-o" size={24} color={colors.mint} /><View style={{ flex: 1 }}><Text style={styles.heroTitle}>Prepared just for you</Text><Text style={styles.heroCopy}>Demo windows allow about {SHOP.prepMinutes} minutes for preparation. Availability is not live yet.</Text></View></View></Card>
    <SectionTitle title="Express pickup" />
    <Choice title="Earliest available" subtitle={prettySlot(express)} icon="bolt" selected={selected?.mode === "express" && selected.start === express.start && selected.date === express.date} onPress={() => { setSelected(express); setDay(express.date); }} right="Recommended" />
    <SectionTitle title="Schedule a time" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>{dateOptions().map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: day === option.key }} onPress={() => { setDay(option.key); setSelected(null); }} style={[styles.day, day === option.key && styles.daySelected]}><Text style={[styles.dayLabel, day === option.key && styles.dayTextSelected]}>{option.label}</Text><Text style={[styles.dayNumber, day === option.key && styles.dayTextSelected]}>{option.day}</Text></Pressable>)}</ScrollView>
    <Text style={styles.hint}>Available windows · 30 minutes each</Text>
    <View style={styles.slotGrid}>{slots.map((start, index) => { const enabled = available(day, start) && index !== 4; const active = selected?.date === day && selected?.start === start && selected.mode === "scheduled"; return <Pressable key={start} accessibilityRole="button" accessibilityLabel={`${start} to ${endTime(start)}${enabled ? "" : ", unavailable"}`} accessibilityState={{ disabled: !enabled, selected: active }} disabled={!enabled} onPress={() => setSelected({ date: day, start, end: endTime(start), mode: "scheduled" })} style={[styles.slot, active && styles.slotSelected, !enabled && styles.slotDisabled]}><Text style={[styles.slotTime, active && styles.slotTimeSelected]}>{start}</Text><Text style={[styles.slotSub, active && styles.slotTimeSelected]}>{enabled ? index === 6 ? "Popular" : "Available" : "Unavailable"}</Text></Pressable>; })}</View>
    <Card><Text style={styles.selectedTitle}>Your selected window</Text><Text style={styles.selectedValue}>{prettySlot(selected)}</Text><Text style={styles.hint}>Collect from {SHOP.counter} at {SHOP.name}.</Text></Card>
  </OrderPage>;
}
const styles = StyleSheet.create({ heroRow: { flexDirection: "row", alignItems: "center", gap: 13 }, heroTitle: { color: colors.white, fontSize: 17, fontWeight: "800" }, heroCopy: { color: "#D6D4E8", fontSize: 12, marginTop: 5 }, dayRow: { flexDirection: "row", gap: 8, paddingRight: 20 }, day: { width: 67, height: 68, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, daySelected: { backgroundColor: colors.ink, borderColor: colors.ink }, dayLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" }, dayNumber: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 3 }, dayTextSelected: { color: colors.white }, hint: { color: colors.muted, fontSize: 11, lineHeight: 16 }, slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, slot: { width: "31%", minHeight: 64, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.white, borderRadius: 13, alignItems: "center", justifyContent: "center" }, slotSelected: { backgroundColor: colors.mintSoft, borderColor: "#16A97E", borderWidth: 2 }, slotDisabled: { opacity: 0.4 }, slotTime: { color: colors.ink, fontSize: 13, fontWeight: "800" }, slotTimeSelected: { color: "#087A60" }, slotSub: { color: colors.muted, fontSize: 10, marginTop: 3 }, selectedTitle: { color: colors.muted, fontSize: 11 }, selectedValue: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 5 } });
