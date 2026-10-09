import { BrowseProductCard, toCartProduct } from "@/components/BrowseProductCard";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { fetchDiscoveryProducts, listBrowseCategories } from "@/services/discoveryService";
import type { DiscoveredProduct } from "@/types/discovery";
import { FontAwesome } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The product list behind the home "Browse categories" rail.
 *
 * One screen for the whole rail rather than a screen per tile: every category tap
 * lands here, and the tapped category arrives as a param that pre-selects its
 * chip. Switching category is then a chip tap on this screen, instead of going
 * back to home and starting again -- which is the obvious thing to do once you
 * can see there is more than one category.
 *
 * The chips come from the distinct customer_products.category values
 * (discoveryService.listBrowseCategories) rather than from what was passed in, so
 * the row offers every category that has products, including ones the shopper
 * did not tap through to.
 */
export default function CategoryProducts() {
    const insets = useSafeAreaInsets();
  // The label is the id: migration 024 dropped product_categories, so there is no
  // separate key to route with. Both params carry the same text; category is the
  // one that matters, and the heading is derived from the selected chip so it
  // stays correct when the shopper switches category.
  const { category } = useLocalSearchParams<{
    category?: string;
  }>();

  const { addItem, adding, error: cartError } = useCart();

  // null means "no category selected", which is the All chip. Read once on mount
  // so a later param change cannot silently re-scope a list the shopper is
  // already reading; changing category is what the chips are for.
  const [selected, setSelected] = useState<string | null>(category ?? null);

  const [chips, setChips] = useState<string[]>([]);
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

  // `loading` starts true and is only ever cleared here. Every control that changes
  // the query sets it back to true first, so this effect never needs a synchronous
  // setState -- one in an effect body cascades a render before the request is even
  // sent.
  const load = useCallback(() => {
    // `category: null` is the All chip, which is a real query with no category
    // filter rather than no query at all.
    fetchDiscoveryProducts({
      category: selected ?? undefined,
      offersOnly,
    })
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
  }, [selected, offersOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  // The chip row. Fetched separately from the products because it changes far less
  // often, and a failure here only costs the row -- the list below still works,
  // and the shopper can still search.
  useEffect(() => {
    let active = true;

    listBrowseCategories()
      .then((found) => {
        if (active) setChips(found.map((entry) => entry.name));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const handleAdd = async (product: DiscoveredProduct) => {
    setAddingId(product.id);
    setAddError("");

    const { added, reason } = await addItem(toCartProduct(product));

    if (!added && reason) {
      setAddError(reason);
    }

    setAddingId(null);
  };

  // Follows the selected chip, not the URL param, so the heading updates with the
  // list instead of claiming to show a category the shopper just switched away
  // from. With no chip selected the heading is the whole catalogue.
  const title = selected ?? "All products";

  const header = (
    <View>
      <View style={styles.headBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {products.length} product{products.length === 1 ? "" : "s"}
        </Text>
      </View>

      {/* Every category that has products, plus All first. Rendered whenever the
          chips resolved to anything -- including with nothing selected, because
          All is the way to get back to the full list after picking a category. */}
      {chips.length ? (
        <ScrollView
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selected === null }}
            onPress={() => {
              setLoading(true);
              setSelected(null);
            }}
            style={[styles.categoryChip, selected === null && styles.categoryChipActive]}
          >
            <Text
              style={[
                styles.categoryChipText,
                selected === null && styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>

          {chips.map((chip) => {
            const active = selected === chip;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={chip}
                onPress={() => {
                  setLoading(true);
                  setSelected(chip);
                }}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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

  const empty = loading ? (
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
          : selected
            ? `No shops have stocked ${selected} yet.`
            : "No shops have listed any products yet."}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
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
              // The currently selected chip, not the original param: searching from the
              // header should search what the shopper is looking at now.
              params: { category: selected ?? undefined },
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
  },
  back: { alignItems: "center", height: 30, justifyContent: "center", width: 30 },
  heading: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "600", textAlign: "center" },
  headBlock: { marginTop: 16 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  count: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 },
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
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  chipRow: { gap: 8, paddingVertical: 13 },
  categoryChip: {
    backgroundColor: colors.lilac,
    borderRadius: 15,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipActive: { backgroundColor: colors.ink },
  categoryChipText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  categoryChipTextActive: { color: colors.white },
  error: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 11,
    padding: 10,
  },
  list: { paddingBottom: 110, paddingHorizontal: 20, paddingTop: 4 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptyText: {fontWeight: "400", color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 260,
    textAlign: "center",
  },
});