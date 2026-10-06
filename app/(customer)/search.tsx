import { AuthFrame, AuthHeader, ErrorBanner } from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import { searchCanonicalProducts as searchProducts } from "@/services/productService";
import type { ProductSort, ProductWithShop } from "@/types/product";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { formatCurrencyShort } from "@/utils/formatters";
import { useCart } from "@/hooks/useCart";

const SORTS: { label: string; value: ProductSort }[] = [
  { label: "Newest", value: "relevance" },
  { label: "Price: Low", value: "price_asc" },
  { label: "Price: High", value: "price_desc" },
  { label: "A–Z", value: "name" },
];

export default function Search() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sort, setSort] = useState<ProductSort>("relevance");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [results, setResults] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();

  // Determine numColumns based on width for responsiveness
  const numColumns = width >= 768 ? 4 : 2;
  const gap = 12;
  const horizontalPadding = 44; // AuthFrame has paddingHorizontal: 22
  const itemWidth = (width - horizontalPadding - (gap * (numColumns - 1))) / numColumns;

  const { addItem, adding } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);

  const runSearch = useCallback(
    (term: string) => {
      searchProducts({
        query: term,
        inStockOnly,
        sort,
      })
        .then((items) => {
          setResults(items);
        })
        .catch((searchError: unknown) => {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "We could not run that search.",
          );
        })
        .finally(() => {
          setLoading(false);
          setSearching(false);
        });
    },
    [inStockOnly, sort],
  );

  useEffect(() => {
    runSearch(submitted);
  }, [runSearch, submitted]);

  const submit = (term: string) => {
    setQuery(term);
    setSearching(true);
    setSubmitted(term.trim());
    inputRef.current?.blur();
  };

  const handleAddToCart = async (product: ProductWithShop) => {
    setAddingId(product.id);
    // Cast to any to satisfy GroceryProduct since id is all that is used to match catalog
    await addItem(product as any);
    setAddingId(null);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          onChangeText={setQuery}
          onSubmitEditing={() => submit(query)}
          placeholder="Search products and shops"
          placeholderTextColor="#9A98AA"
          ref={inputRef}
          returnKeyType="search"
          style={styles.search}
          value={query}
        />
        {searching ? (
          <ActivityIndicator color={colors.ink} size="small" />
        ) : query.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            onPress={() => {
              setQuery("");
              setLoading(true);
              setSubmitted("");
            }}
            style={styles.clear}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={SORTS}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setLoading(true);
              setSort(item.value);
            }}
            style={[styles.chip, sort === item.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, sort === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => {
          setLoading(true);
          setInStockOnly((value) => !value);
        }}
        style={styles.stockToggle}
      >
        <View style={[styles.checkbox, inStockOnly && styles.checkboxOn]}>
          {inStockOnly ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.stockLabel}>In stock only</Text>
      </Pressable>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>
          {submitted ? `Results for “${submitted}”` : "All products"}
        </Text>
        {!loading && (
          <Text style={styles.resultCount}>
            {results.length} item{results.length === 1 ? "" : "s"}
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>⌕</Text>
        <Text style={styles.emptyTitle}>No products found</Text>
        <Text style={styles.emptyText}>
          Try a different keyword or clear your filters.
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ProductWithShop }) => {
    const outOfStock = item.stock_quantity === 0;
    const isAddingThis = adding && addingId === item.id;

    return (
      <View style={[styles.cardWrapper, { width: itemWidth }]}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(customer)/product-details",
              params: { id: item.id },
            })
          }
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.thumb}>
              <Text style={styles.thumbText}>{item.name.slice(0, 1)}</Text>
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.cardShop} numberOfLines={1}>{item.shop_name}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.category} · {item.unit}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatCurrencyShort(item.price)}</Text>
              {outOfStock && <Text style={styles.outOfStockText}>Out of stock</Text>}
            </View>

            <Pressable
              style={[
                styles.addButton,
                (outOfStock || isAddingThis) && styles.addButtonDisabled,
              ]}
              disabled={outOfStock || isAddingThis}
              onPress={() => handleAddToCart(item)}
            >
              {isAddingThis ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <AuthFrame>
      <AuthHeader title="Search" />
      <FlatList
        key={numColumns}
        data={results}
        numColumns={numColumns}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={results.length > 0 ? styles.columnWrapper : undefined}
      />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: 10,
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 24, // highly rounded search bar
    flexDirection: "row",
    marginBottom: 14,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  searchIcon: { color: colors.muted, fontSize: 18, marginRight: 8 },
  search: { color: colors.ink, flex: 1, fontSize: 14, paddingVertical: 12 },
  clear: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 24,
    backgroundColor: colors.line,
    borderRadius: 12,
    marginLeft: 8,
  },
  clearText: { color: colors.muted, fontSize: 14, fontWeight: "bold" },
  chipRow: { gap: 8, paddingBottom: 16, paddingRight: 22 },
  chip: {
    backgroundColor: "#E9EAF9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  stockToggle: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    marginRight: 10,
    width: 20,
  },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: "900" },
  stockLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  resultCount: { color: colors.muted, fontSize: 12 },
  listContent: {
    paddingBottom: 100, // proper bottom padding so nav doesn't cover
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 16,
  },
  cardWrapper: {
    // width applied via inline style
    flexDirection: "column",
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
    flex: 1,
  },
  productImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#F8F9FA",
  },
  thumb: {
    width: "100%",
    height: 120,
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    justifyContent: "center",
  },
  thumbText: { color: colors.ink, fontSize: 32, fontWeight: "900" },
  cardContent: {
    padding: 12,
    flex: 1,
    flexDirection: "column",
  },
  cardName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
    minHeight: 36,
    lineHeight: 18,
  },
  cardShop: { color: "#07856A", fontSize: 11, marginBottom: 2 },
  cardMeta: { color: colors.muted, fontSize: 11, marginBottom: 8 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  price: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  outOfStockText: { color: colors.coral, fontSize: 10, fontWeight: "700" },
  addButton: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  addButtonDisabled: {
    backgroundColor: colors.muted,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: "center",
  },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: 12 },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 16,
    marginTop: 20,
    padding: 32,
  },
  emptyIcon: { color: colors.mint, fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  pressed: { opacity: 0.8 },
});
