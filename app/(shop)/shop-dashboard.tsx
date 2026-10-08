import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

import { getLocalStaffSession, getStaffProfile } from "@/services/shopService";
import {
  getShopByProfileId,
  getShopDashboardSummary,
  getIncomingOrders,
  getInventory,
} from "@/services/shopService";
import type { ShopProfile, ShopDashboardSummary } from "@/types/shop";
import type { ShopOrder } from "@/types/shopOrder";
import type { InventoryItem } from "@/types/product";

type IconName = React.ComponentProps<typeof FontAwesome>["name"];

const formatLkr = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  }).format(amount);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// Map an order status string to a colour so staff can scan the list quickly.
const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes("cancel") || s.includes("reject")) return colors.coral;
  if (s.includes("ready") || s.includes("complete") || s.includes("collected")) return colors.mint;
  if (s.includes("pending") || s.includes("new") || s.includes("pack")) return colors.amber;
  return colors.muted;
};

const prettyStatus = (status: string) => status.replace(/_/g, " ");

export default function ShopDashboard() {
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [summary, setSummary] = useState<ShopDashboardSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<ShopOrder[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [staffSession, setStaffSession] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setError(false);

      let profile = null;
      const token = await getLocalStaffSession();
      if (token) {
        const staffProfile = await getStaffProfile(token);
        if (staffProfile) {
          router.replace('/(shop)/new-orders');
          return;
        }
      }
      // Owner flow – get Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      profile = await getShopByProfileId(session.user.id);

      setShop(profile as any);

      if (profile) {
        const [dashSummary, orders, inventory] = await Promise.all([
          getShopDashboardSummary(profile.id),
          getIncomingOrders(profile.id),
          getInventory(profile.id),
        ]);

        setSummary(dashSummary);
        setRecentOrders(orders.slice(0, 5));
        setInventoryAlerts(
          inventory
            .filter(
              (item) =>
                item.stockStatus === "low_stock" ||
                item.stockStatus === "out_of_stock" ||
                !item.isAvailable
            )
            .slice(0, 4)
        );
      }
    } catch (err) {
      console.error("[ShopDashboard] error loading data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const pending = summary?.liveOrderCount ?? 0;

  const metrics = [
    { label: "Pending", value: summary?.liveOrderCount ?? 0, color: colors.amber },
    { label: "Packing", value: summary?.pendingPackingCount ?? 0, color: colors.lilac },
    { label: "Ready", value: summary?.readyForPickupCount ?? 0, color: colors.mint },
    { label: "Completed", value: summary?.completedToday ?? 0, color: colors.white },
  ];

  const actions: { label: string; icon: IconName; route: string; tint: string; badge?: number }[] = [
    { label: "Orders", icon: "shopping-bag", route: "/(shop)/new-orders", tint: colors.amber, badge: pending },
    { label: "Scan QR", icon: "qrcode", route: "/(shop)/qr-verification", tint: colors.ink },
    { label: "Stock", icon: "archive", route: "/(shop)/stock-update", tint: colors.mint },
    { label: "Products", icon: "tags", route: "/(shop)/shop-management", tint: colors.coral },
  ];

  if (!staffSession) {
    actions.push({ label: "Staff", icon: "users", route: "/(shop)/staff-management", tint: colors.night });
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {shop?.name ?? "Your shop"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open shop profile"
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            onPress={() => router.push("/(shop)/shop-profile")}
          >
            <FontAwesome name="user" size={20} color={colors.white} />
          </Pressable>
        </View>

        {/* Error banner */}
        {error && (
          <Pressable style={styles.errorBanner} onPress={loadData} accessibilityRole="button">
            <FontAwesome name="exclamation-circle" size={16} color={colors.coral} />
            <Text style={styles.errorText}>Couldn't load your dashboard. Tap to try again.</Text>
          </Pressable>
        )}

        {/* Hero: today's sales */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.statusPill}>
              <View
                style={[styles.statusDot, { backgroundColor: shop?.isOpen ? colors.mint : colors.coral }]}
              />
              <Text style={styles.statusPillText}>{shop?.isOpen ? "Open for orders" : "Closed"}</Text>
            </View>
            <Text style={styles.heroCaption}>Today</Text>
          </View>

          {loading ? (
            <View style={styles.skeletonAmount} />
          ) : (
            <Text style={styles.heroAmount}>{formatLkr(summary?.grossSalesToday ?? 0)}</Text>
          )}
          <Text style={styles.heroSub}>Gross sales</Text>

          <View style={styles.heroMetrics}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.heroMetric}>
                <Text style={styles.heroMetricVal}>{m.value}</Text>
                <View style={styles.heroMetricLabelRow}>
                  <View style={[styles.miniDot, { backgroundColor: m.color }]} />
                  <Text style={styles.heroMetricLabel}>{m.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Pickup info chips */}
        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <FontAwesome name="map-marker" size={14} color={colors.muted} />
            <Text style={styles.infoText} numberOfLines={1}>
              {shop?.address || "Address not set"}
            </Text>
          </View>
          <View style={styles.infoChip}>
            <FontAwesome name="clock-o" size={14} color={colors.muted} />
            <Text style={styles.infoText}>{shop?.prepMinutes ? `${shop.prepMinutes} min prep` : "Prep time not set"}</Text>
          </View>
          <View style={styles.infoChip}>
            <FontAwesome name="hand-paper-o" size={14} color={colors.muted} />
            <Text style={styles.infoText}>{shop?.pickupCounter || "Counter not set"}</Text>
          </View>
        </View>

        {/* Attention banner for waiting orders */}
        {pending > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(shop)/new-orders")}
            style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
          >
            <View style={styles.bannerIcon}>
              <FontAwesome name="bell" size={14} color={colors.ink} />
            </View>
            <Text style={styles.bannerText}>
              {pending} {pending === 1 ? "order is" : "orders are"} waiting for you
            </Text>
            <FontAwesome name="chevron-right" size={12} color={colors.ink} />
          </Pressable>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => router.push(a.route as never)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.tint + "22" }]}>
                <FontAwesome name={a.icon} size={18} color={a.tint} />
                {!!a.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{a.badge > 9 ? "9+" : a.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recent orders */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Recent orders</Text>
            <Pressable hitSlop={10} onPress={() => router.push("/(shop)/new-orders")}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>

          {recentOrders.length === 0 ? (
            <View style={styles.empty}>
              <FontAwesome name="inbox" size={22} color={colors.muted} />
              <Text style={styles.emptyText}>No orders yet. New orders will show up here.</Text>
            </View>
          ) : (
            recentOrders.map((order, idx) => {
              const tone = statusColor(order.status);
              return (
                <Pressable
                  key={order.id}
                  onPress={() => router.push(`/(shop)/shop-order-details?orderId=${order.id}`)}
                  style={({ pressed }) => [
                    styles.orderRow,
                    idx < recentOrders.length - 1 && styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.orderAccent, { backgroundColor: tone }]} />
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderCustomer} numberOfLines={1}>
                      {order.customerName}
                    </Text>
                    <Text style={styles.orderRef}>#{order.reference.substring(0, 6)}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>{formatLkr(order.totalLkr)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: tone + "1F" }]}>
                      <Text style={[styles.statusText, { color: tone }]}>{prettyStatus(order.status)}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Inventory */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Stock to check</Text>
            <Pressable hitSlop={10} onPress={() => router.push("/(shop)/stock-update")}>
              <Text style={styles.link}>Update stock</Text>
            </Pressable>
          </View>

          {inventoryAlerts.length === 0 ? (
            <View style={styles.empty}>
              <FontAwesome name="check-circle" size={22} color={colors.mint} />
              <Text style={styles.emptyText}>All products are well stocked.</Text>
            </View>
          ) : (
            inventoryAlerts.map((item, idx) => {
              const out = item.stockStatus === "out_of_stock" || item.quantity === 0;
              const tone = out ? colors.coral : colors.amber;
              return (
                <View
                  key={item.id}
                  style={[styles.stockRow, idx < inventoryAlerts.length - 1 && styles.rowBorder]}
                >
                  <Text style={styles.stockName} numberOfLines={1}>
                    {item.product?.name}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: tone + "1F" }]}>
                    <Text style={[styles.statusText, { color: tone }]}>
                      {out ? "Out of stock" : `${item.quantity} left`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.lilac, flex: 1 },
  scrollContent: { paddingBottom: 110, paddingHorizontal: 16, paddingTop: 12 },
  pressed: { opacity: 0.7 },

  // Header
  header: { alignItems: "center", flexDirection: "row", marginBottom: 18, paddingHorizontal: 4 },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  // Error
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(224, 69, 75, 0.1)",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  errorText: { color: colors.coral, flex: 1, fontSize: 13, fontWeight: "600" },

  // Hero
  hero: {
    backgroundColor: "#506784",
    borderRadius: 24,
    marginBottom: 12,
    padding: 20,
  },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  statusPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { borderRadius: 4, height: 8, width: 8 },
  statusPillText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  heroCaption: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },
  heroAmount: { color: colors.white, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  skeletonAmount: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    height: 38,
    width: 180,
  },
  heroSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", marginTop: 4 },
  heroMetrics: {
    borderTopColor: "rgba(255,255,255,0.12)",
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 16,
  },
  heroMetric: { flex: 1 },
  heroMetricVal: { color: colors.white, fontSize: 22, fontWeight: "800" },
  heroMetricLabelRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 4 },
  miniDot: { borderRadius: 3, height: 6, width: 6 },
  heroMetricLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },

  // Info chips
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  infoChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  infoText: { color: colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "600" },

  // Banner
  banner: {
    alignItems: "center",
    backgroundColor: colors.amber,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    padding: 12,
  },
  bannerIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  bannerText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "800" },

  // Quick actions
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  action: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    flex: 1,
    paddingVertical: 14,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    marginBottom: 8,
    width: 44,
  },
  actionLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  badge: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderColor: colors.white,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 3,
    position: "absolute",
    right: -6,
    top: -6,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  link: { color: colors.ink, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  rowBorder: { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },

  // Orders
  orderRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 12 },
  orderAccent: { borderRadius: 2, height: 36, width: 4 },
  orderLeft: { flex: 1 },
  orderCustomer: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  orderRef: { color: colors.muted, fontSize: 12, marginTop: 2 },
  orderRight: { alignItems: "flex-end", gap: 6 },
  orderTotal: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  // Stock
  stockRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  stockName: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", marginRight: 10 },
});