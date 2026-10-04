import { listMyShops } from "@/services/shopService";
import { listProductsByShop, updateProduct } from "@/services/productService";
import type { Product, StockStatus } from "@/types/product";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Switch, Pressable } from "react-native";

/**
 * Stock counts live on products.stock_quantity / products.is_available.
 * There is no separate inventory table, so the low-stock cutoff is one shared
 * constant rather than a per-product threshold.
 */
const LOW_STOCK_THRESHOLD = 5;

type FilterType = "All" | "Low Stock" | "Out of Stock";

/**
 * Adapts a product row to the shape the card markup expects, so the UI below
 * reads the same as it did against the old mock array.
 */
type StockRow = {
  id: string;
  quantity: number;
  stockStatus: StockStatus;
  product: {
    name: string;
    category: string;
    price: number;
    unitLabel: string;
    isAvailable: boolean;
  };
};

function stockStatusFor(quantity: number): StockStatus {
  if (quantity === 0) return "out_of_stock";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

function toRow(product: Product): StockRow {
  return {
    id: product.id,
    quantity: product.stock_quantity,
    stockStatus: stockStatusFor(product.stock_quantity),
    product: {
      name: product.name,
      category: product.category,
      price: product.price,
      unitLabel: product.unit,
      isAvailable: product.is_available,
    },
  };
}

export default function StockUpdate() {
  const [inventory, setInventory] = useState<StockRow[]>([]);
  const [shopName, setShopName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStock = useCallback(
    (onDone?: () => void) =>
      listMyShops()
        .then((shops) => {
          if (shops.length === 0) return [];
          setShopName(shops[0].name);
          return listProductsByShop(shops[0].id);
        })
        .then((products) => {
          if (products) setInventory(products.map(toRow));
        })
        .catch((loadError: unknown) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load your stock levels.",
          );
        })
        .finally(() => {
          setLoading(false);
          onDone?.();
        }),
    [],
  );

  const reload = () => {
    setLoading(true);
    setError("");
    fetchStock();
  };

  useEffect(() => {
    // State is only touched inside the promise callbacks, never synchronously
    // in the effect body, which would trigger a cascading render.
    let active = true;
    const timer = setTimeout(() => {
      fetchStock(() => {
        if (!active) return;
      });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchStock]);

  /**
   * Applies the change locally first so the stepper feels instant, then
   * persists. If the write fails the previous row is restored and the error
   * is surfaced, so the UI never drifts from what is stored.
   */
  const commit = (id: string, quantity: number, isAvailable: boolean) => {
    const snapshot = inventory.find((item) => item.id === id) ?? null;

    setInventory((rows) =>
      rows.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity,
              stockStatus: stockStatusFor(quantity),
              product: { ...item.product, isAvailable },
            }
          : item,
      ),
    );

    updateProduct(id, {
      stock_quantity: quantity,
      is_available: isAvailable,
    }).catch((saveError: unknown) => {
      if (snapshot) {
        setInventory((rows) =>
          rows.map((item) => (item.id === id ? snapshot : item)),
        );
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save that stock change.",
      );
    });
  };

  const updateQuantity = (id: string, newQty: number) => {
    if (newQty < 0) return;
    const target = inventory.find((item) => item.id === id);
    if (!target) return;
    commit(id, newQty, newQty > 0);
  };

  const toggleAvailability = (id: string) => {
    const target = inventory.find((item) => item.id === id);
    if (!target) return;
    commit(id, target.quantity, !target.product.isAvailable);
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // 1. Filter Tab
      if (activeFilter === "Low Stock" && item.stockStatus !== "low_stock") return false;
      if (activeFilter === "Out of Stock" && item.stockStatus !== "out_of_stock") return false;

      // 2. Search Query (name or category)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.product.name.toLowerCase().includes(query) &&
          !item.product.category.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [inventory, searchQuery, activeFilter]);

  const counts = useMemo(() => {
    return {
      all: inventory.length,
      low: inventory.filter(i => i.stockStatus === "low_stock").length,
      out: inventory.filter(i => i.stockStatus === "out_of_stock").length,
    };
  }, [inventory]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerBrand}>{shopName ? shopName.toUpperCase() : "YOUR SHOP"}</Text>
          <Text style={styles.headerTitle}>Stock Update</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>OPEN</Text>
        </View>
        <View style={styles.profileBadge} />
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${counts.all} catalogued item${counts.all === 1 ? "" : "s"}...`}
            placeholderTextColor="#8A8A9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.scanAction}>
            <Text style={styles.scanActionText}>[-]</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.utilityActions}>
          <TouchableOpacity style={styles.utilBtn}><Text style={styles.utilBtnText}> Bulk Price</Text></TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn}><Text style={styles.utilBtnText}> Shelf Tags</Text></TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn}><Text style={styles.utilBtnText}> Sync Radar</Text></TouchableOpacity>
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
            Low Stock {counts.low > 0 ? `<${counts.low + 1}` : 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterChip, activeFilter === "Out of Stock" && styles.filterChipActive]}
          onPress={() => setActiveFilter("Out of Stock")}
        >
          <Text style={[styles.filterChipText, activeFilter === "Out of Stock" && styles.filterChipTextActive]}>
            Out of Stock
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Text style={styles.stateText}>Loading your stock levels...</Text>
        ) : error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredInventory.length === 0 ? (
          <Text style={styles.stateText}>
            {inventory.length === 0
              ? "No listings yet. Add products in Shop Management to track stock here."
              : "No items match your search or filter."}
          </Text>
        ) : (
        filteredInventory.map((item) => {
          const isOut = item.stockStatus === "out_of_stock";
          const isLow = item.stockStatus === "low_stock";
          
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.skuText}>{item.product.category}</Text>
                </View>
                <View style={styles.availabilityToggle}>
                  <Text style={styles.toggleLabel}>
                    {item.product.isAvailable ? "ON" : "OFF"}
                  </Text>
                  <Switch
                    value={item.product.isAvailable}
                    onValueChange={() => toggleAvailability(item.id)}
                    trackColor={{ false: "#E0E0EB", true: "#00A859" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.statusRow}>
                <View style={[
                  styles.stockBadge,
                  isOut ? styles.stockBadgeOut : isLow ? styles.stockBadgeLow : styles.stockBadgeIn
                ]}>
                  <Text style={[
                    styles.stockBadgeText,
                    isOut ? styles.stockBadgeTextOut : isLow ? styles.stockBadgeTextLow : styles.stockBadgeTextIn
                  ]}>
                    {isOut ? "OUT OF STOCK" : isLow ? "Low Stock" : "In Stock"} ({item.quantity} {item.quantity === 1 ? "unit" : item.product.unitLabel.includes("pack") || item.product.unitLabel.includes("carton") ? "units" : "units"})
                  </Text>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Current Price:</Text>
                  <Text style={styles.priceValue}>LKR {item.product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>

                {isOut ? (
                  <View style={styles.outActions}>
                    <Pressable 
                      style={({ pressed }: { pressed: boolean }) => [styles.btnRestock, pressed && styles.btnPressed]}
                      onPress={() => updateQuantity(item.id, 10)}
                    >
                      <Text style={styles.btnRestockText}>Restock +10</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.qtyControls}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <TouchableOpacity 
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {!isOut && (
                 <View style={styles.soldOutContainer}>
                   <TouchableOpacity onPress={() => updateQuantity(item.id, 0)}>
                     <Text style={styles.soldOutText}>Mark Sold Out</Text>
                   </TouchableOpacity>
                 </View>
              )}

              {isOut && (
                <Text style={styles.hiddenNote}>⚠️ Item is hidden from live search until restocked</Text>
              )}
            </View>
          );
        })
        )}
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
  headerTitleContainer: {
    flex: 1,
  },
  headerBrand: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8A8A9E",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
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
    fontSize: 10,
  },
  profileBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D0D0E0",
  },
  toolbar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0EB",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F5",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E2030",
  },
  scanAction: {
    marginLeft: 8,
  },
  scanActionText: {
    fontSize: 14,
    color: "#4A4A68",
    fontWeight: "700",
  },
  utilityActions: {
    flexDirection: "row",
    gap: 8,
  },
  utilBtn: {
    backgroundColor: "#E0E0EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  utilBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A4A68",
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0EB",
    paddingHorizontal: 16,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    marginBottom: 4,
  },
  stateText: {
    color: "#8A8A9E",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 32,
    textAlign: "center",
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "#FFF0ED",
    borderRadius: 8,
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
  },
  errorText: {
    color: "#A33D2F",
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  retryText: {
    color: "#A33D2F",
    fontSize: 11,
    fontWeight: "800",
    paddingLeft: 12,
  },
  skuText: {
    fontSize: 12,
    color: "#8A8A9E",
  },
  availabilityToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A4A68",
    marginRight: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  stockBadgeIn: { backgroundColor: "#E6F7ED" },
  stockBadgeLow: { backgroundColor: "#FFF5E6" },
  stockBadgeOut: { backgroundColor: "#FFEBEB" },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  stockBadgeTextIn: { color: "#00A859" },
  stockBadgeTextLow: { color: "#F5A623" },
  stockBadgeTextOut: { color: "#D0021B" },
  comparisonNote: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00A859",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
    paddingTop: 16,
  },
  priceContainer: {},
  priceLabel: {
    fontSize: 12,
    color: "#8A8A9E",
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 15,
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
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E2030",
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E2030",
    minWidth: 28,
    textAlign: "center",
  },
  outActions: {
    flexDirection: "row",
  },
  btnRestock: {
    backgroundColor: "#00A859",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnRestockText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  btnPressed: {
    opacity: 0.8,
  },
  soldOutContainer: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  soldOutText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D0021B",
  },
  hiddenNote: {
    marginTop: 12,
    fontSize: 12,
    fontStyle: "italic",
    color: "#8A8A9E",
  },
});