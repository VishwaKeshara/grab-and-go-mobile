import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome } from "@expo/vector-icons";
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
  applyDiscount,
  clearDiscount,
  createShopProduct,
  listProductCategories,
  deleteCanonicalProduct as deleteProduct,
  listCanonicalProductsByShop as listProductsByShop,
  updateShopProduct,
  setProductActive,
} from "@/services/productService";
import {
  listMyShops,
  deleteShopProduct,
} from "@/services/shopService";
import { saveStock } from "@/services/stockService";
import { categoryIcon } from "@/utils/categories";
import { router } from "expo-router";
import { getLocalStaffSession, getStaffProfile } from "@/services/shopService";
import type { DiscountType, Product } from "@/types/product";
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
import { describeError } from "@/utils/errors";

type Mode = "product-create" | "product-edit";

/**
 * The two mutually exclusive discount options. Rendered as a single-choice
 * pair, so exactly one can be applied to a product at a time.
 */
const DISCOUNT_OPTIONS: { type: DiscountType; label: string; hint: string }[] = [
  { type: "percent", label: "Percentage", hint: "% off the price" },
  { type: "fixed", label: "Fixed amount", hint: "LKR off the price" },
];

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
  const [categories, setCategories] = useState<string[]>([]);
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
  /** Which of the two mutually exclusive options the clerk has selected. */
  const [discountMode, setDiscountMode] = useState<DiscountType>("percent");
  /** The typed value for the selected option: a percent, or rupees off. */
  const [discountValue, setDiscountValue] = useState("10");
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    category: "",
    unit: "",
    image_url: "",
  });

  // The labels already in use, fetched once on mount as suggestions. A failure
  // here only costs the chips -- the field itself still accepts free text, so it
  // must not block the rest of the screen.
  useEffect(() => {
    listProductCategories()
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  /**
   * The pre-discount price every discount is calculated from.
   *
   * This is regular_price_lkr rather than price_lkr on purpose: once a discount
   * is applied price_lkr is already reduced, so taking a second discount off it
   * would compound instead of replacing. Falls back to price_lkr for products
   * with no regular price recorded.
   */
  const basePriceOf = (product: Product): number =>
    Number(product.regular_price ?? product.price ?? 0);

  /**
   * Reads which of the two options is stored, falling back to "percent" for
   * rows written before migration 021 added discount_type.
   */
  const discountModeOf = (product: Product): DiscountType =>
    product.discount_type === "fixed" ? "fixed" : "percent";

  /**
   * Reads the discount as a percentage.
   *
   * Derived from the price pair whenever nothing is stored, which covers two
   * cases: a fixed discount (the CHECK constraint in 021 forbids storing a
   * percentage alongside one, so the column is 0 by design) and a row written
   * before 019 added the column at all.
   */
  const discountPercentOf = (product: Product): number => {
    const stored = Number(product.discount_percent ?? 0);
    if (stored > 0) return stored;

    const regular = basePriceOf(product);
    const price = Number(product.price ?? 0);
    if (regular <= 0 || regular <= price) return 0;
    return Math.round(((regular - price) / regular) * 100);
  };

  /** The stored fixed discount in rupees, derived when only the prices exist. */
  const discountAmountOf = (product: Product): number =>
    Number(product.discount_amount_lkr ?? 0) ||
    Math.max(0, basePriceOf(product) - Number(product.price ?? 0));

  const hasDiscount = (product: Product): boolean =>
    discountModeOf(product) === "fixed"
      ? discountAmountOf(product) > 0
      : discountPercentOf(product) > 0;

  const openDiscount = (product: Product) => {
    const mode = discountModeOf(product);
    setDiscountProduct(product);
    setDiscountMode(mode);
    // Pre-fill with what is already stored so reopening the modal shows the
    // current discount rather than a blank box.
    setDiscountValue(
      String((mode === "fixed" ? discountAmountOf(product) : discountPercentOf(product)) || 10),
    );
    setDiscountError("");
  };

  /**
   * Switching options resets the box, so the old value can never be applied
   * under the wrong option -- 10 typed as a percent is not LKR 10 off.
   */
  const selectDiscountMode = (mode: DiscountType) => {
    setDiscountMode(mode);
    setDiscountValue(mode === "percent" ? "10" : "50");
    setDiscountError("");
  };

  const closeDiscount = () => {
    if (discountSaving) return;
    setDiscountProduct(null);
    setDiscountError("");
  };

  const submitDiscount = async () => {
    if (!discountProduct || !selectedShop) return;

    const value = Number(discountValue);
    const base = basePriceOf(discountProduct);

    if (!Number.isFinite(value) || value <= 0) {
      setDiscountError(
        discountMode === "percent"
          ? "Enter a percentage greater than zero."
          : "Enter an amount greater than zero.",
      );
      return;
    }

    if (discountMode === "percent" && value > 100) {
      setDiscountError("Enter a percentage between 1 and 100.");
      return;
    }

    if (discountMode === "fixed" && value > base) {
      setDiscountError(
        `That is more than the selling price of ${base.toLocaleString("en-LK")}.`,
      );
      return;
    }

    setDiscountSaving(true);
    setDiscountError("");

    try {
      await applyDiscount(discountProduct.id, discountMode, value);
      setNotice(`✓ Discount applied to ${discountProduct.name}`);
      setDiscountProduct(null);
      loadProducts(selectedShop.id);
    } catch (discountError) {
      setDiscountError(
        describeError(discountError, "That discount could not be applied."),
      );
    } finally {
      setDiscountSaving(false);
    }
  };

  const removeDiscount = async () => {
    if (!discountProduct || !selectedShop) return;

    setDiscountSaving(true);
    setDiscountError("");

    try {
      await clearDiscount(discountProduct.id);
      setNotice(`✓ Discount removed from ${discountProduct.name}`);
      setDiscountProduct(null);
      loadProducts(selectedShop.id);
    } catch (discountError) {
      setDiscountError(
        describeError(discountError, "That discount could not be removed."),
      );
    } finally {
      setDiscountSaving(false);
    }
  };

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
        setError(describeError(loadError, "We could not load your shops."));
      })
      .finally(() => setLoading(false));
  }, []);

  const loadProducts = useCallback((shopId: string) => {
    setProductsLoading(true);
    setError("");
    listProductsByShop(shopId)
      .then(setProducts)
      .catch((loadError: unknown) => {
        // The real reason matters here: this list is the one screen whose
        // failure looks like an empty shop, and a generic sentence hid a
        // missing database column for a whole catalogue that was saved fine.
        setError(describeError(loadError, "We could not load your listings."));
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

  /**
   * Deletes a product, permanently.
   *
   * The failure message is shown as the server wrote it, because the two refusals
   * this can hit are answers rather than faults: a product that has been ordered
   * cannot be deleted, and a product belonging to another shop is not the clerk's
   * to remove. describeError carries both through unchanged.
   */
  const handleDeleteProduct = async (productId: string) => {
    if (deletingProductId) return;
    setDeletingProductId(productId);

    try {
      await deleteShopProduct(productId);
      if (selectedShop) loadProducts(selectedShop.id);
      if (Platform.OS === "web") {
        globalThis.alert?.("The product was permanently deleted.");
      } else {
        Alert.alert("Product deleted", "The product was permanently deleted.");
      }
    } catch (err) {
      console.error("[ShopManagement] delete product failed", err);
      const msg = describeError(err, "Please try again.");
      if (Platform.OS === "web") {
        globalThis.alert?.("Could not delete product: " + msg);
      } else {
        Alert.alert("Could not delete product", msg);
      }
    } finally {
      setDeletingProductId(null);
    }
  };

  /**
   * Confirms a permanent delete.
   *
   * The wording says "permanently" rather than just "Delete" because that is now
   * what happens: the row leaves customer_products, and unlike the archive this
   * used to do there is no undo. A product that has already been sold is refused
   * by the database, and its message is shown verbatim, because that refusal is
   * the answer to "why did it not delete" rather than a fault to retry.
   */
  const confirmDeleteProduct = (product: Product) => {
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(
        `Permanently delete ${product.name}?\n\n` +
          `This removes it for good and cannot be undone. ` +
          `Anyone who already ordered it will keep their order history.`
      );

      if (confirmed) {
        void handleDeleteProduct(product.id);
      }
      return;
    }

    Alert.alert(
      "Delete product permanently?",
      `${product.name} will be removed for good. This cannot be undone.\n\n` +
        `Anyone who already ordered it keeps their order history.`,
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
      stock_quantity: "",
      category: "",
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
      stock_quantity: String(product.stock_quantity),
      category: product.category ?? "",
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
          // The form no longer collects a separate regular price, so the
          // column mirrors the selling price rather than being left stale.
          regularPriceLkr: price,
          imageUrl: finalImageUrl || null,
          // An empty field means "None", which has to be sent as an
          // explicit clear. Omitting it would leave the previous category in place.
          ...(form.category.trim()
            ? { category: form.category }
            : { clearCategory: true }),
          // Mirroring the price into regular_price_lkr means a discount is no
          // longer supported the moment this saves, so it is cleared here rather
          // than left describing a promotion the prices no longer show.
          ...(hasDiscount(editingProduct) ? { clearDiscount: true } : {}),
        });
        // saveStock inserts the shop_inventory row when one is missing.
        // shopService.updateStock only issues an UPDATE, which silently matched
        // zero rows for every product because that table started empty.
        await saveStock({
          shopId: selectedShop.id,
          productId: editingProduct.id,
          quantity: stock,
          isAvailable: stock > 0,
        });
        setNotice("✓ Listing updated");
      } else {
        await createShopProduct(
          selectedShop.id,
          {
            name: form.name,
            unit,
            priceLkr: price,
            regularPriceLkr: price,
            imageUrl: finalImageUrl || null,
            active: true
          },
          stock,
          form.category || null,
        );
        setNotice("✓ Listing created");
      }
      closeModal();
      loadProducts(selectedShop.id);
    } catch (saveError) {
      setError(describeError(saveError, "We could not save your listing."));
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
          <Pressable
            onPress={() => {
              setError("");
              // Retry the thing that actually failed. Re-running loadShops()
              // alone leaves a failed product load unrecovered on screen.
              if (selectedShop) loadProducts(selectedShop.id);
              else loadShops();
            }}
          >
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
                      onPress={() => openDiscount(product)}
                      style={styles.actionButtonEdit}
                    >
                      <Text style={styles.actionButtonEditText}>
                        {hasDiscount(product) ? "Discount ✓" : "Discount"}
                      </Text>
                    </Pressable>
                    {/* Hide/Restore, not Pause/Resume. It sets active = false and leaves the row
                          in place, which is the opposite of the Delete button next
                          to it -- and it is the only way to remove a product that
                          has already been ordered. */}
                    <Pressable
                      onPress={async () => {
                        if (!selectedShop) return;
                        try {
                          await setProductActive(product.id, !product.active);
                          loadProducts(selectedShop.id);
                        } catch (err) {
                          setError(
                            describeError(err, "Failed to update product state."),
                          );
                        }
                      }}
                      style={product.active !== false ? styles.actionButtonPause : styles.actionButtonResume}
                    >
                      <Text style={product.active !== false ? styles.actionButtonPauseText : styles.actionButtonResumeText}>
                        {product.active !== false ? "Hide" : "Restore"}
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
              <CategoryPicker
                categories={categories}
                onChange={(label) => setForm({ ...form, category: label })}
                value={form.category}
              />
              <ModalField
                keyboardType="decimal-pad"
                label="Selling Price (LKR)"
                onChangeText={(value) => setForm({ ...form, price: value })}
                value={form.price}
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

      <Modal
        animationType="fade"
        onRequestClose={closeDiscount}
        transparent
        visible={discountProduct !== null}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Apply Discount</Text>

            {discountProduct ? (
              <View style={styles.discountSummary}>
                <Text numberOfLines={1} style={styles.discountProduct}>
                  {discountProduct.name}
                </Text>
                <Text style={styles.discountBase}>
                  Selling price LKR{" "}
                  {basePriceOf(discountProduct).toLocaleString("en-LK")}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Discount option</Text>
            <View style={styles.discountOptionRow}>
              {DISCOUNT_OPTIONS.map((option) => {
                const selected = discountMode === option.type;
                return (
                  <Pressable
                    key={option.type}
                    onPress={() => selectDiscountMode(option.type)}
                    style={[
                      styles.discountOption,
                      selected && styles.discountOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.discountOptionText,
                        selected && styles.discountOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.discountOptionHint,
                        selected && styles.discountOptionTextActive,
                      ]}
                    >
                      {option.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>
              {discountMode === "percent"
                ? "Discount percentage"
                : "Discount amount (LKR)"}
            </Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setDiscountValue}
              placeholder={discountMode === "percent" ? "10" : "58"}
              placeholderTextColor="#9A98AA"
              style={styles.fieldInput}
              value={discountValue}
            />

            {/* Live preview so the clerk sees the money, not just the number. */}
            {discountProduct ? (() => {
              const base = basePriceOf(discountProduct);
              const entered = Number(discountValue);
              const valid =
                Number.isFinite(entered) &&
                entered > 0 &&
                (discountMode === "percent" ? entered <= 100 : entered <= base);

              const discountLkr = !valid
                ? 0
                : discountMode === "percent"
                  ? Math.round(base * (entered / 100))
                  : Math.trunc(entered);
              const finalPrice = Math.max(0, base - discountLkr);
              const equivalentPercent =
                valid && base > 0 ? Math.round((discountLkr / base) * 100) : 0;

              return (
                <View style={styles.discountPreview}>
                  <View style={styles.discountPreviewRow}>
                    <Text style={styles.discountPreviewLabel}>Discount</Text>
                    <Text style={styles.discountPreviewValue}>
                      {valid
                        ? discountMode === "percent"
                          ? `${Math.trunc(entered)}%`
                          : `LKR ${discountLkr.toLocaleString("en-LK")}`
                        : "-"}
                    </Text>
                  </View>
                  <View style={styles.discountPreviewRow}>
                    <Text style={styles.discountPreviewLabel}>You save</Text>
                    <Text style={[styles.discountPreviewValue, { color: "#0A7D5F" }]}>
                      {valid ? `LKR ${discountLkr.toLocaleString("en-LK")}` : "-"}
                    </Text>
                  </View>
                  {/* Only meaningful for a fixed amount, where the rupees are
                      what the clerk chose and the percent is derived. */}
                  {discountMode === "fixed" ? (
                    <View style={styles.discountPreviewRow}>
                      <Text style={styles.discountPreviewLabel}>That is</Text>
                      <Text style={styles.discountPreviewValue}>
                        {valid ? `${equivalentPercent}% off` : "-"}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.discountPreviewRow, styles.discountPreviewTotal]}>
                    <Text style={styles.discountPreviewLabel}>Discount price</Text>
                    <Text style={[styles.discountPreviewValue, styles.discountPreviewTotalValue]}>
                      LKR {finalPrice.toLocaleString("en-LK")}
                    </Text>
                  </View>
                </View>
              );
            })() : null}

            {discountError ? (
              <Text style={styles.discountError}>{discountError}</Text>
            ) : null}

            <PrimaryButton loading={discountSaving} onPress={submitDiscount}>
              {discountSaving ? "Applying..." : "Apply Discount"}
            </PrimaryButton>

            {discountProduct && hasDiscount(discountProduct) ? (
              <SecondaryButton disabled={discountSaving} onPress={removeDiscount}>
                Remove Discount
              </SecondaryButton>
            ) : null}

            <SecondaryButton disabled={discountSaving} onPress={closeDiscount}>
              Cancel
            </SecondaryButton>
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

/**
 * Category field for the product form.
 *
 * Free text with suggestions, not a fixed dropdown. Migration 024 dropped
 * product_categories, so there is no reference table to read the list from and
 * nothing would stop a shop typing "Vegetables" on a database that has never
 * heard of it.
 *
 * The chips below the field are the labels the catalogue already uses,
 * most-used first, followed by SUGGESTED_CATEGORIES for anything not yet in use
 * -- so Fruits, Vegetables and Dairy are there to tap on a shop's very first
 * product, not just the second. They are suggestions, not a whitelist: tapping
 * one fills the field, and typing anything else is accepted. Offering the
 * existing spellings matters because nothing normalises the text on the way in,
 * so a chip is what stops "Veg", "Vegtables" and "Vegetables" becoming three
 * categories that each open a different product list.
 *
 * Leaving it empty is a real choice, not an absent one -- it is what clears the
 * category on an edit -- so the field shows a placeholder rather than a stored
 * value when there is nothing to show.
 */
function CategoryPicker({
  categories,
  onChange,
  value,
}: {
  categories: string[];
  onChange: (label: string) => void;
  value: string;
}) {
  // The chip is compared case-insensitively because the stored text is free, and
  // a chip that reads "Vegetables" should still look picked for "vegetables".
  const matches = (label: string) =>
    label.trim().toLowerCase() === value.trim().toLowerCase();

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Category (optional)</Text>

      <TextInput
        accessibilityLabel="Category"
        autoCapitalize="words"
        onChangeText={onChange}
        placeholder="e.g. Vegetables, Fruits, Dairy"
        placeholderTextColor="#9A98AA"
        style={styles.fieldInput}
        value={value}
      />

      <Text style={styles.fieldHint}>
        Pick a category below, or type your own. Leave empty for none.
      </Text>

      {categories.length ? (
        <View style={styles.categorySuggestions}>
          {categories.map((label) => {
            const active = matches(label);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={label}
                onPress={() => onChange(active ? "" : label)}
                style={({ pressed }) => [
                  styles.categorySuggestion,
                  active && styles.categorySuggestionActive,
                  pressed && styles.dropdownPressed,
                ]}
              >
                <FontAwesome
                  color={colors.ink}
                  name={categoryIcon(label)}
                  size={11}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.categorySuggestionText,
                    active && styles.categorySuggestionTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
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
  fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  discountSummary: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    marginBottom: 14,
    padding: 11,
  },
  discountProduct: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  discountBase: { color: colors.muted, fontSize: 11, marginTop: 3 },
  discountOptionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  discountOption: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  discountOptionActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  discountOptionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  discountOptionHint: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  discountOptionTextActive: { color: colors.white },
  discountPreview: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    marginBottom: 14,
    marginTop: 12,
    padding: 12,
  },
  discountPreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  discountPreviewLabel: { color: colors.muted, fontSize: 11 },
  discountPreviewValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  discountPreviewTotal: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 5,
    paddingTop: 8,
  },
  discountPreviewTotalValue: { fontSize: 15 },
  discountError: {
    color: "#A33D2F",
    fontSize: 11,
    marginBottom: 12,
  },
  dropdownField: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownValue: { color: colors.ink, flex: 1, fontSize: 14 },
  dropdownValueMuted: { color: colors.muted },
  dropdownList: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownOptionDivider: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  dropdownOptionActive: { backgroundColor: "#F3F1FC" },
  dropdownOptionText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600" },
  dropdownOptionTextActive: { fontWeight: "800" },
  dropdownPressed: { opacity: 0.7 },
  categorySuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },
  categorySuggestion: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categorySuggestionActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  categorySuggestionText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  categorySuggestionTextActive: { color: colors.white },
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
