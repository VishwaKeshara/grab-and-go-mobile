import { ActionButton, Card, Choice, ErrorText, OrderPage, SectionTitle, prettySlot } from "@/components/OrderUI";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { hasPickupSlot, loadPickupSlots } from "@/services/pickupService";
import type { PickupAvailability, PickupSlot } from "@/types/cart";
import { FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const dateOptions = (today: string) => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return { key: date.toISOString().slice(0, 10),
    label: index === 0 ? "Today" : index === 1 ? "Tomorrow" :
      date.toLocaleDateString("en-LK", { weekday: "short", timeZone: "UTC" }),
    day: date.getUTCDate() };
});
const endTime = (start: string, minutes = 30) => {
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function PickupSchedule() {
  const { draft, shop, updateDraft } = useCart();
  const [availability, setAvailability] = useState<PickupAvailability | null>(null);
  const [day, setDay] = useState(draft.pickupSlot?.date ?? "");
  const [selected, setSelected] = useState<PickupSlot | null>(draft.pickupSlot);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!shop?.id) return;
    let live = true;
    loadPickupSlots(shop.id).then(result => {
      if (!live) return;
      setAvailability(result);
      const dates = dateOptions(result.today);
      setDay(previous => dates.some(option => option.key === previous) ? previous : result.today);
      setSelected(previous => previous && hasPickupSlot(result, previous) ? previous : null);
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "Could not load pickup times."); });
    return () => { live = false; };
  }, [shop?.id]);
  const dates = useMemo(() => availability ? dateOptions(availability.today) : [], [availability]);
  const express = availability?.slots.find(value => value.mode === "express") ?? null;
  const slotStarts = useMemo(() => [...new Set(availability?.slots
    .filter(value => value.mode === "scheduled").map(value => value.start) ?? [])].sort(), [availability]);
  const available = (date: string, start: string) =>
    availability?.slots.find(value => value.mode === "scheduled"
      && value.date === date && value.start === start) ?? null;
  const save = async () => {
    if (!shop?.id || !selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const current = await loadPickupSlots(shop.id);
      setAvailability(current);
      if (!hasPickupSlot(current, selected)) {
        setSelected(null);
        throw new Error("That pickup time is no longer available. Choose another.");
      }
      updateDraft({ pickupSlot: selected });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm pickup time.");
    } finally { setSaving(false); }
  };
  return <OrderPage title="Pickup schedule" eyebrow="PLAN YOUR PICKUP" back={() => router.back()} footer={<ActionButton label="Use this pickup time" icon="check" disabled={!selected || saving} loading={saving} onPress={() => void save()} />}>
    <ErrorText message={error} />
    <Card dark><View style={styles.heroRow}><FontAwesome name="clock-o" size={24} color={colors.mint} /><View style={{ flex: 1 }}><Text style={styles.heroTitle}>Prepared just for you</Text><Text style={styles.heroCopy}>Pickup windows allow about {shop?.prepMinutes ?? 25} minutes for preparation. Availability is live.</Text></View></View></Card>
    <SectionTitle title="Express pickup" />
    <Choice title="Earliest available" subtitle={express ? prettySlot(express) : "No express window available"} icon="bolt" selected={!!express && selected?.mode === "express" && selected.start === express.start && selected.date === express.date} onPress={() => { if (express) { setSelected(express); setDay(express.date); } }} right="Recommended" />
    <SectionTitle title="Schedule a time" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>{dates.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: day === option.key }} onPress={() => { setDay(option.key); setSelected(null); }} style={[styles.day, day === option.key && styles.daySelected]}><Text style={[styles.dayLabel, day === option.key && styles.dayTextSelected]}>{option.label}</Text><Text style={[styles.dayNumber, day === option.key && styles.dayTextSelected]}>{option.day}</Text></Pressable>)}</ScrollView>
    <Text style={styles.hint}>Available windows · {availability?.intervalMinutes ?? 30} minutes each</Text>
    <View style={styles.slotGrid}>{slotStarts.map((start, index) => { const slot = available(day, start); const enabled = !!slot; const active = selected?.date === day && selected?.start === start && selected.mode === "scheduled"; return <Pressable key={start} accessibilityRole="button" accessibilityLabel={`${start} to ${slot?.end ?? endTime(start, availability?.intervalMinutes ?? 30)}${enabled ? "" : ", unavailable"}`} accessibilityState={{ disabled: !enabled, selected: active }} disabled={!enabled} onPress={() => { if (slot) setSelected(slot); }} style={[styles.slot, active && styles.slotSelected, !enabled && styles.slotDisabled]}><Text style={[styles.slotTime, active && styles.slotTimeSelected]}>{start}</Text><Text style={[styles.slotSub, active && styles.slotTimeSelected]}>{enabled ? index === 6 ? "Popular" : "Available" : "Unavailable"}</Text></Pressable>; })}</View>
    <Card><Text style={styles.selectedTitle}>Your selected window</Text><Text style={styles.selectedValue}>{prettySlot(selected)}</Text><Text style={styles.hint}>Collect from {shop?.counter ?? ""} at {shop?.name ?? ""}.</Text></Card>
  </OrderPage>;
}
const styles = StyleSheet.create({ heroRow: { flexDirection: "row", alignItems: "center", gap: 13 }, heroTitle: { color: colors.white, fontSize: 24, fontWeight: "700" }, heroCopy: {fontWeight: "400", color: "#D1D5DB", fontSize: 12, marginTop: 5 }, dayRow: { flexDirection: "row", gap: 8, paddingRight: 20 }, day: { width: 67, height: 68, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, daySelected: { backgroundColor: colors.ink, borderColor: colors.ink }, dayLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" }, dayNumber: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 3 }, dayTextSelected: { color: colors.white }, hint: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 16 }, slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, slot: { width: "31%", minHeight: 64, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.white, borderRadius: 13, alignItems: "center", justifyContent: "center" }, slotSelected: { backgroundColor: colors.mintSoft, borderColor: "#16A34A", borderWidth: 2 }, slotDisabled: { opacity: 0.4 }, slotTime: { color: colors.ink, fontSize: 13, fontWeight: "600" }, slotTimeSelected: { color: "#15803D" }, slotSub: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 }, selectedTitle: {fontWeight: "400", color: colors.muted, fontSize: 12 }, selectedValue: { color: colors.ink, fontSize: 15, fontWeight: "600", marginTop: 5 } });
