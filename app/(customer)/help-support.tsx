import { AuthFrame, AuthHeader, ErrorBanner } from "@/components/AuthUI";
import { colors, accentText } from "@/constants/colors";
import { supportConfig } from "@/constants/config";
import { listShops } from "@/services/shopService";
import type { Shop } from "@/types/shop";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const appVersion = Constants.expoConfig?.version ?? "1.0.0";

/** FAQ entries shown as always-visible highlighted cards at the top. */
const FEATURED_FAQS = [
  {
    id: "preorder-compare",
    number: "1",
    tone: "#4B5563",
    question: "Pre-Order & Compare",
    answer:
      "Compare prices across Malabe stores before you pay. Live basket, live pricing from Bestway Supermarket, Direct Market, and Daily Fresh.",
  },
  {
    id: "suggested-alternative",
    number: "2",
    tone: "#16A34A",
    question: "Suggested Alternative Store",
    answer:
      "Out of stock items are shown with clear substitute options. Tap Suggest Alternative to browse nearby shops with live prices.",
  },
  {
    id: "scan-grab",
    number: "3",
    tone: "#F59E0B",
    question: "Scan & Grab in under 45s",
    answer:
      "Push your dynamic QR code or enter your order code. Confirm pickup hub, time slot, and continue to checkout.",
  },
] as const;

/** FAQ entries collapsed by default. */
const COLLAPSED_FAQS = [
  {
    id: "sold-out",
    question: "What if an item sells out while the market is packing?",
    answer:
      "You are never charged for an item that is unavailable. Our packers mark the item as sold out and you get an instant notification with a suggested alternative store, so you can swap it for something similar or drop it and receive a partial refund.",
  },
  {
    id: "express-counter",
    question: "How does the Zero-Qreuse Express Counter work?",
    answer:
      "The Zero-Qreuse Express Counter is our fast lane for small baskets. Bring your collection QR code, scan it once, and your items are handed over immediately. No reusable bags, no queue — just scan and go.",
  },
  {
    id: "delay-pickup",
    question: "Can I delay my pickup if my bus or shuttle is late?",
    answer:
      "Yes. Open your order and tap Reschedule before your slot starts. You can pick any free slot on the same day at no charge. If your slot is about to close, contact support and we will hold the order for you.",
  },
  {
    id: "report-discrepancy",
    question: "How do I report a missing item or discrepancy?",
    answer:
      "Open the order from your profile, tap Report an issue, and pick the affected items. Include a photo if you have one. We refund or replace the item within 24 hours, usually sooner.",
  },
] as const;

const CERTIFIED_SUPPLIERS = [
  "Malabe Fresh Farm Outlet",
  "Kotahena Cold Stores",
  "Daily Fresh Distributors",
] as const;

function openExternal(url: string) {
  return Linking.openURL(url).catch(() => undefined);
}

export default function HelpSupport() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listShops()
      .then((items) => {
        if (active) setShops(items);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load the partner stores.",
        );
      })
      .finally(() => {
        if (active) setShopsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const term = query.trim().toLowerCase();

  const visibleFeatured = useMemo(
    () =>
      FEATURED_FAQS.filter(
        (faq) =>
          term.length === 0 ||
          faq.question.toLowerCase().includes(term) ||
          faq.answer.toLowerCase().includes(term),
      ),
    [term],
  );

  const visibleCollapsed = useMemo(
    () =>
      COLLAPSED_FAQS.filter(
        (faq) =>
          term.length === 0 ||
          faq.question.toLowerCase().includes(term) ||
          faq.answer.toLowerCase().includes(term),
      ),
    [term],
  );

  const totalResults = visibleFeatured.length + visibleCollapsed.length;
  const toggle = (id: string) =>
    setOpenIds((ids) =>
      ids.includes(id) ? ids.filter((open) => open !== id) : [...ids, id],
    );

  const callShop = (shop: Shop) => {
    if (!shop.phone) return;
    return openExternal(`tel:${shop.phone}`);
  };

  return (
    <AuthFrame scroll={false}>
      <AuthHeader eyebrow="GRAB & GO" title="Help and Support" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>How can we help your commute?</Text>
          <Text style={styles.heroBody}>
            Quick answers for common queries, basket changes, and local grocery
            orders.
          </Text>
          <View style={styles.searchWrap}>
            <TextInput
              onChangeText={setQuery}
              placeholder="Search topics, quantity, orders"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.search}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                style={styles.clear}
              >
                <Text style={styles.clearText}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.contactRow}>
          <ContactCard
            icon="✆"
            label="Live Chat"
            onPress={() => openExternal("mailto:" + supportConfig.email)}
            sub="Typically replies in minutes"
            tone="#4B5563"
          />
          <ContactCard
            icon="✉"
            label="Helpdesk"
            onPress={() => openExternal("mailto:" + supportConfig.email)}
            sub="Email support 24/7"
            tone={colors.mint}
          />
          <ContactCard
            icon="◔"
            label="WhatsApp"
            onPress={() =>
              openExternal(`https://wa.me/${supportConfig.whatsapp}`)
            }
            sub="Chat on WhatsApp"
            tone="#F59E0B"
          />
        </View>
        <Pressable
          onPress={() => openExternal(`tel:${supportConfig.phone}`)}
          style={styles.urgent}
        >
          <Text style={styles.urgentText}>
            Have an issue? • Call {supportConfig.phoneDisplay}
          </Text>
        </Pressable>
        {error ? <ErrorBanner message={error} /> : null}
        {term.length > 0 ? (
          <Text style={styles.resultCount}>
            {totalResults} result{totalResults === 1 ? "" : "s"} for “{query}”
          </Text>
        ) : null}
        {visibleFeatured.map((faq) => (
          <View key={faq.id} style={styles.featuredCard}>
            <View style={[styles.featuredBadge, { backgroundColor: faq.tone }]}>
              <Text style={styles.featuredNumber}>{faq.number}</Text>
            </View>
            <View style={styles.featuredCopy}>
              <Text style={styles.featuredQuestion}>{faq.question}</Text>
              <Text style={styles.featuredAnswer}>{faq.answer}</Text>
            </View>
          </View>
        ))}
        {visibleCollapsed.length > 0 ? (
          <View style={styles.listCard}>
            {visibleCollapsed.map((faq, index) => {
              const open = openIds.includes(faq.id);
              const last = index === visibleCollapsed.length - 1;
              return (
                <View
                  key={faq.id}
                  style={[styles.listRow, !last && styles.listRowBorder]}
                >
                  <Pressable
                    accessibilityHint={open ? "Collapse answer" : "Expand answer"}
                    accessibilityState={{ expanded: open }}
                    onPress={() => toggle(faq.id)}
                    style={styles.listHeader}
                  >
                    <Text style={styles.listQuestion}>{faq.question}</Text>
                    <Text style={[styles.chevron, open && styles.chevronOpen]}>
                      {open ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {open ? (
                    <Text style={styles.listAnswer}>{faq.answer}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {totalResults === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⌕</Text>
            <Text style={styles.emptyTitle}>No topics found</Text>
            <Text style={styles.emptyText}>
              Try a different keyword, or contact our team directly.
            </Text>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>Partner Stores</Text>
        {shopsLoading ? (
          <Text style={styles.muted}>Loading partner stores...</Text>
        ) : shops.length === 0 ? (
          <View style={styles.emptySmall}>
            <Text style={styles.emptyText}>
              No partner stores available right now.
            </Text>
          </View>
        ) : (
          shops.map((shop) => (
            <View key={shop.id} style={styles.storeCard}>
              <View style={styles.storeIcon}>
                <Text style={styles.storeIconText}>🏪</Text>
              </View>
              <View style={styles.storeCopy}>
                <Text style={styles.storeName}>{shop.name}</Text>
                <Text style={styles.storeArea}>
                  {shop.address || shop.category}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={`Call ${shop.name}`}
                onPress={() => callShop(shop)}
                style={({ pressed }) => [
                  styles.callButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.callButtonText}>Call Store</Text>
              </Pressable>
            </View>
          ))
        )}
        <Text style={styles.sectionTitle}>Certified Suppliers</Text>
        <View style={styles.supplierCard}>
          <View style={styles.supplierHead}>
            <View style={styles.supplierIcon}>
              <Text style={styles.supplierIconText}>✓</Text>
            </View>
            <View style={styles.supplierCopy}>
              <Text style={styles.supplierTitle}>
                Locally Certified &amp; CERTL Suppliers
              </Text>
              <Text style={styles.supplierBody}>
                Fresh and chilled produce sourced from vetted local suppliers.
              </Text>
            </View>
          </View>
          {CERTIFIED_SUPPLIERS.map((name) => (
            <View key={name} style={styles.supplierRow}>
              <View style={styles.supplierDot} />
              <Text style={styles.supplierRowText}>{name}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.version}>
          Version {appVersion} •{" "}
          {new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <Pressable
          onPress={() => router.replace("/(customer)/profile")}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </AuthFrame>
  );
}

function ContactCard({
  icon,
  label,
  onPress,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  sub: string;
  tone: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
    >
      <View style={[styles.contactIcon, { backgroundColor: tone }]}>
        <Text style={styles.contactIconText}>{icon}</Text>
      </View>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.contactSub}>
        {sub}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },
  hero: {
    backgroundColor: "#F3F4F6",
    borderRadius: 15,
    marginBottom: 16,
    padding: 15,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  heroBody: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 11,
    flexDirection: "row",
    marginTop: 13,
    minHeight: 44,
    paddingHorizontal: 13,
  },
  search: { fontWeight: "400", color: colors.ink, flex: 1, fontSize: 16, paddingVertical: 11 },
  clear: { alignItems: "center", height: 20, justifyContent: "center", width: 20 },
  clearText: {fontWeight: "600", color: colors.muted, fontSize: 14, lineHeight: 19 },
  contactRow: { flexDirection: "row", gap: 9 },
  contactCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 7,
    paddingVertical: 12,
  },
  contactIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  contactIconText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  contactLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
  },
  contactSub: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
  urgent: {
    alignItems: "center",
    marginBottom: 18,
    marginTop: 13,
  },
  urgentText: { color: "#15803D", fontSize: 12, fontWeight: "600" },
  resultCount: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    marginBottom: 11,
  },
  featuredCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 13,
  },
  featuredBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  featuredNumber: { color: colors.white, fontSize: 13, fontWeight: "900" },
  featuredCopy: { flex: 1, marginLeft: 11 },
  featuredQuestion: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  featuredAnswer: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  listCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  listRow: {},
  listRowBorder: { borderBottomColor: "#F3F4F6", borderBottomWidth: 1 },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    padding: 13,
  },
  listQuestion: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginRight: 10,
  },
  chevron: { color: colors.muted, fontSize: 17, fontWeight: "700" },
  chevronOpen: { color: colors.ink },
  listAnswer: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingBottom: 13,
    paddingHorizontal: 13,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 11,
  },
  storeCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 9,
    padding: 11,
  },
  storeIcon: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  storeIconText: {fontWeight: "400", fontSize: 17 },
  storeCopy: { flex: 1, marginLeft: 10 },
  storeName: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  storeArea: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
  callButton: {
    backgroundColor: colors.ink,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callButtonText: { color: colors.white, fontSize: 12, fontWeight: "600" },
  supplierCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 18,
    padding: 13,
  },
  supplierHead: { flexDirection: "row" },
  supplierIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  supplierIconText: { color: "#15803D", fontSize: 15, fontWeight: "700" },
  supplierCopy: { flex: 1, marginLeft: 10 },
  supplierTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  supplierBody: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  supplierRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 11,
  },
  supplierDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 7,
    marginRight: 8,
    width: 7,
  },
  supplierRowText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  version: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    marginBottom: 14,
    textAlign: "center",
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  backButtonText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  empty: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    marginBottom: 16,
    padding: 26,
  },
  emptySmall: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginBottom: 18,
    padding: 16,
  },
  emptyIcon: {fontWeight: "400", color: accentText, fontSize: 28 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 9,
  },
  emptyText: {fontWeight: "400", color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 6,
    textAlign: "center",
  },
  muted: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.75 },
});