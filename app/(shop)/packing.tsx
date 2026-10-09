import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ShopOrder } from "@/types/shopOrder";
import { getShopOrderById, updateOrderStatus, updatePackingItem, staffGetOrderDetails, staffSetOrderStatus, staffSetOrderItemPacked, getLocalStaffSession } from "@/services/shopService";
import { colors } from "@/constants/colors";


export default function Packing() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const loadOrder = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const staffToken = await getLocalStaffSession();
      const data = staffToken ? await staffGetOrderDetails(staffToken, id) : await getShopOrderById(id);
      if (!data) {
        setError("Order not found");
      } else {
        setOrder(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePacked = async (itemId: string, currentPackedState: boolean) => {
    try {
      // Optimistic update
      setOrder(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items?.map(item =>
            item.id === itemId
              ? { ...item, isPacked: !currentPackedState, packedAt: !currentPackedState ? new Date().toISOString() : null }
              : item
          )
        };
      });
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        await staffSetOrderItemPacked(staffToken, itemId, !currentPackedState);
      } else {
        await updatePackingItem(itemId, !currentPackedState);
      }
    } catch (err: any) {
      console.error("Failed to pack item:", err);
      // Revert if failed
      if (orderId) loadOrder(orderId);
      alert("Could not update this item. Please try again.");
    }
  };

  const handleMarkReady = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        await staffSetOrderStatus(staffToken, order.id, "ready");
      } else {
        await updateOrderStatus(order.id, "ready");
      }
      router.push("/(shop)/new-orders");
    } catch (err: any) {
      alert(err.message || "Failed to mark order ready");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading packing details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderId || error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Packing Order</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{error || "Order not found"}</Text>
          <Text style={styles.emptyText}>Open an order from the Orders screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const items = order.items || [];
  const totalItems = items.length;
  const packedItems = items.filter(i => i.isPacked).length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100);
  const isAllPacked = totalItems > 0 && packedItems === totalItems;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Packing Order</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Summary */}
        <View style={styles.summarySection}>
          <View style={styles.rowBetween}>
            <Text style={styles.orderRef}>#{order.reference || order.id.substring(0,8)}</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>PACKING</Text>
            </View>
          </View>
          <Text style={styles.customerName}>{order.customerName}</Text>
          <Text style={styles.pickupInfo}>
            Pickup {order.pickupStartAt ? new Date(order.pickupStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ASAP"}
            {order.travelMethod ? ` • ${order.travelMethod.charAt(0).toUpperCase() + order.travelMethod.slice(1)}` : ""}
          </Text>

          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>{packedItems} of {totalItems} items packed</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Special Instructions */}
        {order.packingInstructions ? (
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>SPECIAL INSTRUCTIONS</Text>
            <Text style={styles.instructionText}>{order.packingInstructions}</Text>
            {order.travelMethod ? (
              <View style={styles.travelBadge}>
                <Text style={styles.travelBadgeText}>For {order.travelMethod} transport</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Items to Pack */}
        <Text style={styles.sectionTitle}>ITEMS TO PACK</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemRow}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.itemImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Text style={styles.itemImageFallbackText}>{item.productName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.itemDetails}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemSubText}>{item.productUnit}</Text>
                <Text style={styles.itemPrice}>LKR {item.unitPriceLkr.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.scanBtnDisabled}>
                <Text style={styles.scanBtnDisabledText}>Scan unavailable</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  item.isPacked ? styles.btnPacked : styles.btnMarkPacked,
                  pressed && styles.btnPressed
                ]}
                onPress={() => handleTogglePacked(item.id, item.isPacked)}
              >
                <Text style={item.isPacked ? styles.btnPackedText : styles.btnMarkPackedText}>
                  {item.isPacked ? "✓ Packed" : "Mark Packed"}
                </Text>
              </Pressable>
            </View>
            {item.isPacked && item.packedAt && (
              <Text style={styles.packedTimeText}>
                Packed at {new Date(item.packedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        ))}

        {/* Bottom Action Area */}
        <View style={styles.bottomActionContainer}>
          {isAllPacked ? (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, actionLoading && { opacity: 0.5 }]}
              onPress={handleMarkReady}
              disabled={actionLoading}
            >
              <Text style={styles.btnPrimaryText}>{actionLoading ? "Updating..." : "Mark Order Ready"}</Text>
            </Pressable>
          ) : (
            <View style={styles.incompleteContainer}>
              <Text style={styles.incompleteText}>{packedItems} of {totalItems} items packed</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#4B5563",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
  },
  summarySection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderRef: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  liveBadge: {
    backgroundColor: "#FEF3C2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F59E0B",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  pickupInfo: {fontWeight: "400", fontSize: 14,
    color: "#4B5563",
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "600",
  },
  progressPercent: {
    color: "#16A34A",
    fontSize: 13,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#16A34A",
  },
  instructionCard: {
    backgroundColor: "#FEF3C2",
    borderWidth: 1,
    borderColor: "#FEF3C2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  instructionText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 12,
  },
  travelBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  travelBadgeText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    marginRight: 12,
  },
  itemImageFallbackText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4B5563",
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  itemSubText: {fontWeight: "400", fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  scanBtnDisabled: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  scanBtnDisabledText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 14,
  },
  btnMarkPacked: {
    flex: 2,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnMarkPackedText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 14,
  },
  btnPacked: {
    flex: 2,
    backgroundColor: "#DCFCE7",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnPackedText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 14,
  },
  packedTimeText: {fontWeight: "400", fontSize: 12,
    color: "#4B5563",
    textAlign: "right",
    marginTop: 8,
  },
  btnPressed: {
    opacity: 0.8,
  },
  bottomActionContainer: {
    marginTop: 16,
  },
  btnPrimary: {
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  incompleteContainer: {
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  incompleteText: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "600",
  }
});
