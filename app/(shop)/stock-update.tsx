import { supabase } from "@/lib/supabase";
import { getShopByProfileId, getInventory, updateStock, updateLowStockThreshold } from "@/services/shopService";
import type { InventoryItem } from "@/types/product";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Switch, Pressable, Modal } from "react-native";
import { router } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

type FilterType = "All" | "Low Stock" | "Out of Stock" | "Paused";
type SortType = "A-Z" | "Lowest Stock" | "Recently Updated";

function formatTimeAgo(dateString: string) {
  if (!dateString) return "Unknown";
  const d = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Updated today`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Updated ${diffInDays}d ago`;
}

export default function StockUpdate() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [activeSort, setActiveSort] = useState<SortType>("A-Z");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Modals
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);
  const [exactQty, setExactQty] = useState("");

  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [selectedThresholdItem, setSelectedThresholdItem] = useState<InventoryItem | null>(null);
  const [exactThreshold, setExactThreshold] = useState("");

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
        router.replace("/(auth)/login?accountType=shop&shopMode=owner");
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

  const handleThresholdUpdate = async (newThreshold: number, productId: string) => {
    if (newThreshold < 0) return;
    try {
      await updateLowStockThreshold(shopId, productId, newThreshold);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchInventory(session.user.id);
    } catch (err: any) {
      alert(err.message || "Failed to update threshold");
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

  const counts = useMemo(() => {
    return {
      all: inventory.length,
      low: inventory.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold && i.isAvailable).length,
      out: inventory.filter(i => i.quantity === 0 && i.isAvailable).length,
      paused: inventory.filter(i => !i.isAvailable).length,
    };
  }, [inventory]);

  const needsAttention = useMemo(() => {
    return inventory.filter(i => i.quantity === 0 || (i.quantity <= i.lowStockThreshold) || !i.isAvailable).sort((a, b) => {
      // Prioritize out of stock, then low stock, then paused
      const getPriority = (item: InventoryItem) => {
        if (item.quantity === 0 && item.isAvailable) return 1;
        if (item.quantity > 0 && item.quantity <= item.lowStockThreshold && item.isAvailable) return 2;
        if (!item.isAvailable) return 3;
        return 4;
      };
      return getPriority(a) - getPriority(b);
    }).slice(0, 5); // top 5
  }, [inventory]);

  const filteredAndSortedInventory = useMemo(() => {
    let result = inventory.filter(item => {
      if (activeFilter === "Low Stock" && (item.quantity === 0 || item.quantity > item.lowStockThreshold || !item.isAvailable)) return false;
      if (activeFilter === "Out of Stock" && (item.quantity > 0 || !item.isAvailable)) return false;
      if (activeFilter === "Paused" && item.isAvailable) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.product.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      if (activeSort === "A-Z") {
        return a.product.name.localeCompare(b.product.name);
      } else if (activeSort === "Lowest Stock") {
        return a.quantity - b.quantity;
      } else if (activeSort === "Recently Updated") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });

    return result;
  }, [inventory, searchQuery, activeFilter, activeSort]);

  if (!sessionChecked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#4A4A68' }}>Checking session...</Text>
      </View>
    );
  }

  const openRestock = (item: InventoryItem) => {
    setSelectedRestockItem(item);
    setExactQty("");
    setRestockModalVisible(true);
  };

  const executeRestock = async (addAmount: number) => {
    if (!selectedRestockItem) return;
    await handleQuantityUpdate(selectedRestockItem.quantity + addAmount, selectedRestockItem.product.id, selectedRestockItem.isAvailable);
    setRestockModalVisible(false);
  };

  const executeExactRestock = async () => {
    if (!selectedRestockItem) return;
    const qty = parseInt(exactQty, 10);
    if (!isNaN(qty) && qty >= 0) {
      await handleQuantityUpdate(qty, selectedRestockItem.product.id, selectedRestockItem.isAvailable);
    }
    setRestockModalVisible(false);
  };

  const openThreshold = (item: InventoryItem) => {
    setSelectedThresholdItem(item);
    setExactThreshold(item.lowStockThreshold.toString());
    setThresholdModalVisible(true);
  };

  const executeThreshold = async () => {
    if (!selectedThresholdItem) return;
    const th = parseInt(exactThreshold, 10);
    if (!isNaN(th) && th >= 0) {
      await handleThresholdUpdate(th, selectedThresholdItem.product.id);
    }
    setThresholdModalVisible(false);
  };

  const getStatusDisplay = (item: InventoryItem) => {
    if (!item.isAvailable) return { label: "PAUSED", viewStyle: styles.stockBadgePaused, textStyle: styles.stockBadgeTextPaused };
    if (item.quantity === 0) return { label: "OUT OF STOCK", viewStyle: styles.stockBadgeOut, textStyle: styles.stockBadgeTextOut };
    if (item.quantity <= item.lowStockThreshold) return { label: "LOW STOCK", viewStyle: styles.stockBadgeLow, textStyle: styles.stockBadgeTextLow };
    return { label: "IN STOCK", viewStyle: styles.stockBadgeIn, textStyle: styles.stockBadgeTextIn };
  };

  const renderProductCard = (item: InventoryItem) => {
    const status = getStatusDisplay(item);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{item.product.name}</Text>
            <View style={[styles.stockBadge, status.viewStyle]}>
              <Text style={[styles.stockBadgeText, status.textStyle]}>{status.label}</Text>
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

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>LKR {item.product.priceLkr.toFixed(2)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <TouchableOpacity onPress={() => openThreshold(item)}>
            <Text style={styles.metaTextLink}>Warn at: {item.lowStockThreshold}</Text>
          </TouchableOpacity>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{formatTimeAgo(item.updatedAt)}</Text>
        </View>

        <View style={styles.controlsRow}>
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

          <Pressable
            style={({ pressed }) => [styles.btnRestock, pressed && styles.btnPressed]}
            onPress={() => openRestock(item)}
          >
            <Text style={styles.btnRestockText}>Restock</Text>
          </Pressable>
        </View>

        {item.quantity > 0 && (
            <View style={styles.soldOutContainer}>
              <TouchableOpacity onPress={() => handleQuantityUpdate(0, item.product.id, item.isAvailable)}>
                <Text style={styles.soldOutText}>Mark Sold Out</Text>
              </TouchableOpacity>
            </View>
        )}
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
          <Text style={styles.headerSubtitle}>Daily operational inventory control</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>OPEN</Text>
        </View>
        <View style={styles.profileBadge} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Top Summary Chips */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryNumber}>{counts.all}</Text>
            <Text style={styles.summaryLabel}>Total Items</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={[styles.summaryNumber, counts.low > 0 ? {color: "#F5A623"} : undefined]}>{counts.low}</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={[styles.summaryNumber, counts.out > 0 ? {color: "#D0021B"} : undefined]}>{counts.out}</Text>
            <Text style={styles.summaryLabel}>Out of Stock</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={[styles.summaryNumber, counts.paused > 0 ? {color: "#8A8A9E"} : undefined]}>{counts.paused}</Text>
            <Text style={styles.summaryLabel}>Paused</Text>
          </View>
        </View>

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <View style={styles.attentionSection}>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12, paddingRight: 16}}>
              {needsAttention.map(item => {
                const status = getStatusDisplay(item);
                return (
                  <TouchableOpacity key={`attn-${item.id}`} style={styles.attentionCard} onPress={() => setSearchQuery(item.product.name)}>
                    <Text style={styles.attnProductName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={[styles.attnStatusText, status.textStyle]}>{status.label}</Text>
                    <Text style={styles.attnQty}>Qty: {item.quantity}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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

        {/* Filters and Sorting */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
          {(["All", "Low Stock", "Out of Stock", "Paused"] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {(["A-Z", "Lowest Stock", "Recently Updated"] as SortType[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, activeSort === s && styles.filterChipActive]}
              onPress={() => setActiveSort(s)}
            >
              <FontAwesome name="sort" size={12} color={activeSort === s ? "#FFF" : "#8A8A9E"} style={{marginRight: 4}} />
              <Text style={[styles.filterChipText, activeSort === s && styles.filterChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={checkSessionAndFetch}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : loading && inventory.length === 0 ? (
          <Text style={styles.stateText}>Loading your stock levels...</Text>
        ) : filteredAndSortedInventory.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <FontAwesome name="inbox" size={32} color="#D0D0E0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyStateTitle}>No inventory items</Text>
          </View>
        ) : (
          filteredAndSortedInventory.map(renderProductCard)
        )}
      </ScrollView>

      {/* Restock Modal */}
      <Modal visible={restockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restock: {selectedRestockItem?.product.name}</Text>
            <Text style={styles.modalSubtitle}>Current stock: {selectedRestockItem?.quantity}</Text>

            <View style={styles.presetGrid}>
              {[5, 10, 25].map(amt => (
                <TouchableOpacity key={amt} style={styles.presetBtn} onPress={() => executeRestock(amt)}>
                  <Text style={styles.presetBtnText}>+{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Set Exact Quantity:</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={exactQty}
              onChangeText={setExactQty}
              placeholder="e.g. 20"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setRestockModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnUpdate} onPress={executeExactRestock}>
                <Text style={styles.modalBtnUpdateText}>Update Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Threshold Modal */}
      <Modal visible={thresholdModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Low Stock Warning</Text>
            <Text style={styles.modalSubtitle}>{selectedThresholdItem?.product.name}</Text>

            <Text style={styles.modalLabel}>Alert when stock reaches or falls below:</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={exactThreshold}
              onChangeText={setExactThreshold}
              placeholder="e.g. 5"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setThresholdModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnUpdate} onPress={executeThreshold}>
                <Text style={styles.modalBtnUpdateText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8FC" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitleContainer: { flex: 1 },
  headerBrand: { fontSize: 12, fontWeight: "700", color: "#4A4A68", marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#1E2030", marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: "#8A8A9E", marginBottom: 8 },
  statusBadge: { backgroundColor: "#E6F7ED", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 8 },
  statusBadgeText: { color: "#00A859", fontWeight: "700", fontSize: 12 },
  profileBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#D0D0E0" },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  summaryChip: { flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0EB', alignItems: 'center' },
  summaryNumber: { fontSize: 20, fontWeight: '800', color: '#1E2030' },
  summaryLabel: { fontSize: 12, color: '#8A8A9E', marginTop: 4, fontWeight: '600' },

  attentionSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E2030', marginBottom: 12 },
  attentionCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FFEBEB', width: 140 },
  attnProductName: { fontSize: 13, fontWeight: '600', color: '#1E2030', marginBottom: 4 },
  attnStatusText: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  attnQty: { fontSize: 12, color: '#8A8A9E' },

  toolbar: { paddingVertical: 8, marginBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: "#E0E0EB" },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#1E2030" },

  filtersContainer: { flexDirection: "row", paddingVertical: 4, gap: 8, paddingBottom: 16, alignItems: 'center' },
  filterChip: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0EB", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  sortChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0EB", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterChipActive: { backgroundColor: "#1E2030", borderColor: "#1E2030" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#4A4A68" },
  filterChipTextActive: { color: "#FFFFFF" },
  divider: { width: 1, height: 20, backgroundColor: '#E0E0EB', marginHorizontal: 4 },

  scrollContent: { padding: 16, paddingBottom: 100 },

  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#F0F0F5", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  productName: { fontSize: 16, fontWeight: "700", color: "#1E2030", marginBottom: 8 },

  stockBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockBadgeIn: { backgroundColor: "#E6F7ED" },
  stockBadgeLow: { backgroundColor: "#FFF5E6" },
  stockBadgeOut: { backgroundColor: "#FFEBEB" },
  stockBadgePaused: { backgroundColor: "#F0F0F5" },
  stockBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  stockBadgeTextIn: { color: "#00A859" },
  stockBadgeTextLow: { color: "#F5A623" },
  stockBadgeTextOut: { color: "#D0021B" },
  stockBadgeTextPaused: { color: "#8A8A9E" },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#8A8A9E', fontWeight: '500' },
  metaTextLink: { fontSize: 12, color: '#0052CC', fontWeight: '600', textDecorationLine: 'underline' },
  metaDot: { fontSize: 12, color: '#D0D0E0', marginHorizontal: 6 },

  availabilityToggle: { alignItems: "center" },
  toggleLabel: { fontSize: 11, fontWeight: "700", color: "#8A8A9E", marginBottom: 2 },

  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F0F0F5" },
  qtyControls: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8FC", borderRadius: 8, borderWidth: 1, borderColor: "#E0E0EB" },
  qtyBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  qtyBtnText: { fontSize: 16, fontWeight: "600", color: "#4A4A68" },
  qtyValue: { fontSize: 16, fontWeight: "700", color: "#1E2030", minWidth: 30, textAlign: "center" },

  btnRestock: { backgroundColor: "#1E2030", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  btnRestockText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnPressed: { opacity: 0.8 },

  soldOutContainer: { marginTop: 16, alignItems: "center" },
  soldOutText: { color: "#D0021B", fontSize: 13, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E2030', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#8A8A9E', marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#4A4A68', marginBottom: 8, marginTop: 16 },
  modalInput: { borderWidth: 1, borderColor: '#E0E0EB', borderRadius: 8, padding: 12, fontSize: 16, color: '#1E2030', backgroundColor: '#F8F8FC' },
  presetGrid: { flexDirection: 'row', gap: 12 },
  presetBtn: { flex: 1, backgroundColor: '#F0F0F5', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  presetBtnText: { fontSize: 16, fontWeight: '700', color: '#1E2030' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#F0F0F5' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#4A4A68' },
  modalBtnUpdate: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#1E2030' },
  modalBtnUpdateText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  emptyStateCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E0E0EB", marginTop: 20 },
  emptyStateTitle: { fontSize: 16, fontWeight: "700", color: "#1E2030", marginBottom: 8, textAlign: "center" },
  stateText: { color: "#8A8A9E", fontSize: 14, padding: 32, textAlign: "center" },
  errorBanner: { backgroundColor: "#FFEBEB", padding: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  errorText: { color: "#D0021B", fontSize: 14, flex: 1 },
  retryText: { color: "#1E2030", fontWeight: "700", fontSize: 14, marginLeft: 16 },
});
