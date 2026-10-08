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
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

/**
 * One shop's products, reached by tapping a row in Nearby Shops.
 *
 * Deliberately the same screen and the same add-to-cart path as Search results,
 * so a shopper who taps through a shop and one who searches can both add without
 * learning two different flows.
 */
export default function ShopProducts() {
  const { shopId, shopName } = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
  }>();

  const { addItem, adding, error: cartError, shop: cartShop } = useCart();

  // Reached only by a link with no shop id, handled as a render branch rather than
  // as thrown state.
  const missingShop = !shopId;

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [offersOnly, setOffersOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [error, setError] = useState("");

  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 4 : 2;
  const gap = 12;
  const horizontalPadding = 44;
  const itemWidth = (width - horizontalPadding - gap * (numColumns - 1)) / numColumns;

  // `loading` starts true and is only cleared here. The toggle handlers set it
  // back to true when they change a filter, which keeps this effect free of a
  // synchronous setState -- calling one from an effect body cascades a render
  // before the request has even been sent.
  const load = useCallback(() => {
    // With no shop there is nothing to ask for. `missingShop` is rendered instead,
    // so there is no state to set here -- a synchronous setState in an effect body
    // cascades a render before a request is even sent.
    if (!shopId) return;

    fetchDiscoveryProducts({
      shopId,
      query: submitted,
      offersOnly,
      inStockOnly,
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
            : "We could not load this shop's products.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [shopId, submitted, offersOnly, inStockOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (product: DiscoveredProduct) => {
    setAddingId(product.id);
    setAddError("");

    // addItem opens the ShopSwitchModal itself when the cart belongs to a
    // different shop, so the shopper is asked before anything is cleared rather
    // than discovering it at checkout.
    const { added, reason } = await addItem(toCartProduct(product));

    if (!added && reason) {
      // addItem already raised its own Alert on native. On web Alert.alert is a
      // no-op, so without this the tap would look completely broken.
      setAddError(reason);
    }

    setAddingId(null);
  };

  const title = shopName || "Shop";
  // Only worth warning about once both shops are known.
  const isOtherShop = Boolean(cartShop && shopId && cartShop.id !== shopId);

  const header = (
    <View>
      <View style={styles.shopHead}>
        <View style={styles.icon}>
          <FontAwesome color={colors.ink} name="shopping-basket" size={17} />
        </View>
        <View style={styles.shopHeadCopy}>
          <Text numberOfLines={1} style={styles.shopName}>
            {title}
          </Text>
          <Text style={styles.shopMeta}>
            {products.length} item{products.length === 1 ? "" : "s"} available
          </Text>
        </View>
      </View>

      {isOtherShop ? (
        <View style={styles.notice}>
          <FontAwesome color={colors.ink} name="exchange" size={12} />
          <Text style={styles.noticeText}>
            Your cart has items from another shop. Adding here asks before it
            switches.
          </Text>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <FontAwesome color={colors.muted} name="search" size={14} />
        <TextInput
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmitted(query.trim())}
          placeholder={`Search in ${title}`}
          placeholderTextColor="#9693A6"
          returnKeyType="search"
          style={styles.search}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => {
              setLoading(true);
              setQuery("");
              setSubmitted("");
            }}
          >
            <FontAwesome color={colors.muted} name="times-circle" size={14} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => {
            // A filter change is a new request, so the spinner comes back here
            // rather than inside the effect that runs the query.
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
            Offers
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setLoading(true);
            setInStockOnly((value) => !value);
          }}
          style={[styles.chip, inStockOnly && styles.chipActive]}
        >
          <Text style={[styles.chipText, inStockOnly && styles.chipTextActive]}>
            In stock
          </Text>
        </Pressable>
      </View>

      {error || addError || cartError ? (
        <Text style={styles.error}>{error || addError || cartError}</Text>
      ) : null}
    </View>
  );

  const empty = missingShop ? (
    <View style={styles.empty}>
      <FontAwesome color={colors.muted} name="shopping-basket" size={28} />
      <Text style={styles.emptyTitle}>No shop selected</Text>
      <Text style={styles.emptyText}>
        Choose a shop from Nearby shops to see what it stocks.
      </Text>
    </View>
  ) : loading ? (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.ink} size="large" />
      <Text style={styles.emptyText}>Loading products…</Text>
    </View>
  ) : (
    <View style={styles.empty}>
      <FontAwesome color={colors.muted} name="shopping-basket" size={28} />
      <Text style={styles.emptyTitle}>Nothing to show</Text>
      <Text style={styles.emptyText}>
        {offersOnly
          ? "This shop has no offers running right now."
          : submitted
            ? `Nothing matched “${submitted}” in this shop.`
            : "This shop has no products listed yet."}
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
          accessibilityLabel={`Search all products at ${title}`}
          hitSlop={10}
          onPress={() =>
            router.push({ pathname: "/(customer)/search", params: { shopId } })
          }
          style={styles.back}
        >
          <FontAwesome color={colors.ink} name="search" size={15} />
        </Pressable>
      </View>

      <FlatList
        // Handed an element rather than a function reference: a component-type
        // header whose identity changes each render remounts the subtree, which
        // drops the TextInput focus after a keystroke.
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
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
              mode="tile"
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
  shopHead: { alignItems: "center", flexDirection: "row", marginTop: 16 },
  icon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  shopHeadCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  shopName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  shopMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  notice: {
    alignItems: "center",
    backgroundColor: "#FFF0D5",
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 10,
  },
  noticeText: { color: colors.ink, flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 14 },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 46,
    marginTop: 13,
    paddingHorizontal: 14,
  },
  search: { color: colors.ink, flex: 1, fontSize: 12, paddingHorizontal: 9 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 11 },
  chip: {
    alignItems: "center",
    backgroundColor: colors.lilac,
    borderRadius: 15,
    flexDirection: "row",
    gap: 5,
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
  list: { paddingBottom: 110, paddingHorizontal: 22, paddingTop: 4 },
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