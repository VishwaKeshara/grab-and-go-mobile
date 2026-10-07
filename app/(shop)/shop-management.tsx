import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
  createShopProduct,
  deleteCanonicalProduct as deleteProduct,
  listCanonicalProductsByShop as listProductsByShop,
  updateShopProduct,
  setProductActive,
} from "@/services/productService";
import {
  listMyShops,
  updateStock,
  deleteShopProduct,
} from "@/services/shopService";
import { router } from "expo-router";
import { getLocalStaffSession, getStaffProfile } from "@/services/shopService";
import type { Product } from "@/types/product";
import type { Shop } from "@/types/shop";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { formatCurrencyShort } from "@/utils/formatters";

type Mode = "product-create" | "product-edit";

export default function ShopManagement() {
    useEffect(() => {
    const check = async () => {
      const token = await getLocalStaffSession();
      if (token) {
        const staffProfile = await getStaffProfile(token);
        if (staffProfile) {
          router.replace("/(shop)/new-orders");
          return;
        }
      }
    };
    void check();
  }, []);

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Out of Stock" | "Paused">("All");

  const [mode, setMode] = useState<Mode | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pickedImage, setPickedImage] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    regular_price: "",
    stock_quantity: "",
    unit: "",
    image_url: "",
  });

  const loadShops = useCallback(() => {
    listMyShops()
      .then((items) => {
        setShops(items);
        setSelectedShop((current) => {
          if (!current) return items[0] ?? null;
          return items.find((shop) => shop.id === current.id) ?? items[0] ?? null;
        });
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load your shops.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const loadProducts = useCallback((shopId: string) => {
    setProductsLoading(true);
    listProductsByShop(shopId)
      .then(setProducts)
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load your listings.",
        );
      })
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (selectedShop) loadProducts(selectedShop.id);
  }, [selectedShop, loadProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.active === false && p.is_available === false) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.unit || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filter === "Out of Stock" && p.stock_quantity > 0) return false;
      if (filter === "Paused" && p.active !== false) return false;
      return true;
    });
  }, [products, searchQuery, filter]);

  const counts = useMemo(() => {
    let outOfStock = 0;
    let paused = 0;
    let all = 0;
    for (const p of products) {
      if (p.active === false && p.is_available === false) continue;
      all++;
      if (p.stock_quantity === 0) outOfStock++;
      if (p.active === false) paused++;
    }
    return { all, outOfStock, paused };
  }, [products]);

  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const handleDeleteProduct = async (productId: string) => {
    if (deletingProductId) return;
    setDeletingProductId(productId);

    try {
      await deleteShopProduct(productId);
      if (selectedShop) loadProducts(selectedShop.id);
      if (Platform.OS === "web") {
        globalThis.alert?.("The product was removed successfully.");
      } else {
        Alert.alert("Product deleted", "The product was removed successfully.");
      }
    } catch (err) {
      console.error("[ShopManagement] delete product failed", err);
      const msg = err instanceof Error ? err.message : "Please try again.";
      if (Platform.OS === "web") {
        globalThis.alert?.("Could not delete product: " + msg);
      } else {
        Alert.alert("Could not delete product", msg);
      }
    } finally {
      setDeletingProductId(null);
    }
  };

  const confirmDeleteProduct = (product: Product) => {
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        `Delete ${product.name} from your shop catalog?`
      );

      if (confirmed) {
        void handleDeleteProduct(product.id);
      }
      return;
    }

    Alert.alert(
      "Delete product?",
      `${product.name} will be removed from your shop catalog.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDeleteProduct(product.id);
          },
        },
      ]
    );
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setPickedImage(null);
    setForm({
      name: "",
      price: "",
      regular_price: "",
      stock_quantity: "",
      unit: "",
      image_url: "",
    });
    setMode("product-create");
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setPickedImage(null);
    setForm({
      name: product.name,
      price: String(product.price),
      regular_price: product.regular_price ? String(product.regular_price) : "",
      stock_quantity: String(product.stock_quantity),
      unit: product.unit ?? "",
      image_url: product.image_url ?? "",
    });
    setMode("product-edit");
  };

  const closeModal = () => {
    setMode(null);
    setEditingProduct(null);
    setError("");
    setPickedImage(null);
  };

  const saveProduct = async () => {
    if (!selectedShop) return;

    const price = Number(form.price);
    const regularPrice = form.regular_price ? Number(form.regular_price) : price;
    const stock = Number(form.stock_quantity || 0);
    const unit = form.unit.trim();

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!unit) {
      setError("Unit is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid selling price.");
      return;
    }
    if (!Number.isFinite(regularPrice) || regularPrice < price) {
      setError("Regular price must be greater than or equal to selling price.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setError("Enter a valid stock quantity.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let finalImageUrl = form.image_url.trim();

      if (pickedImage) {
        const response = await fetch(pickedImage.uri);
        const blob = await response.blob();
        const ext = pickedImage.uri.split('.').pop() || 'jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const path = `${selectedShop.id}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, blob, {
            contentType: pickedImage.mimeType || 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(path);

        finalImageUrl = publicUrlData.publicUrl;
      }

      if (mode === "product-edit" && selectedShop && editingProduct) {
        await updateShopProduct(editingProduct.id, {
          name: form.name,
          unit,
          priceLkr: price,
          regularPriceLkr: regularPrice,
          imageUrl: finalImageUrl || null,
        });
        await updateStock(selectedShop.id, editingProduct.id, stock, true);
        setNotice("✓ Listing updated");
      } else {
        await createShopProduct(
          selectedShop.id,
          {
            name: form.name,
            unit,
            priceLkr: price,
            regularPriceLkr: regularPrice,
            imageUrl: finalImageUrl || null,
            active: true
          },
          stock
        );
        setNotice("✓ Listing created");
      }
      closeModal();
      loadProducts(selectedShop.id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your listing.",
      );
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const mime = asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : asset.uri.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        Alert.alert("Unsupported format", "Please choose a JPEG, PNG, or WEBP image.");
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("File too large", "Maximum image size is 5 MB.");
        return;
      }
      setPickedImage(asset);
      setForm(prev => ({ ...prev, image_url: "" })); // Priority 1: uploaded image clears URL
    }
  };

  return (
    <AuthFrame scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader
          eyebrow="PRODUCTS"
          title="Products & Inventory"
          subtitle="Manage catalog, pricing and stock"
        />

      {error && !mode ? (
        <View style={styles.inlineErrorBanner}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable onPress={() => { setError(""); loadShops(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.mint} />
          <Text style={styles.muted}>Loading shops...</Text>
        </View>
      ) : shops.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={styles.emptyTitle}>No shops yet</Text>
          <Text style={styles.emptyText}>
            You need a shop to start adding product listings.
          </Text>
        </View>
      ) : (
        <>
          {selectedShop ? (
            <View style={styles.shopSummaryCard}>
              <View style={styles.shopSummaryInfo}>
                <Text style={styles.shopSummaryName}>{selectedShop.name}</Text>
                {selectedShop.address ? (
                  <Text style={styles.shopSummaryAddress}>{selectedShop.address}</Text>
                ) : null}
                <Text style={styles.shopSummaryMeta}>
                  Products: {products.length}
                </Text>
              </View>
              <View style={styles.shopSummaryStatus}>
                <Text style={styles.badgeActiveText}>
                  {selectedShop.is_active ? "ACTIVE" : "PAUSED"}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.listingHeader}>
            <PrimaryButton onPress={openCreateProduct} loading={false}>
              + Add Product
            </PrimaryButton>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9A98AA"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {[
              { key: "All", label: `All (${counts.all})` },
              {
                key: "Out of Stock",
                label: `Out of Stock (${counts.outOfStock})`,
              },
              {
                key: "Paused",
                label: `Paused (${counts.paused})`,
              },
            ].map((f) => {
              const active = filter === f.key;

              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key as any)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.mint} />
              <Text style={styles.muted}>Loading products...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptyText}>
                {searchQuery || filter !== "All"
                  ? "No products match your search or filter."
                  : "Add your first product to start selling."}
              </Text>
              {!(searchQuery || filter !== "All") && (
                <View style={{ marginTop: 16, width: "100%" }}>
                  <PrimaryButton onPress={openCreateProduct}>+ Add Product</PrimaryButton>
                </View>
              )}
            </View>
          ) : (
            filteredProducts.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productTopRow}>
                  <ProductCardImage product={product} />
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productUnit}>{product.unit || "-"}</Text>
                    <Text style={styles.productPrice}>{formatCurrencyShort(product.price)}</Text>
                  </View>
                  <View style={styles.productBadges}>
                    <View style={product.active !== false ? styles.badgeActive : styles.badgePaused}>
                      <Text style={product.active !== false ? styles.badgeActiveText : styles.badgePausedText}>
                        {product.active !== false ? "ACTIVE" : "PAUSED"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.productBottomRow}>
                  <View style={styles.stockRow}>
                    <Text style={styles.stockLabel}>Stock: {product.stock_quantity}</Text>
                    <View style={product.stock_quantity > 0 ? styles.badgeInStock : styles.badgeOutOfStock}>
                      <Text style={product.stock_quantity > 0 ? styles.badgeInStockText : styles.badgeOutOfStockText}>
                        {product.stock_quantity > 0 ? "IN STOCK" : "OUT OF STOCK"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.productActions}>
                    <Pressable
                      onPress={() => {
                        openEditProduct(product);
                      }}
                      style={styles.actionButtonEdit}
                    >
                      <Text style={styles.actionButtonEditText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (!selectedShop) return;
                        try {
                          await setProductActive(product.id, !product.active);
                          loadProducts(selectedShop.id);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to update product state.");
                        }
                      }}
                      style={product.active !== false ? styles.actionButtonPause : styles.actionButtonResume}
                    >
                      <Text style={product.active !== false ? styles.actionButtonPauseText : styles.actionButtonResumeText}>
                        {product.active !== false ? "Pause" : "Resume"}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={deletingProductId === product.id}
                      onPress={() => confirmDeleteProduct(product)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.actionBtnPressed,
                        deletingProductId === product.id && styles.disabled,
                      ]}
                    >
                      <Text style={styles.deleteButtonText}>
                        {deletingProductId === product.id ? "Deleting..." : "Delete"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </>
      )}

      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeModal}
        transparent
        visible={mode !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === "product-create" ? "Add Product" : "Edit Product"}
              </Text>
              <Pressable accessibilityLabel="Close" onPress={closeModal}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <ModalField
                label="Product Name"
                onChangeText={(value) => setForm({ ...form, name: value })}
                value={form.name}
              />
              <ModalField
                label="Unit (e.g. 400 g, 1 L)"
                onChangeText={(value) => setForm({ ...form, unit: value })}
                value={form.unit}
              />
              <ModalField
                keyboardType="decimal-pad"
                label="Selling Price (LKR)"
                onChangeText={(value) => setForm({ ...form, price: value })}
                value={form.price}
              />
              <ModalField
                keyboardType="decimal-pad"
                label="Regular Price (LKR) - Optional"
                onChangeText={(value) => setForm({ ...form, regular_price: value })}
                value={form.regular_price}
              />
              <ModalField
                keyboardType="number-pad"
                label={mode === "product-create" ? "Initial Stock" : "Stock quantity"}
                onChangeText={(value) =>
                  setForm({ ...form, stock_quantity: value })
                }
                value={form.stock_quantity}
              />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Image (Optional)</Text>

                {pickedImage || form.image_url ? (
                  <View style={{ marginBottom: 12, alignItems: 'center' }}>
                    <Image
                      source={{ uri: pickedImage ? pickedImage.uri : form.image_url }}
                      style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0' }}
                      contentFit="cover"
                    />
                    <Pressable style={{ marginTop: 8 }} onPress={() => { setPickedImage(null); setForm(prev => ({...prev, image_url: ""})) }}>
                      <Text style={{ color: colors.coral, fontSize: 12, fontWeight: 'bold' }}>Remove Image</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={{ marginBottom: 12 }}><SecondaryButton onPress={pickImage}>[ Choose Image ]</SecondaryButton></View>

                <Text style={[styles.fieldLabel, { textAlign: 'center', marginBottom: 12, color: colors.muted }]}>OR</Text>

                <TextInput
                  placeholder="Image URL https://..."
                  placeholderTextColor="#9A98AA"
                  style={styles.fieldInput}
                  onChangeText={(value) => {
                    setForm({ ...form, image_url: value });
                    if (value) setPickedImage(null);
                  }}
                  value={form.image_url}
                />
              </View>

              <PrimaryButton
                loading={saving}
                onPress={saveProduct}
              >
                {mode === "product-edit" ? "Save Changes" : "Add Product"}
              </PrimaryButton>
              <SecondaryButton onPress={closeModal}>Cancel</SecondaryButton>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AuthFrame>
  );
}

function ModalField({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#9A98AA"
        style={styles.fieldInput}
        {...props}
      />
    </View>
  );
}

function ProductCardImage({ product }: { product: Product }) {
  const [error, setError] = useState(false);

  if (!product.image_url || error) {
    return (
      <View style={styles.productImageFallback}>
        <Text style={styles.productImageFallbackText}>
          {product.name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: product.image_url }}
      style={styles.productImage}
      contentFit="cover"
      transition={150}
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  inlineErrorBanner: {
    backgroundColor: "#FFF0ED",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    backgroundColor: colors.coral,
    color: colors.white,
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 12,
    fontWeight: "bold",
  },
  inlineErrorText: {
    color: "#A33D2F",
    fontSize: 12,
    flex: 1,
  },
  retryText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "bold",
  },
  notice: {
    color: "#07856A",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    flexDirection: "row",
  },
  muted: { color: colors.muted, fontSize: 12 },
  shopSummaryCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shopSummaryInfo: { flex: 1 },
  shopSummaryName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  shopSummaryAddress: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  shopSummaryMeta: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  shopSummaryStatus: {},
  listingHeader: {
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 36,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F1F8",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#D8FAED",
    borderColor: "#45D2A6",
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#087A60",
    fontWeight: "800",
  },

  productCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  productTopRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#F1F1F7",
  },
  productImageFallback: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  productImageFallbackText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  productDetails: { flex: 1, marginLeft: 12 },
  productName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  productUnit: { color: colors.muted, fontSize: 11, marginTop: 2 },
  productPrice: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 4 },
  productBadges: { alignItems: "flex-end", marginLeft: 8 },

  badgeActive: { backgroundColor: colors.mintSoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeActiveText: { color: "#0E8067", fontSize: 9, fontWeight: "800" },
  badgePaused: { backgroundColor: "#F0F1FC", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgePausedText: { color: colors.muted, fontSize: 9, fontWeight: "800" },

  productBottomRow: {
    marginTop: 10,
    gap: 10,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  stockLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  badgeInStock: { backgroundColor: colors.mintSoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeInStockText: { color: "#0E8067", fontSize: 9, fontWeight: "800" },
  badgeOutOfStock: { backgroundColor: "#FFF0ED", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  badgeOutOfStockText: { color: colors.coral, fontSize: 9, fontWeight: "800" },

  productActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButtonEdit: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonEditText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  actionButtonPause: {
    alignItems: "center",
    backgroundColor: "#FFF0ED",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonPauseText: { color: colors.coral, fontSize: 11, fontWeight: "700" },
  actionButtonResume: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonResumeText: { color: "#0E8067", fontSize: 11, fontWeight: "700" },
  deleteButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD2CC",
    backgroundColor: "#FFF3F1",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: "800",
  },

  empty: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 8,
    padding: 32,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
  modalBackdrop: {
    backgroundColor: "rgba(21,20,61,0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    padding: 24,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  modalClose: { color: colors.muted, fontSize: 28, lineHeight: 28 },
  field: { marginBottom: 16 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
