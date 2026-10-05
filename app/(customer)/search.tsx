import {
  AuthFrame,
  AuthHeader,
  ErrorBanner,
} from "@/components/AuthUI";
import { colors } from "@/constants/colors";
import {
  searchCanonicalProducts as searchProducts,
} from "@/services/productService";
import type { ProductSort, ProductWithShop } from "@/types/product";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatCurrencyShort, formatRelativeTime } from "@/utils/formatters";

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

  const loadHistory = useCallback(() => {}, []);

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

  const removeHistory = async (id: string) => {};

  const clearAllHistory = async () => {};

  const showHistory = false;

  return (
    <AuthFrame>
      <AuthHeader title="Search" />
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
      <ScrollView
        horizontal
        contentContainerStyle={styles.chipRow}
        showsHorizontalScrollIndicator={false}
      >
        {SORTS.map((item) => (
          <Pressable
            key={item.value}
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
        ))}
      </ScrollView>

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
        {!loading ? (
          <Text style={styles.resultCount}>
            {results.length} item{results.length === 1 ? "" : "s"}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <Text style={styles.muted}>Loading products...</Text>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⌕</Text>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyText}>
            Try a different keyword or clear your filters.
          </Text>
        </View>
      ) : (
        results.map((product) => (
          <Pressable
            key={product.id}
            onPress={() =>
              router.push({
                pathname: "/(customer)/product-details",
                params: { id: product.id },
              })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.thumb}>
              <Text style={styles.thumbText}>{product.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardName}>{product.name}</Text>
              <Text style={styles.cardShop}>{product.shop_name}</Text>
              <Text style={styles.cardMeta}>
                {product.category} · {product.stock_quantity} {product.unit}
                {product.stock_quantity === 0 ? " · Out of stock" : ""}
              </Text>
            </View>
            <Text style={styles.price}>
              {formatCurrencyShort(product.price)}
            </Text>
          </Pressable>
        ))
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 11,
    flexDirection: "row",
    marginBottom: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchIcon: { color: colors.muted, fontSize: 17, marginRight: 8 },
  search: { color: colors.ink, flex: 1, fontSize: 13, paddingVertical: 12 },
  clear: { alignItems: "center", height: 22, justifyContent: "center", width: 22 },
  clearText: { color: colors.muted, fontSize: 18, lineHeight: 20 },
  chipRow: { gap: 7, paddingBottom: 12, paddingRight: 22 },
  chip: {
    backgroundColor: "#E9EAF9",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  stockToggle: { alignItems: "center", flexDirection: "row", marginBottom: 16 },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    marginRight: 8,
    width: 18,
  },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkmark: { color: colors.white, fontSize: 11, fontWeight: "900" },
  stockLabel: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  historyBlock: { marginBottom: 18 },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearAll: { color: colors.coral, fontSize: 10, fontWeight: "800" },
  historyRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    padding: 11,
  },
  historyMain: { flex: 1 },
  historyQuery: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  historyMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  historyDelete: { alignItems: "center", paddingLeft: 10 },
  historyDeleteText: { color: colors.muted, fontSize: 18, lineHeight: 20 },
  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultCount: { color: colors.muted, fontSize: 10 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 11,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 11,
  },
  thumb: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 11,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  thumbText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  cardCopy: { flex: 1, marginLeft: 10 },
  cardName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  cardShop: { color: "#07856A", fontSize: 9, marginTop: 3 },
  cardMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  price: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  empty: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 16,
    marginTop: 18,
    padding: 28,
  },
  emptyIcon: { color: colors.mint, fontSize: 30 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 9,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    textAlign: "center",
  },
  muted: { color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.75 },
});