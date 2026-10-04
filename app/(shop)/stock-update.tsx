import { supabase } from "@/lib/supabase";
import { getShopByProfileId, getInventory, updateStock } from "@/services/shopService";
import type { InventoryItem } from "@/types/product";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Switch, Pressable } from "react-native";
import { router } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

type FilterType = "All" | "Low Stock" | "Out of Stock";

export default function StockUpdate() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const fetchInventory = async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const shop = await getShopByProfileId(userId);
      if (!shop) throw new Error("Shop not found");
      setShopId(shop.id);
      setShopName(shop.name);
      
      const items = await getInventory(shop.id);
      setInventory(items || []);
      setLastSyncedAt(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const checkSessionAndFetch = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/(shop)/shop-login");
        return;
      }
      setSessionChecked(true);
      await fetchInventory(session.user.id);
    } catch (err: any) {
      setError("Session error. Please login again.");
    }
  };

  useEffect(() => {
    checkSessionAndFetch();
  }, []);

  const handleRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchInventory(session.user.id);
    }
  };

  const handleQuantityUpdate = async (newQty: number, productId: string, isAvailable: boolean) => {
    if (newQty < 0) return;
    try {
      await updateStock(shopId, productId, newQty, isAvailable);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchInventory(session.user.id);
    } catch (err: any) {
      alert(err.message || "Failed to update stock");
    }
  };

  const toggleAvailability = async (currentAvail: boolean, quantity: number, productId: string) => {
    try {
      await updateStock(shopId, productId, quantity, !currentAvail);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchInventory(session.user.id);
    } catch (err: any) {
      alert(err.message || "Failed to update availability");
    }
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (activeFilter === "Low Stock" && (item.quantity === 0 || item.quantity > item.lowStockThreshold)) return false;
      if (activeFilter === "Out of Stock" && item.quantity > 0) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.product.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [inventory, searchQuery, activeFilter]);

  const counts = useMemo(() => {
    return {
      all: inventory.length,
      low: inventory.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length,
      out: inventory.filter(i => i.quantity === 0).length,
    };
  }, [inventory]);

  if (!sessionChecked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#4A4A68' }}>Checking session...</Text>
      </View>
    );
  }

  const renderEmptyState = () => {
    let title = "";
    let subtitle = "";
    if (activeFilter === "All") {
      title = "No inventory items";
      subtitle = "Products assigned to this shop will appear here.";
    } else if (activeFilter === "Low Stock") {
      title = "No low-stock items";
      subtitle = "Stock levels are currently healthy.";
    } else {
      title = "No out-of-stock items";
      subtitle = "All available products currently have stock.";
    }

    return (
      <View style={styles.emptyStateCard}>
        <FontAwesome name="inbox" size={32} color="#D0D0E0" style={{ marginBottom: 12 }} />
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerBrand}>{shopName ? shopName.toUpperCase() : "YOUR SHOP"}</Text>
          <Text style={styles.headerTitle}>Stock Update</Text>
          <Text style={styles.headerSubtitle}>Manage product availability and stock</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>OPEN</Text>
        </View>
        <View style={styles.profileBadge} />
      </View>

      {/* Sync Status Row */}
      <View style={styles.syncRow}>
        <Text style={styles.syncText}>
          {loading ? "Syncing..." : lastSyncedAt ? "Last synced just now" : "Not synced"}
        </Text>
        <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
          <FontAwesome name="refresh" size={12} color="#8A8A9E" />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBar}>
          <FontAwesome name="search" size={14} color="#8A8A9E" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            placeholderTextColor="#8A8A9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === "All" && styles.filterChipActive]}
          onPress={() => setActiveFilter("All")}
        >
          <Text style={[styles.filterChipText, activeFilter === "All" && styles.filterChipTextActive]}>
            All Items {counts.all}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === "Low Stock" && styles.filterChipActive]}
          onPress={() => setActiveFilter("Low Stock")}
        >
          <Text style={[styles.filterChipText, activeFilter === "Low Stock" && styles.filterChipTextActive]}>
            Low Stock {counts.low}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === "Out of Stock" && styles.filterChipActive]}
          onPress={() => setActiveFilter("Out of Stock")}
        >
          <Text style={[styles.filterChipText, activeFilter === "Out of Stock" && styles.filterChipTextActive]}>
            Out of Stock {counts.out}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={checkSessionAndFetch}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : loading && inventory.length === 0 ? (
          <Text style={styles.stateText}>Loading your stock levels...</Text>
        ) : filteredInventory.length === 0 ? (
          renderEmptyState()
        ) : (
          filteredInventory.map((item) => {
          const isOut = item.quantity === 0;
          const isLow = item.quantity > 0 && item.quantity <= item.lowStockThreshold;
          
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <View style={[
                    styles.stockBadge,
                    isOut ? styles.stockBadgeOut : isLow ? styles.stockBadgeLow : styles.stockBadgeIn
                  ]}>
                    <Text style={[
                      styles.stockBadgeText,
                      isOut ? styles.stockBadgeTextOut : isLow ? styles.stockBadgeTextLow : styles.stockBadgeTextIn
                    ]}>
                      {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "IN STOCK"}
                    </Text>
                  </View>
                </View>
                <View style={styles.availabilityToggle}>
                  <Text style={styles.toggleLabel}>
                    {item.isAvailable ? "ON" : "OFF"}
                  </Text>
                  <Switch
                    value={item.isAvailable}
                    onValueChange={() => toggleAvailability(item.isAvailable, item.quantity, item.product.id)}
                    trackColor={{ false: "#E0E0EB", true: "#00A859" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceValue}>LKR {item.product.priceLkr.toFixed(2)}</Text>
                </View>

                {isOut ? (
                  <View style={styles.outActions}>
                    <Pressable 
                      style={({ pressed }) => [styles.btnRestock, pressed && styles.btnPressed]}
                      onPress={() => handleQuantityUpdate(10, item.product.id, item.isAvailable)}
                    >
                      <Text style={styles.btnRestockText}>Restock +10</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.qtyControls}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => handleQuantityUpdate(item.quantity - 1, item.product.id, item.isAvailable)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity 
                      style={styles.qtyBtn}
                      onPress={() => handleQuantityUpdate(item.quantity + 1, item.product.id, item.isAvailable)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {!isOut && (
                 <View style={styles.soldOutContainer}>
                   <TouchableOpacity onPress={() => handleQuantityUpdate(0, item.product.id, item.isAvailable)}>
                     <Text style={styles.soldOutText}>Mark Sold Out</Text>
                   </TouchableOpacity>
                 </View>
              )}
            </View>
          );
        }))}
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitleContainer: {
    flex: 1,
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
    color: "#1E2030",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8A8A9E",
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: "#E6F7ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusBadgeText: {
    color: "#00A859",
    fontWeight: "700",
    fontSize: 12,
  },
  profileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D0D0E0",
  },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  syncText: {
    fontSize: 12,
    color: "#8A8A9E",
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
    color: "#8A8A9E",
    fontWeight: "600",
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E0E0EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E2030",
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0EB",
  },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: "#1E2030",
    borderColor: "#1E2030",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A4A68",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
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
    borderColor: "#F0F0F5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 8,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockBadgeIn: {
    backgroundColor: "#E6F7ED",
  },
  stockBadgeLow: {
    backgroundColor: "#FFF5E6",
  },
  stockBadgeOut: {
    backgroundColor: "#FFEBEB",
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stockBadgeTextIn: {
    color: "#00A859",
  },
  stockBadgeTextLow: {
    color: "#F5A623",
  },
  stockBadgeTextOut: {
    color: "#D0021B",
  },
  availabilityToggle: {
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A8A9E",
    marginBottom: 2,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
  },
  priceContainer: {
    flex: 1,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8FC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0EB",
  },
  qtyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4A4A68",
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    minWidth: 30,
    textAlign: "center",
  },
  outActions: {
    flexDirection: "row",
  },
  btnRestock: {
    backgroundColor: "#1E2030",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnRestockText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  btnPressed: {
    opacity: 0.8,
  },
  soldOutContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  soldOutText: {
    color: "#8A8A9E",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#8A8A9E",
    textAlign: "center",
  },
  stateText: {
    color: "#8A8A9E",
    fontSize: 14,
    padding: 32,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#FFEBEB",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#D0021B",
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#1E2030",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 16,
  },
});
