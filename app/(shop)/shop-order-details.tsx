import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ShopOrder, ShopOrderItem } from "@/types/shopOrder";
import { getShopOrderById, updateOrderStatus, staffGetOrderDetails, staffAcceptOrder, staffSetOrderStatus, getLocalStaffSession } from "@/services/shopService";


export default function ShopOrderDetails() {
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

  const handleAccept = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        await staffAcceptOrder(staffToken, order.id);
      } else {
        await updateOrderStatus(order.id, "accepted");
      }
      await loadOrder(order.id);
    } catch (err: any) {
      alert(err.message || "Failed to accept order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartPacking = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const staffToken = await getLocalStaffSession();
      if (staffToken) {
        await staffSetOrderStatus(staffToken, order.id, "packing");
      } else {
        await updateOrderStatus(order.id, "packing");
      }
      router.push({ pathname: "/(shop)/packing", params: { orderId: order.id } });
    } catch (err: any) {
      alert(err.message || "Failed to start packing");
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinuePacking = () => {
    if (!order) return;
    router.push({ pathname: "/(shop)/packing", params: { orderId: order.id } });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00A859" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderId || error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order Details</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{error || "Order not found"}</Text>
          <Text style={styles.emptyText}>Open an order from the Orders screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusBadge = () => {
    switch (order.status) {
      case "placed": return { text: "NEW", color: "#0052CC", bg: "#DEEBFF" };
      case "accepted": return { text: "ACCEPTED", color: "#00A859", bg: "#E6F7ED" };
      case "packing": return { text: "PACKING", color: "#F5A623", bg: "#FFF5E6" };
      case "ready": return { text: "READY", color: "#00A859", bg: "#E6F7ED" };
      case "collected": return { text: "COMPLETED", color: "#1E2030", bg: "#E0E0EB" };
      case "cancelled": return { text: "CANCELLED", color: "#D0021B", bg: "#FFEBEB" };
      default: return { text: String(order.status).toUpperCase(), color: "#4A4A68", bg: "#F0F0F5" };
    }
  };
  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.orderRef}>#{order.reference || order.id.substring(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name:</Text>
            <Text style={styles.detailValue}>{order.customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValue}>{order.customerPhone || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Travel Method:</Text>
            <Text style={styles.detailValue}>{order.travelMethod ? order.travelMethod.charAt(0).toUpperCase() + order.travelMethod.slice(1) : "N/A"}</Text>
          </View>
          <View style={styles.detailRowVertical}>
            <Text style={styles.detailLabel}>Packing Instructions:</Text>
            <Text style={styles.detailValueNote}>{order.packingInstructions || "No special packing instructions"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup Time:</Text>
            <Text style={styles.detailValue}>
              {order.pickupStartAt ? new Date(order.pickupStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ASAP"}
            </Text>
          </View>
          {order.pickupStartAt && order.pickupEndAt ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Window:</Text>
              <Text style={styles.detailValue}>
                {new Date(order.pickupStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(order.pickupEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup PIN:</Text>
            <Text style={styles.detailValueStrong}>{order.pickupPin}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.basketHeader}>
            <Text style={styles.sectionTitle}>Basket Items</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{order.items?.length || 0}</Text>
            </View>
          </View>

          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
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
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemSubText}>{item.productUnit}</Text>
                <Text style={styles.itemSubText}>Qty: {item.quantity} × LKR {item.unitPriceLkr.toLocaleString()}</Text>
                {item.substitution?.type !== "none" && (
                  <Text style={styles.substitutionText}>Substitution: {item.substitution?.type}</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>
                LKR {(item.unitPriceLkr * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Subtotal:</Text>
            <Text style={styles.detailValue}>LKR {order.subtotalLkr.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Savings:</Text>
            <Text style={styles.detailValue}>LKR {order.savingsLkr.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service Fee:</Text>
            <Text style={styles.detailValue}>LKR {order.serviceFeeLkr.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabelStrong}>Total:</Text>
            <Text style={styles.detailValueStrong}>LKR {order.totalLkr.toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method:</Text>
            <Text style={styles.detailValue}>{order.paymentMethod === 'card' ? 'Card' : order.paymentMethod === 'pickup' ? 'Pay at Pickup' : order.paymentMethod}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Status:</Text>
            <Text style={styles.detailValue}>{order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pay_at_pickup' ? 'Pay at Pickup' : 'Failed'}</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {order.status === "placed" && (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, actionLoading && { opacity: 0.5 }]}
              onPress={handleAccept}
              disabled={actionLoading}
            >
              <Text style={styles.btnPrimaryText}>{actionLoading ? "Accepting..." : "Accept Order"}</Text>
            </Pressable>
          )}
          {order.status === "accepted" && (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, actionLoading && { opacity: 0.5 }]}
              onPress={handleStartPacking}
              disabled={actionLoading}
            >
              <Text style={styles.btnPrimaryText}>{actionLoading ? "Starting..." : "Start Packing"}</Text>
            </Pressable>
          )}
          {order.status === "packing" && (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={handleContinuePacking}
            >
              <Text style={styles.btnPrimaryText}>Continue Packing</Text>
            </Pressable>
          )}
          {order.status === "ready" && (
            <View style={styles.readyContainer}>
              <Text style={styles.readyText}>Order ready for pickup</Text>
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
    backgroundColor: "#F8F8FC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#8A8A9E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E2030",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F5",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderRef: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E2030",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontWeight: "700",
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailRowVertical: {
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#8A8A9E",
  },
  detailLabelStrong: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E2030",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1E2030",
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailValueStrong: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E2030",
  },
  detailValueNote: {
    fontSize: 14,
    color: "#1E2030",
    marginTop: 4,
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
    width: 48,
    height: 48,
    backgroundColor: "#F1F1F7",
    borderRadius: 10,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F1F1F7",
    marginRight: 12,
  },
  itemImageFallbackText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#A0A0B8",
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
  substitutionText: {
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
  divider: {
    height: 1,
    backgroundColor: "#F0F0F5",
    marginVertical: 12,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#8A8A9E",
    textAlign: "center",
  },
  readyContainer: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#E6F7ED",
    borderRadius: 12,
  },
  readyText: {
    color: "#00A859",
    fontSize: 16,
    fontWeight: "700",
  }
});
