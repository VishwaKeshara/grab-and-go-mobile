import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Pressable, PressableStateCallbackType } from "react-native";
import { router } from "expo-router";
import { ShopOrder, ShopOrderStatus, ShopOrderItem } from "@/types/shopOrder";

// --- Mock Data ---
interface ExtendedShopOrder extends Omit<ShopOrder, 'items'> {
  // Mock data includes an items array with missing items handled locally
  items?: ShopOrderItem[];
  urgencyLabel?: string;
  timeLeft?: string;
  tier?: string;
  orderCount?: number;
  transport?: string;
  payment?: string;
  stagingBay?: string;
  proximity?: string;
  packingStateLabel?: string;
}

const INITIAL_MOCK_ORDERS: ExtendedShopOrder[] = [
  {
    id: "GNG-MLB-9042",
    shopId: "shop-1",
    customerId: "cust-1",
    reference: "GG-2026-9042",
    pickupPin: "5182",
    customerName: "Dinithi Perera",
    customerPhone: "0000000000",
    status: "placed",
    packingStatus: "unpacked",
    totalLkr: 3100,
    subtotalLkr: 3100,
    savingsLkr: 0,
    serviceFeeLkr: 0,
    paymentMethod: "card",
    paymentStatus: "paid",
    packingInstructions: "",
    travelMethod: "walking",
    pickupStartAt: "2026-10-02T17:30:00+05:30",
    pickupEndAt: "2026-10-02T18:00:00+05:30",
    createdAt: "2026-10-02T17:12:00+05:30",
    updatedAt: "2026-10-02T17:12:00+05:30",
    acceptedAt: null,
    packingStartedAt: null,
    readyAt: null,
    urgencyLabel: "URGENT",
    timeLeft: "01:42",
    tier: "VIP Commuter Tier 3",
    orderCount: 28,
    transport: "Motorcycle Commute",
    payment: "LankaQR PAID",
  },
  {
    id: "GNG-MLB-9048",
    shopId: "shop-1",
    customerId: "cust-2",
    reference: "GG-2026-9048",
    pickupPin: "1111",
    customerName: "N/A",
    customerPhone: "0000000000",
    status: "placed",
    packingStatus: "unpacked",
    totalLkr: 1890,
    subtotalLkr: 1890,
    savingsLkr: 0,
    serviceFeeLkr: 0,
    paymentMethod: "card",
    paymentStatus: "paid",
    packingInstructions: "",
    travelMethod: "walking",
    items: [
      {
        id: "item-1",
        orderId: "GNG-MLB-9048",
        productId: "prod-1",
        productName: "Araliya Samba Rice 5kg",
        quantity: 1,
        unitPriceLkr: 1000,
        productUnit: "5kg",
        imageUrl: null,
        substitution: { type: "call" },
        isPacked: false,
        packedAt: null,
      },
      {
        id: "item-2",
        orderId: "GNG-MLB-9048",
        productId: "prod-2",
        productName: "Premium Red Mysore Dhal 1kg",
        quantity: 1,
        unitPriceLkr: 890,
        productUnit: "1kg",
        imageUrl: null,
        substitution: { type: "call" },
        isPacked: false,
        packedAt: null,
      },
    ],
    pickupStartAt: "2026-10-02T18:15:00+05:30",
    pickupEndAt: "2026-10-02T18:30:00+05:30",
    createdAt: "2026-10-02T17:14:00+05:30",
    updatedAt: "2026-10-02T17:14:00+05:30",
    acceptedAt: null,
    packingStartedAt: null,
    readyAt: null,
    urgencyLabel: "NEW INTAKE",
  },
  {
    id: "GNG-MLB-9039",
    shopId: "shop-1",
    customerId: "cust-3",
    reference: "GG-2026-9039",
    pickupPin: "9999",
    customerName: "R. Fernando",
    customerPhone: "0000000000",
    status: "ready",
    packingStatus: "fully_packed",
    totalLkr: 4620,
    subtotalLkr: 4620,
    savingsLkr: 0,
    serviceFeeLkr: 0,
    paymentMethod: "card",
    paymentStatus: "paid",
    packingInstructions: "",
    travelMethod: "walking",
    pickupStartAt: "2026-10-02T17:45:00+05:30",
    pickupEndAt: "2026-10-02T18:00:00+05:30",
    createdAt: "2026-10-02T17:00:00+05:30",
    updatedAt: "2026-10-02T17:30:00+05:30",
    acceptedAt: "2026-10-02T17:05:00+05:30",
    packingStartedAt: "2026-10-02T17:10:00+05:30",
    readyAt: "2026-10-02T17:30:00+05:30",
    stagingBay: "Staging Bay #B-01",
    proximity: "Within 500m - Proximity Ping Received",
    packingStateLabel: "Packed & Sealed in Thermal Bag",
  },
];

type FilterTab = "All Incoming" | "Being Packed" | "Ready";
type FilterChip = "Pickup <20 Mins" | "Motorcycle Pickup";

export default function NewOrders() {
  const [orders, setOrders] = useState<ExtendedShopOrder[]>(INITIAL_MOCK_ORDERS);
  const [activeTab, setActiveTab] = useState<FilterTab>("All Incoming");
  const [selectedChips, setSelectedChips] = useState<FilterChip[]>([]);

  const handleStatusChange = (orderId: string, newStatus: ShopOrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
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

    // simplistic chip filtering just for visual mock demo
    if (selectedChips.includes("Pickup <20 Mins") && o.urgencyLabel !== "URGENT") return false;
    if (selectedChips.includes("Motorcycle Pickup") && o.transport !== "Motorcycle Commute") return false;

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>MALABE EXPRESS</Text>
          <Text style={styles.headerTitle}>New Orders</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>OPEN</Text>
          </View>
        </View>
        <View style={styles.profileBadge} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SLA Card */}
        <View style={styles.slaCard}>
          <Text style={styles.slaTitle}>COUNTER QUEUE SLA</Text>
          <Text style={styles.slaSubtitle}>Express Queue: Normal Flow</Text>
          <Text style={styles.slaTime}>~ 38s</Text>
        </View>

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
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAccept={() => handleStatusChange(order.id, "accepted")}
            onReject={() => handleStatusChange(order.id, "cancelled")}
            onStage={() => handleStatusChange(order.id, "collected")}
          />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, onAccept, onReject, onStage }: { order: ExtendedShopOrder, onAccept: () => void, onReject: () => void, onStage: () => void }) {
  const isReady = order.status === "ready";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{order.id}</Text>
        {order.urgencyLabel && (
          <Text style={[styles.urgency, order.urgencyLabel === "URGENT" && styles.urgencyRed]}>
            {order.urgencyLabel}
          </Text>
        )}
      </View>

      <Text style={styles.receivedTime}>
        Received {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>

      {order.timeLeft && (
        <Text style={styles.timeLeft}>{order.timeLeft} left</Text>
      )}

      {/* Customer Info */}
      {(order.customerName !== "N/A" || order.tier) && (
        <View style={styles.section}>
          <Text style={styles.sectionText}>Customer: {order.customerName}</Text>
          {order.tier && <Text style={styles.sectionText}>{order.tier} • {order.orderCount} orders</Text>}
        </View>
      )}

      {/* Delivery / Pickup Info */}
      <View style={styles.section}>
        {order.transport && <Text style={styles.sectionText}>Transport: {order.transport}</Text>}
        {order.payment && <Text style={styles.sectionText}>Payment: {order.payment}</Text>}
        {order.stagingBay && <Text style={styles.sectionText}>{order.stagingBay}</Text>}
        {order.proximity && <Text style={styles.proximityText}>{order.proximity}</Text>}
        {order.packingStateLabel && <Text style={styles.sectionText}>{order.packingStateLabel}</Text>}
      </View>

      {/* Items list if available */}
      {order.items && order.items.length > 0 && (
        <View style={styles.section}>
          {order.items.map(item => (
            <Text key={item.id} style={styles.sectionText}>- {item.productName}</Text>
          ))}
        </View>
      )}

      {!order.items && (
        <View style={styles.section}>
          <Text style={styles.sectionText}>Items: {(order as any).itemCount || 0} items</Text>
        </View>
      )}

      <Text style={styles.totalText}>Total: LKR {order.totalLkr.toLocaleString()}</Text>

      {/* Actions */}
      <View style={styles.actions}>
        {!isReady && (
          <>
            <Pressable 
              style={({ pressed }: { pressed: boolean }) => [styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={onReject}
            >
              <Text style={styles.btnSecondaryText}>Reject</Text>
            </Pressable>
            
            {order.id === "GNG-MLB-9042" ? (
              <Pressable 
                style={({ pressed }: { pressed: boolean }) => [styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={() => {
                  onAccept();
                  router.push("/(shop)/packing");
                }}
              >
                <Text style={styles.btnPrimaryText}>Accept & Start Packing</Text>
              </Pressable>
            ) : (
              <Pressable 
                style={({ pressed }: { pressed: boolean }) => [styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={onAccept}
              >
                <Text style={styles.btnPrimaryText}>Accept</Text>
              </Pressable>
            )}
            
            <Pressable 
              style={({ pressed }: { pressed: boolean }) => [styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={() => router.push("/(shop)/shop-order-details")}
            >
              <Text style={styles.btnSecondaryText}>
                {order.id === "GNG-MLB-9048" ? "Review Basket" : "Order Details"}
              </Text>
            </Pressable>
          </>
        )}

        {isReady && (
          <Pressable 
            style={({ pressed }: { pressed: boolean }) => [styles.btnPrimary, pressed && styles.btnPressed, { width: '100%' }]}
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
    backgroundColor: "#F8F8FC", // light lavender/off-white
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // padding for ShopNavbar
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
    color: "#4A4A68",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E2030", // dark navy
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: "#E6F7ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    color: "#00A859", // mint accent
    fontWeight: "700",
    fontSize: 12,
  },
  profileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D0D0E0",
  },
  slaCard: {
    backgroundColor: "#1E2030", // dark navy card
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slaTitle: {
    color: "#A0A0B8",
    fontSize: 12,
    fontWeight: "600",
  },
  slaSubtitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  slaTime: {
    color: "#00A859", // mint accent
    fontSize: 24,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0EB",
    marginBottom: 16,
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
    borderBottomColor: "#1E2030",
  },
  tabText: {
    color: "#8A8A9E",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#1E2030",
  },
  tabBadge: {
    backgroundColor: "#E0E0EB",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: "#1E2030",
  },
  tabBadgeText: {
    fontSize: 10,
    color: "#4A4A68",
    fontWeight: "bold",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  chipsScroll: {
    marginBottom: 16,
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    height: 36,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "#1E2030",
    borderColor: "#1E2030",
  },
  chipText: {
    color: "#4A4A68",
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextSelected: {
    color: "#FFFFFF",
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
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  orderId: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E2030",
  },
  urgency: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F5A623", // amber warning
    backgroundColor: "#FFF5E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  urgencyRed: {
    color: "#D0021B", // red/coral accent
    backgroundColor: "#FFEBEB",
  },
  receivedTime: {
    fontSize: 13,
    color: "#8A8A9E",
    marginBottom: 4,
  },
  timeLeft: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D0021B",
    marginBottom: 12,
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
  },
  sectionText: {
    fontSize: 14,
    color: "#4A4A68",
    marginBottom: 4,
  },
  proximityText: {
    fontSize: 14,
    color: "#F5A623",
    fontWeight: "600",
    marginBottom: 4,
  },
  totalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    marginTop: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: "#00A859",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    flexGrow: 1,
  },
  btnSecondary: {
    backgroundColor: "#F0F0F5",
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
    fontWeight: "700",
    fontSize: 14,
  },
  btnSecondaryText: {
    color: "#1E2030",
    fontWeight: "600",
    fontSize: 14,
  },
});
