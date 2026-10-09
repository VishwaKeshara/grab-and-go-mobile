import { BrowseProductCard, toCartProduct } from "@/components/BrowseProductCard";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { fetchDiscoveryProducts } from "@/services/discoveryService";
import type { DiscoveredProduct } from "@/types/discovery";
import { FontAwesome } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

/**
 * Products in one category, reached from the home "Browse categories" rail.
 *
 * The categories themselves come from product_categories (see
 * discoveryService.listBrowseCategories), so a category a shop has since filled
 * with products appears on the rail with a real count behind it, and one with
 * nothing in it never appears at all.
 */
export default function CategoryProducts() {
  const { categoryId, categoryName } = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
  }>();

  const { addItem, adding, error: cartError } = useCart();

  // A link with no category id is the only way to land here without one, and it
  // is handled as a render branch rather than as thrown state.
  const missingCategory = !categoryId;

  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [offersOnly, setOffersOnly] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [error, setError] = useState("");

  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 4 : 2;
  const gap = 12;
  const horizontalPadding = 40;
  const itemWidth = (width - horizontalPadding - gap * (numColumns - 1)) / numColumns;

  // `loading` starts true and is only ever cleared here. The Offers toggle sets it
  // back to true before changing the filter, so this effect never needs a
  // synchronous setState -- one in an effect body cascades a render before the
  // request is even sent.
  const load = useCallback(() => {
    // With no category there is nothing to ask for. `missingCategory` is rendered
    // instead, so there is no state to set here -- a synchronous setState in an
    // effect body cascades a render before a request is even sent.
    if (!categoryId) return;

    fetchDiscoveryProducts({ categoryId, offersOnly })
      .then((found) => {
        setProducts(found);
        // Cleared here rather than before the request, so a successful load always
        // leaves the banner empty and no setState runs synchronously.
        setError("");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not load this category.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [categoryId, offersOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (product: DiscoveredProduct) => {
    setAddingId(product.id);
    setAddError("");

    const { added, reason } = await addItem(toCartProduct(product));

    if (!added && reason) {
      setAddError(reason);
    }

    setAddingId(null);
  };

  const title = categoryName || "Category";

  const header = (
    <View>
      <View style={styles.headBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {products.length} product{products.length === 1 ? "" : "s"}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          setLoading(true);
          setOffersOnly((value) => !value);
        }}
        style={[styles.chip, offersOnly && styles.chipActive]}
      >
        <FontAwesome
          color={offersOnly ? colors.white : colors.coral}
          name="tag"
          size={10}
        />
        <Text style={[styles.chipText, offersOnly && styles.chipTextActive]}>
          Offers only
        </Text>
      </Pressable>

      {error || addError || cartError ? (
        <Text style={styles.error}>{error || addError || cartError}</Text>
      ) : null}
    </View>
  );

  const empty = missingCategory ? (
    <View style={styles.empty}>
      <FontAwesome color={colors.muted} name="tags" size={28} />
      <Text style={styles.emptyTitle}>No category selected</Text>
      <Text style={styles.emptyText}>
        Pick a category from Browse categories on the home screen.
      </Text>
    </View>
  ) : loading ? (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.ink} size="large" />
      <Text style={styles.emptyText}>Loading products…</Text>
    </View>
  ) : (
    <View style={styles.empty}>
      <FontAwesome color={colors.muted} name="tags" size={28} />
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptyText}>
        {offersOnly
          ? `No offers running in ${title} right now.`
          : `No shops have stocked ${title} yet.`}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.back}
        >
          <FontAwesome color={colors.ink} name="chevron-left" size={16} />
        </Pressable>
        <Text style={styles.heading}>{title}</Text>
        <Pressable
          accessibilityLabel={`Search within ${title}`}
          hitSlop={10}
          onPress={() =>
            router.push({
              pathname: "/(customer)/search",
              params: { categoryId, categoryName: title },
            })
          }
          style={styles.back}
        >
          <FontAwesome color={colors.ink} name="search" size={15} />
        </Pressable>
      </View>

      <FlatList
        ListEmptyComponent={empty}
        ListHeaderComponent={header}
        columnWrapperStyle={products.length ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.list}
        data={products}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <View style={{ width: itemWidth }}>
            <BrowseProductCard
              addDisabled={adding}
              addingId={addingId}
              onAdd={handleAdd}
              product={item}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  back: { alignItems: "center", height: 30, justifyContent: "center", width: 30 },
  heading: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900", textAlign: "center" },
  headBlock: { marginTop: 16 },
  title: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  count: { color: colors.muted, fontSize: 11, marginTop: 4 },
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.lilac,
    borderRadius: 15,
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: colors.white },
  error: {
    backgroundColor: "#FFE6E0",
    borderRadius: 10,
    color: "#A43A32",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 11,
    padding: 10,
  },
  list: { paddingBottom: 110, paddingHorizontal: 20, paddingTop: 4 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 12 },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 260,
    textAlign: "center",
  },
});