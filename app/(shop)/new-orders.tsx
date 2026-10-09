import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { router } from "expo-router";
import { ShopOrder, ShopOrderStatus, ShopOrderItem } from "@/types/shopOrder";
import { supabase } from "@/lib/supabase";
import { getShopByProfileId, getIncomingOrders, updateOrderStatus, staffGetOrders, staffAcceptOrder, staffSetOrderStatus, getStaffProfile, getLocalStaffSession, clearLocalStaffSession } from "@/services/shopService";
import { colors } from "@/constants/colors";

import { FontAwesome } from "@expo/vector-icons";

// --- Types ---
interface ExtendedShopOrder extends Omit<ShopOrder, 'items'> {
  items?: ShopOrderItem[];
}

type FilterTab = "All Incoming" | "Being Packed" | "Ready";
type FilterChip = "Pickup <20 Mins" | "Motorcycle Pickup";

export default function NewOrders() {
  const [orders, setOrders] = useState<ExtendedShopOrder[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("All Incoming");
  const [selectedChips, setSelectedChips] = useState<FilterChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [shopName, setShopName] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const fetchOrders = async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const shop = await getShopByProfileId(userId);
      if (!shop) throw new Error("Shop not found");
      setShopName(shop.name);
      const incoming = (await getIncomingOrders(shop.id)) as ExtendedShopOrder[];
      setOrders(incoming || []);
      setLastSyncedAt(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const checkSessionAndFetch = async () => {
    try {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        setSessionChecked(true);
        setLoading(true);
        setError("");
        try {
          const profile = await getStaffProfile(staffToken);
          if (!profile) {
            await clearLocalStaffSession();
            router.replace("/(auth)/login?accountType=shop&shopMode=staff");
            return;
          }
          setShopName(profile.shopName || "");
          const incoming = (await staffGetOrders(staffToken)) as ExtendedShopOrder[];
          setOrders(incoming || []);
          setLastSyncedAt(new Date());
        } catch (err: any) {
          setError(err.message || "Failed to load orders");
        } finally {
          setLoading(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/(auth)/login?accountType=shop&shopMode=owner");
        return;
      }
      setSessionChecked(true);
      await fetchOrders(session.user.id);
    } catch (err: any) {
      setError("Session error. Please login again.");
    }
  };

  useEffect(() => {
    checkSessionAndFetch();
  }, []);

  const handleRefresh = async () => {
    const staffToken = await getLocalStaffSession();
    if (staffToken) {
      setLoading(true);
      setError("");
      try {
        const incoming = (await staffGetOrders(staffToken)) as ExtendedShopOrder[];
        setOrders(incoming || []);
        setLastSyncedAt(new Date());
      } catch (err: any) {
        setError(err.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchOrders(session.user.id);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: ShopOrderStatus) => {
    try {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        if (newStatus === "accepted") {
          await staffAcceptOrder(staffToken, orderId);
        } else {
          await staffSetOrderStatus(staffToken, orderId, newStatus);
        }
        await handleRefresh();
        return;
      }
      await updateOrderStatus(orderId, newStatus);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchOrders(session.user.id);
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const toggleChip = (chip: FilterChip) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "All Incoming" && o.status !== "placed") return false;
    if (activeTab === "Being Packed" && o.status !== "packing" && o.status !== "accepted") return false;
    if (activeTab === "Ready" && o.status !== "ready") return false;

    if (selectedChips.includes("Motorcycle Pickup") && o.travelMethod !== "motorcycle") return false;
    
    if (selectedChips.includes("Pickup <20 Mins")) {
      if (!o.pickupStartAt) return false;
      const pickupTime = new Date(o.pickupStartAt).getTime();
      const now = new Date().getTime();
      const diffMins = (pickupTime - now) / 1000 / 60;
      if (diffMins > 20 || diffMins < -60) return false;
    }



    return true;
  });

  const getTabCount = (tab: FilterTab) => {
    return orders.filter((o) => {

      if (tab === "All Incoming") return o.status === "placed";
      if (tab === "Being Packed") return o.status === "packing" || o.status === "accepted";
      if (tab === "Ready") return o.status === "ready";
      return false;
    }).length;
  };

  if (!sessionChecked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#4B5563' }}>Checking session...</Text>
      </View>
    );
  }

  const renderEmptyState = () => {
    let title = "";
    let subtitle = "";
    if (activeTab === "All Incoming") {
      title = "No incoming orders";
      subtitle = "You're all caught up for now.";
    } else if (activeTab === "Being Packed") {
      title = "No orders being packed";
      subtitle = "Accepted orders will appear here.";
    } else {
      title = "No orders ready for pickup";
      subtitle = "Completed packing orders will appear here.";
    }

    return (
      <View style={styles.emptyStateCard}>
        <FontAwesome name="inbox" size={32} color={colors.iconMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>{shopName ? shopName.toUpperCase() : "YOUR SHOP"}</Text>
          <Text style={styles.headerTitle}>New Orders</Text>
          <Text style={styles.headerSubtitle}>Manage incoming and active shop orders</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>OPEN</Text>
          </View>
        </View>
        <View style={styles.profileBadge} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          {(["All Incoming", "Being Packed", "Ready"] as FilterTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {getTabCount(tab)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sync Status Row */}
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            {loading ? "Syncing..." : lastSyncedAt ? "Last synced just now" : "Not synced"}
          </Text>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
            <FontAwesome name="refresh" size={12} color="#4B5563" />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {(["Pickup <20 Mins", "Motorcycle Pickup"] as FilterChip[]).map((chip) => {
            const isSelected = selectedChips.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleChip(chip)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Order Cards */}
        {error ? (
          <Text style={{ color: 'red', margin: 20 }}>{error}</Text>
        ) : loading && orders.length === 0 ? (
          <Text style={{ color: '#4B5563', margin: 20 }}>Loading live orders...</Text>
        ) : filteredOrders.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAccept={() => handleStatusChange(order.id, "accepted")}
              onReject={() => handleStatusChange(order.id, "cancelled")}
              onStage={() => handleStatusChange(order.id, "collected")}
            />
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, onAccept, onReject, onStage }: { order: ExtendedShopOrder, onAccept: () => void, onReject: () => void, onStage: () => void }) {
  const isReady = order.status === "ready";
  const isPlaced = order.status === "placed";

  const getStatusBadge = () => {
    switch (order.status) {
      case "placed": return { text: "NEW", color: "#15803D", bg: "#F3F4F6" };
      case "accepted": return { text: "ACCEPTED", color: "#16A34A", bg: "#DCFCE7" };
      case "packing": return { text: "PACKING", color: "#F59E0B", bg: "#FEF3C2" };
      case "ready": return { text: "READY", color: "#16A34A", bg: "#DCFCE7" };
      case "collected": return { text: "COMPLETED", color: "#111827", bg: "#D1D5DB" };
      case "cancelled": return { text: "CANCELLED", color: "#DC2626", bg: "#FEE2E2" };
      default: return { text: String(order.status).toUpperCase(), color: "#4B5563", bg: "#F3F4F6" };
    }
  };
  const badge = getStatusBadge();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{order.reference || order.id.substring(0, 8)}</Text>
        <Text style={[styles.urgency, { color: badge.color, backgroundColor: badge.bg }]}>
          {badge.text}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.customerName}>{order.customerName}</Text>
        
        {(order.pickupStartAt || order.travelMethod) && (
          <Text style={styles.pickupInfo}>
            Pickup: {order.pickupStartAt ? new Date(order.pickupStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ASAP"}
            {order.travelMethod ? ` • ${order.travelMethod.charAt(0).toUpperCase() + order.travelMethod.slice(1)}` : ""}
          </Text>
        )}

        {order.paymentStatus && (
          <Text style={styles.paymentInfo}>
            {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pay_at_pickup' ? 'Pay at Pickup' : 'Failed'} • LKR {order.totalLkr.toLocaleString()}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {isPlaced && (
          <>
            <Pressable 
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={onReject}
            >
              <Text style={styles.btnSecondaryText}>Reject</Text>
            </Pressable>
            
            <Pressable 
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={onAccept}
            >
              <Text style={styles.btnPrimaryText}>Accept</Text>
            </Pressable>
          </>
        )}
        
        <Pressable 
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed, !isPlaced && { flexGrow: 1 }]}
          onPress={() => router.push({ pathname: "/(shop)/shop-order-details", params: { orderId: order.id } })}
        >
          <Text style={styles.btnSecondaryText}>
            Order Details
          </Text>
        </Pressable>

        {isReady && (
          <Pressable 
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, { width: '100%' }]}
            onPress={onStage}
          >
            <Text style={styles.btnPrimaryText}>Stage to Counter Ledge</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerBrand: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  headerSubtitle: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 12,
  },
  profileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1D5DB",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#111827",
  },
  tabText: {
    color: "#4B5563",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#111827",
  },
  tabBadge: {
    backgroundColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: "#111827",
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "700",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  syncText: {fontWeight: "400", fontSize: 12,
    color: "#4B5563",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  chipsScroll: {
    marginBottom: 16,
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    height: 36,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  urgency: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  section: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  pickupInfo: {fontWeight: "400", fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  paymentInfo: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    flexGrow: 1,
  },
  btnSecondary: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    flexGrow: 1,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  btnSecondaryText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 15,
  },
});
