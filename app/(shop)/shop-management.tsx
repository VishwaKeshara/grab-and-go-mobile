import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
  createProduct,
  deleteProduct,
  listProductsByShop,
  updateProduct,
} from "@/services/productService";
import {
  createShop,
  deleteShop,
  listMyShops,
  updateShop,
} from "@/services/shopService";
import type { Product } from "@/types/product";
import type { Shop } from "@/types/shop";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatCurrencyShort } from "@/utils/formatters";

type Mode = "shop-create" | "shop-edit" | "product-create" | "product-edit";

export default function ShopManagement() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [mode, setMode] = useState<Mode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Grocery",
    address: "",
    phone: "",
    price: "",
    stock_quantity: "",
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

  const openCreateShop = () => {
    setForm({
      name: "",
      description: "",
      category: "Grocery",
      address: "",
      phone: "",
      price: "",
      stock_quantity: "",
    });
    setMode("shop-create");
  };

  const openEditShop = (shop: Shop) => {
    setForm({
      name: shop.name,
      description: shop.description,
      category: shop.category,
      address: shop.address,
      phone: shop.phone ?? "",
      price: "",
      stock_quantity: "",
    });
    setMode("shop-edit");
  };

  const openCreateProduct = () => {
    setForm({
      name: "",
      description: "",
      category: "General",
      address: "",
      phone: "",
      price: "",
      stock_quantity: "",
    });
    setMode("product-create");
  };

  const openEditProduct = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      address: "",
      phone: "",
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
    });
    setMode("product-edit");
  };

  const closeModal = () => {
    setMode(null);
    setError("");
  };

  const saveShop = async () => {
    if (!form.name.trim()) {
      setError("Shop name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (mode === "shop-edit" && selectedShop) {
        await updateShop(selectedShop.id, {
          name: form.name,
          description: form.description,
          category: form.category,
          address: form.address,
          phone: form.phone || null,
        });
        setNotice("✓ Shop updated");
      } else {
        const created = await createShop({
          name: form.name,
          description: form.description,
          category: form.category,
          address: form.address,
          phone: form.phone || null,
        });
        setSelectedShop(created);
        setNotice("✓ Shop created");
      }
      closeModal();
      loadShops();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your shop.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    if (!selectedShop) return;

    const price = Number(form.price);
    const stock = Number(form.stock_quantity || 0);

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setError("Enter a valid stock quantity.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (mode === "product-edit" && selectedShop) {
        const existing = products.find((item) => item.id === editingId);
        if (existing) {
          await updateProduct(existing.id, {
            name: form.name,
            description: form.description,
            category: form.category,
            price,
            stock_quantity: stock,
          });
          setNotice("✓ Listing updated");
        }
      } else {
        await createProduct({
          shop_id: selectedShop.id,
          name: form.name,
          description: form.description,
          category: form.category,
          price,
          stock_quantity: stock,
        });
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

  const confirmDeleteShop = (shop: Shop) => {
    Alert.alert(
      "Delete shop?",
      `This removes ${shop.name} and all of its listings. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteShop(shop.id);
              setNotice("✓ Shop deleted");
              loadShops();
            } catch (deleteError) {
              setError(
                deleteError instanceof Error
                  ? deleteError.message
                  : "We could not delete that shop.",
              );
            }
          },
        },
      ],
    );
  };

  const confirmDeleteProduct = (product: Product) => {
    Alert.alert("Delete listing?", `Remove ${product.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!selectedShop) return;
          try {
            await deleteProduct(product.id);
            setNotice("✓ Listing deleted");
            loadProducts(selectedShop.id);
          } catch (deleteError) {
            setError(
              deleteError instanceof Error
                ? deleteError.message
                : "We could not delete that listing.",
            );
          }
        },
      },
    ]);
  };

  const isProductMode = mode === "product-create" || mode === "product-edit";

  return (
    <AuthFrame>
      <AuthHeader eyebrow="SHOP" title="Shop Management" />
      {error && !mode ? <ErrorBanner message={error} /> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {loading ? (
        <Text style={styles.muted}>Loading your shops...</Text>
      ) : shops.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={styles.emptyTitle}>No shops yet</Text>
          <Text style={styles.emptyText}>
            Create your first shop to start adding product listings.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Your shops</Text>
          <ScrollView
            contentContainerStyle={styles.shopRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {shops.map((shop) => {
              const active = selectedShop?.id === shop.id;
              return (
                <Pressable
                  key={shop.id}
                  onPress={() => {
                    setProductsLoading(true);
                    setSelectedShop(shop);
                  }}
                  style={[styles.shopChip, active && styles.shopChipActive]}
                >
                  <Text
                    style={[
                      styles.shopChipText,
                      active && styles.shopChipTextActive,
                    ]}
                  >
                    {shop.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selectedShop ? (
            <View style={styles.shopCard}>
              <View style={styles.shopCardHeader}>
                <View style={styles.shopCardCopy}>
                  <Text style={styles.shopName}>{selectedShop.name}</Text>
                  <Text style={styles.shopMeta}>
                    {selectedShop.category} •{" "}
                    {selectedShop.is_active ? "Active" : "Paused"}
                  </Text>
                  {selectedShop.address ? (
                    <Text style={styles.shopAddress}>{selectedShop.address}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.shopActions}>
                <Pressable onPress={() => openEditShop(selectedShop)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    updateShop(selectedShop.id, {
                      is_active: !selectedShop.is_active,
                    })
                      .then(() => {
                        setNotice(
                          selectedShop.is_active ? "✓ Shop paused" : "✓ Shop resumed",
                        );
                        loadShops();
                        return undefined;
                      })
                      .catch((toggleError) =>
                        setError(
                          toggleError instanceof Error
                            ? toggleError.message
                            : "We could not update the shop.",
                        ),
                      )
                  }
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>
                    {selectedShop.is_active ? "Pause" : "Resume"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteShop(selectedShop)}
                  style={[styles.smallButton, styles.dangerButton]}
                >
                  <Text style={[styles.smallButtonText, styles.dangerText]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.listingHeader}>
            <Text style={styles.sectionTitle}>
              Product listings
              {products.length > 0 ? ` (${products.length})` : ""}
            </Text>
            <Pressable onPress={openCreateProduct}>
              <Text style={styles.addLink}>+ Add listing</Text>
            </Pressable>
          </View>
          {productsLoading || !selectedShop ? (
            <Text style={styles.muted}>Loading listings...</Text>
          ) : products.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptyText}>
                No listings for this shop yet. Add your first product.
              </Text>
            </View>
          ) : (
            products.map((product) => (
              <View key={product.id} style={styles.listingCard}>
                <View style={styles.listingThumb}>
                  <Text style={styles.listingThumbText}>
                    {product.name.slice(0, 1)}
                  </Text>
                </View>
                <View style={styles.listingCopy}>
                  <Text style={styles.listingName}>{product.name}</Text>
                  <Text style={styles.listingMeta}>
                    {product.category} • {product.stock_quantity} in stock
                    {product.stock_quantity === 0 ? " • Out of stock" : ""}
                  </Text>
                  <Text style={styles.listingPrice}>
                    {formatCurrencyShort(product.price)}
                  </Text>
                </View>
                <View style={styles.listingActions}>
                  <Pressable
                    accessibilityLabel={`Edit ${product.name}`}
                    onPress={() => {
                      setEditingId(product.id);
                      openEditProduct(product);
                    }}
                    style={styles.iconButton}
                  >
                    <Text style={styles.iconButtonText}>✎</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${product.name}`}
                    onPress={() => confirmDeleteProduct(product)}
                    style={styles.iconButton}
                  >
                    <Text style={[styles.iconButtonText, styles.dangerText]}>
                      ×
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <PrimaryButton onPress={openCreateShop}>+ Create a new shop</PrimaryButton>
        </>
      )}
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
                {mode === "shop-create"
                  ? "New shop"
                  : mode === "shop-edit"
                    ? "Edit shop"
                    : mode === "product-create"
                      ? "New listing"
                      : "Edit listing"}
              </Text>
              <Pressable accessibilityLabel="Close" onPress={closeModal}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {error ? <ErrorBanner message={error} /> : null}
              <ModalField
                label="Name"
                onChangeText={(value) => setForm({ ...form, name: value })}
                value={form.name}
              />
              <ModalField
                label="Description"
                multiline
                onChangeText={(value) => setForm({ ...form, description: value })}
                value={form.description}
              />
              {isProductMode ? (
                <ModalField
                  label="Category"
                  onChangeText={(value) => setForm({ ...form, category: value })}
                  value={form.category}
                />
              ) : (
                <>
                  <ModalField
                    label="Category"
                    onChangeText={(value) => setForm({ ...form, category: value })}
                    value={form.category}
                  />
                  <ModalField
                    label="Address"
                    onChangeText={(value) => setForm({ ...form, address: value })}
                    value={form.address}
                  />
                  <ModalField
                    keyboardType="phone-pad"
                    label="Phone"
                    onChangeText={(value) => setForm({ ...form, phone: value })}
                    value={form.phone}
                  />
                </>
              )}
              {isProductMode ? (
                <>
                  <ModalField
                    keyboardType="decimal-pad"
                    label="Price (LKR)"
                    onChangeText={(value) => setForm({ ...form, price: value })}
                    value={form.price}
                  />
                  <ModalField
                    keyboardType="number-pad"
                    label="Stock quantity"
                    onChangeText={(value) =>
                      setForm({ ...form, stock_quantity: value })
                    }
                    value={form.stock_quantity}
                  />
                </>
              ) : null}
              <PrimaryButton
                loading={saving}
                onPress={isProductMode ? saveProduct : saveShop}
              >
                {mode?.endsWith("edit") ? "Save changes" : "Create"}
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

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 11,
  },
  muted: { color: colors.muted, fontSize: 12 },
  notice: {
    color: "#07856A",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
  },
  shopRow: { gap: 8, paddingBottom: 14, paddingRight: 22 },
  shopChip: {
    backgroundColor: "#E9EAF9",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  shopChipActive: { backgroundColor: colors.ink },
  shopChipText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  shopChipTextActive: { color: colors.white },
  shopCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 18,
    padding: 13,
  },
  shopCardHeader: { flexDirection: "row" },
  shopCardCopy: { flex: 1 },
  shopName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  shopMeta: { color: "#07856A", fontSize: 9, marginTop: 4 },
  shopAddress: { color: colors.muted, fontSize: 10, marginTop: 4 },
  shopActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14,
  },
  smallButtonText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  dangerButton: { backgroundColor: "#FFF0ED" },
  dangerText: { color: colors.coral },
  listingHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addLink: { color: "#07856A", fontSize: 10, fontWeight: "800" },
  listingCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 11,
  },
  listingThumb: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 11,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  listingThumbText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  listingCopy: { flex: 1, marginLeft: 10 },
  listingName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  listingMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  listingPrice: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  listingActions: { gap: 6 },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  iconButtonText: { color: colors.ink, fontSize: 14 },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 16,
    marginTop: 18,
    padding: 28,
  },
  emptySmall: {
    backgroundColor: "#F0F1FC",
    borderRadius: 12,
    marginBottom: 14,
    padding: 16,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    padding: 20,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  modalClose: { color: colors.muted, fontSize: 26, lineHeight: 28 },
  field: { marginBottom: 13 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: "#F0F1FC",
    borderRadius: 11,
    color: colors.ink,
    fontSize: 13,
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
});