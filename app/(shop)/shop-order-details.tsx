import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Pressable } from "react-native";
import { router } from "expo-router";
import { ShopOrder, ShopOrderItem } from "@/types/shopOrder";

// --- Types & Mock Data ---
interface ExtendedShopOrderItem extends ShopOrderItem {
  substitutionNote?: string;
  packingNote?: string;
}

interface ExtendedShopOrder extends ShopOrder {
  items: ExtendedShopOrderItem[];
  velocityLabel?: string;
  velocityRank?: string;
  merchantName?: string;
  merchantLocation?: string;
  merchantDistance?: string;
  merchantBay?: string;
  merchantManager?: string;
  transportInfo?: string;
  paymentState?: string;
  specialPackingNotes?: string;
}

const MOCK_ORDER: ExtendedShopOrder = {
  id: "MLB-8821",
  shopId: "shop-1",
  customerId: "cust-1",
  reference: "GG-2026-882100",
  pickupPin: "5182",
  customerName: "Dinithi Perera",
  customerPhone: "0771234567",
  status: "collected",
  packingStatus: "fully_packed",
  totalLkr: 3450,
  subtotalLkr: 3450,
  savingsLkr: 0,
  serviceFeeLkr: 0,
  paymentMethod: "card",
  paymentStatus: "paid",
  packingInstructions: "Customer requested double bagging for heavy items.",
  travelMethod: "motorcycle",
  pickupStartAt: "2026-10-02T17:30:00+05:30",
  pickupEndAt: "2026-10-02T18:00:00+05:30",
  createdAt: "2026-10-02T17:12:00+05:30",
  updatedAt: "2026-10-02T17:15:00+05:30",
  acceptedAt: "2026-10-02T17:13:00+05:30",
  packingStartedAt: "2026-10-02T17:14:00+05:30",
  readyAt: "2026-10-02T17:20:00+05:30",
  velocityLabel: "34 seconds",
  velocityRank: "Top 5% Express",
  merchantName: "Sumanadasa Stores",
  merchantLocation: "Malabe Junction",
  merchantDistance: "450m from SLIIT Campus",
  merchantBay: "Bay B-04",
  merchantManager: "Nimal S.",
  transportInfo: "Motorcycle Commute",
  paymentState: "LankaQR PAID",
  specialPackingNotes: "Customer requested double bagging for heavy items.",
  items: [
    {
      id: "item-1",
      orderId: "MLB-8821",
      productId: "prod-1",
      productName: "Araliya Keeri Samba 5kg",
      productUnit: "5kg",
      imageUrl: null,
      quantity: 1,
      unitPriceLkr: 1490,
      substitution: { type: "call" },
      isPacked: true,
      packedAt: "2026-10-02T17:18:00+05:30",
      substitutionNote: "Substitution accepted by customer",
    },
    {
      id: "item-2",
      orderId: "MLB-8821",
      productId: "prod-2",
      productName: "Anchor Milk Powder",
      productUnit: "400g",
      imageUrl: null,
      quantity: 2,
      unitPriceLkr: 550,
      substitution: { type: "none" },
      isPacked: true,
      packedAt: "2026-10-02T17:18:30+05:30",
    },
    {
      id: "item-3",
      orderId: "MLB-8821",
      productId: "prod-3",
      productName: "Farm Fresh Brown Eggs",
      productUnit: "10 pack",
      imageUrl: null,
      quantity: 1,
      unitPriceLkr: 440,
      substitution: { type: "none" },
      isPacked: true,
      packedAt: "2026-10-02T17:19:00+05:30",
      packingNote: "Packed in protective crate",
    },
    {
      id: "item-4",
      orderId: "MLB-8821",
      productId: "prod-4",
      productName: "Mysore Dhal Red Lentils",
      productUnit: "1kg",
      imageUrl: null,
      quantity: 1,
      unitPriceLkr: 420,
      substitution: { type: "none" },
      isPacked: true,
      packedAt: "2026-10-02T17:19:30+05:30",
    },
  ],
};

export default function ShopOrderDetails() {
  const order = MOCK_ORDER;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"< Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>PICKUP ORDER</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Collected</Text>
            </View>
          </View>
          <Text style={styles.orderRef}>{order.id}</Text>
          <Text style={styles.subText}>
            {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.locationLabel}>Pickup Location:</Text>
          <Text style={styles.locationText}>Malabe Junction • Counter #02</Text>
        </View>

        {/* Performance / Handover Card */}
        <View style={styles.performanceCard}>
          <Text style={styles.performanceTitle}>Handover Velocity</Text>
          <Text style={styles.velocityLabel}>{order.velocityLabel}</Text>
          <Text style={styles.velocityRank}>{order.velocityRank}</Text>
        </View>

        {/* Partner Merchant Section */}
        <View style={styles.card}>
          <View style={styles.merchantHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{order.merchantName}</Text>
              <Text style={styles.subText}>{order.merchantLocation}</Text>
              <Text style={styles.subText}>{order.merchantDistance}</Text>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Text style={styles.callButtonText}>📞</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <Text style={styles.subText}>Staging: {order.merchantBay}</Text>
          <Text style={styles.subText}>Manager: {order.merchantManager}</Text>
        </View>

        {/* Basket Items Section */}
        <View style={styles.card}>
          <View style={styles.basketHeader}>
            <Text style={styles.sectionTitle}>Basket Items</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{order.items.length}</Text>
            </View>
          </View>

          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemImagePlaceholder} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemSubText}>Qty: {item.quantity}</Text>
                {item.quantity > 1 && (
                  <Text style={styles.itemSubText}>LKR {item.unitPriceLkr.toLocaleString(undefined, { minimumFractionDigits: 2 })} each</Text>
                )}
                {item.substitutionNote && (
                  <Text style={styles.noteText}>{item.substitutionNote}</Text>
                )}
                {item.packingNote && (
                  <Text style={styles.noteText}>{item.packingNote}</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>
                LKR {(item.unitPriceLkr * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        {/* Additional Order Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment:</Text>
            <Text style={styles.detailValue}>{order.paymentState}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup Time:</Text>
            <Text style={styles.detailValue}>
              {new Date(order.pickupStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transport:</Text>
            <Text style={styles.detailValue}>{order.transportInfo}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer:</Text>
            <Text style={styles.detailValue}>{order.customerName}</Text>
          </View>
          {order.specialPackingNotes && (
            <View style={styles.detailRowVertical}>
              <Text style={styles.detailLabel}>Special Packing Notes:</Text>
              <Text style={styles.detailValue}>{order.specialPackingNotes}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Pressable 
            style={({ pressed }: { pressed: boolean }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={() => router.push("/(shop)/packing")}
          >
            <Text style={styles.btnPrimaryText}>Start / Continue Packing</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0EB",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#00A859",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E2030",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // padding for ShopNavbar
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
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A8A9E",
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: "#E6F7ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: "#00A859",
    fontWeight: "700",
    fontSize: 12,
  },
  orderRef: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E2030",
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: "#8A8A9E",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F5",
    marginVertical: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: "#8A8A9E",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E2030",
  },
  performanceCard: {
    backgroundColor: "#1E2030",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  performanceTitle: {
    fontSize: 14,
    color: "#A0A0B8",
    fontWeight: "600",
    marginBottom: 8,
  },
  velocityLabel: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00A859",
    marginBottom: 4,
  },
  velocityRank: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  merchantHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 8,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonText: {
    fontSize: 20,
  },
  basketHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  itemCountBadge: {
    backgroundColor: "#F0F0F5",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A4A68",
  },
  itemRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: "#E0E0EB",
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E2030",
    marginBottom: 4,
  },
  itemSubText: {
    fontSize: 13,
    color: "#4A4A68",
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: "#F5A623",
    marginTop: 4,
    fontStyle: "italic",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E2030",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailRowVertical: {
    marginTop: 8,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#8A8A9E",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1E2030",
    maxWidth: '60%',
    textAlign: 'right',
  },
  actionsContainer: {
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: "#00A859",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
