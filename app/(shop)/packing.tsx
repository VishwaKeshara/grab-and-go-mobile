import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { router } from "expo-router";
import { ShopOrderItem } from "@/types/shopOrder";

// --- Mock Data & Types ---
interface ExtendedShopOrderItem extends ShopOrderItem {
  location: string;
  isFragile?: boolean;
  fragileNote?: string;
  isVerified?: boolean;
}

const INITIAL_MOCK_ITEMS: ExtendedShopOrderItem[] = [
  {
    id: "item-1",
    orderId: "GNG-MLB-9042",
    productId: "prod-1",
    productName: "Araliya Keeri Samba 5kg",
    quantity: 1,
    unitPriceLkr: 1500,
    productUnit: "5kg",
    imageUrl: null,
    substitution: { type: "none" },
    isPacked: true,
    packedAt: "2026-10-02T17:18:00+05:30",
    location: "Aisle 2 • Grain Bay 03",
    isVerified: true,
  },
  {
    id: "item-2",
    orderId: "GNG-MLB-9042",
    productId: "prod-2",
    productName: "Mysore Dhal Pouch 1kg",
    quantity: 1,
    unitPriceLkr: 420,
    productUnit: "1kg",
    imageUrl: null,
    substitution: { type: "none" },
    isPacked: true,
    packedAt: "2026-10-02T17:19:00+05:30",
    location: "Dry Goods Bin 08",
    isVerified: true,
  },
  {
    id: "item-3",
    orderId: "GNG-MLB-9042",
    productId: "prod-3",
    productName: "Highland Fresh Milk 1L",
    quantity: 2,
    unitPriceLkr: 500,
    productUnit: "1L",
    imageUrl: null,
    substitution: { type: "none" },
    isPacked: false,
    packedAt: null,
    location: "Chiller Bay #01",
  },
  {
    id: "item-4",
    orderId: "GNG-MLB-9042",
    productId: "prod-4",
    productName: "Country Farm Eggs 10pk",
    quantity: 1,
    unitPriceLkr: 440,
    productUnit: "10pk",
    imageUrl: null,
    substitution: { type: "none" },
    isPacked: false,
    packedAt: null,
    location: "Counter Lake E-01",
    isFragile: true,
    fragileNote: "Place inside top commuter crate",
  },
];

export default function Packing() {
  const [items, setItems] = useState<ExtendedShopOrderItem[]>(INITIAL_MOCK_ITEMS);
  const [orderMoved, setOrderMoved] = useState(false);

  const totalItems = items.length;
  const packedItems = items.filter((item) => item.isPacked).length;
  const progressPercent = Math.round((packedItems / totalItems) * 100);
  const isAllPacked = packedItems === totalItems;

  const handleTapPacked = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, isPacked: true, isVerified: true }
          : item
      )
    );
  };

  const handleMoveToBay = () => {
    if (isAllPacked) {
      setOrderMoved(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"< Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packing Screen</Text>
        <View style={styles.profileBadge} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Summary & Bagger Assignment */}
        <View style={styles.assignmentSection}>
          <View style={styles.orderSummaryCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.orderRef}>#GNG-MLB-9042</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE PACKING</Text>
              </View>
            </View>
            <Text style={styles.stagingText}>Staging Bay: Shelf #B-02</Text>
            <Text style={styles.crateText}>Crate: 04</Text>
          </View>

          <View style={styles.baggerCard}>
            <Text style={styles.baggerLabel}>ASSIGNED BAGGER</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.baggerName}>Nalin K. (Bagger #01)</Text>
              <Text style={styles.targetTime}>target time 03:42</Text>
            </View>
            
            {/* Progress */}
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{packedItems} of {totalItems} Items Picked</Text>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Special Instructions Card */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>MOTORCYCLE COMMUTER SPEC</Text>
          <Text style={styles.instructionText}>• Double kraft bag base</Text>
          <Text style={styles.instructionText}>• Egg protective sleeve</Text>
          <Text style={styles.instructionNote}>Ensure transit stability for motorcycle commuter.</Text>
        </View>

        {/* Pick & Verify Items */}
        <Text style={styles.sectionTitle}>Pick & Verify Items</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
            </View>
            <Text style={styles.itemLocation}>{item.location}</Text>

            {item.isFragile && (
              <View style={styles.fragileBox}>
                <Text style={styles.fragileTag}>FRAGILE</Text>
                <Text style={styles.fragileNote}>{item.fragileNote}</Text>
              </View>
            )}

            {item.isPacked ? (
              <View style={styles.packedStateBox}>
                <Text style={styles.verifiedText}>✓ Barcode Verified</Text>
              </View>
            ) : (
              <View style={styles.unpackedActionRow}>
                <TouchableOpacity style={styles.btnScan}>
                  <Text style={styles.btnScanText}>[|||] Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnTapPacked}
                  onPress={() => handleTapPacked(item.id)}
                >
                  <Text style={styles.btnTapPackedText}>Tap Packed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Handoff Bag Tagging */}
        <View style={styles.handoffCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.handoffTitle}>Commuter Tag #5182</Text>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>Ready to Print</Text>
            </View>
          </View>
          <Text style={styles.handoffText}>• 2 Kraft Bags Prepared</Text>
          <Text style={styles.handoffText}>• Thermal Pouch Attached</Text>
          
          <TouchableOpacity style={styles.btnPrint}>
            <Text style={styles.btnPrintText}>Print Tag #5182</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Action */}
        <View style={styles.bottomActionContainer}>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.btnMoveBay,
              !isAllPacked && styles.btnMoveBayDisabled,
              pressed && isAllPacked && styles.btnPressed,
              orderMoved && styles.btnMoveBaySuccess,
            ]}
            disabled={!isAllPacked || orderMoved}
            onPress={handleMoveToBay}
          >
            <Text style={styles.btnMoveBayText}>
              {orderMoved
                ? "Order Staged Successfully"
                : isAllPacked
                ? "Move Order to Staging Bay"
                : `Pick ${totalItems - packedItems} More to Move to Bay`}
            </Text>
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
  profileBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D0D0E0",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  assignmentSection: {
    backgroundColor: "#1E2030", // deep navy/purple
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderSummaryCard: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#323546",
    paddingBottom: 12,
  },
  orderRef: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  liveBadge: {
    backgroundColor: "#F5A623",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1E2030",
  },
  stagingText: {
    color: "#A0A0B8",
    fontSize: 14,
    marginBottom: 2,
  },
  crateText: {
    color: "#A0A0B8",
    fontSize: 14,
  },
  baggerCard: {},
  baggerLabel: {
    color: "#8A8A9E",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  baggerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  targetTime: {
    color: "#D0021B", // amber/red warning for time
    fontSize: 14,
    fontWeight: "600",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  progressText: {
    color: "#A0A0B8",
    fontSize: 13,
  },
  progressPercent: {
    color: "#00A859",
    fontSize: 13,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#323546",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00A859",
  },
  instructionCard: {
    backgroundColor: "#FFEBEB", // warning background
    borderWidth: 1,
    borderColor: "#FFD6D6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionTitle: {
    color: "#D0021B",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  instructionText: {
    color: "#1E2030",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  instructionNote: {
    color: "#4A4A68",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E2030",
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    flex: 1,
    marginRight: 8,
  },
  itemQty: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
  },
  itemLocation: {
    fontSize: 14,
    color: "#8A8A9E",
    marginBottom: 12,
  },
  fragileBox: {
    backgroundColor: "#FFF5E6",
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  fragileTag: {
    color: "#F5A623",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  fragileNote: {
    color: "#1E2030",
    fontSize: 13,
  },
  packedStateBox: {
    backgroundColor: "#E6F7ED",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  verifiedText: {
    color: "#00A859",
    fontWeight: "700",
    fontSize: 14,
  },
  unpackedActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  btnScan: {
    flex: 1,
    backgroundColor: "#F0F0F5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnScanText: {
    color: "#1E2030",
    fontWeight: "600",
    fontSize: 14,
  },
  btnTapPacked: {
    flex: 2,
    backgroundColor: "#00A859",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnTapPackedText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  handoffCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0E0EB",
  },
  handoffTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
  },
  readyBadge: {
    backgroundColor: "#E0E0EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  readyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A4A68",
  },
  handoffText: {
    fontSize: 14,
    color: "#4A4A68",
    marginTop: 4,
  },
  btnPrint: {
    marginTop: 16,
    backgroundColor: "#1E2030",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnPrintText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  bottomActionContainer: {
    marginTop: 8,
  },
  btnMoveBay: {
    backgroundColor: "#00A859",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnMoveBayDisabled: {
    backgroundColor: "#D0D0E0",
  },
  btnMoveBaySuccess: {
    backgroundColor: "#1E2030",
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnMoveBayText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
