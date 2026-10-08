import { AuthFrame, AuthHeader, ErrorBanner } from "@/components/AuthUI";
import { BrowseProductCard, toCartProduct } from "@/components/BrowseProductCard";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import { fetchDiscoveryProducts } from "@/services/discoveryService";
import {
  clearSearchHistory,
  listSearchHistory,
  recordSearch,
} from "@/services/productService";
import type { DiscoveredProduct } from "@/types/discovery";
import type { ProductSort, SearchHistoryEntry } from "@/types/product";
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const SORTS: { label: string; value: ProductSort }[] = [
  { label: "Newest", value: "relevance" },
  { label: "Price: Low", value: "price_asc" },
  { label: "Price: High", value: "price_desc" },
  { label: "A–Z", value: "name" },
];

/** How long the "Added to cart" bar stays up before it slides away. */
const ADD_TOAST_MS = 2200;

/**
 * The confirmation that slides up from the bottom after an Add.
 *
 * Positioned absolutely rather than rendered after the list, so it floats over
 * the bottom tab bar instead of being pushed underneath it, and is pointerEvents
 * "none" so it cannot swallow a tap meant for a product behind it.
 *
 * It stays mounted while hidden so the exit animation can actually play. A
 * conditional return would drop it the instant `visible` went false and it would
 * blink out rather than slide away, so hiding is done with opacity and offset,
 * and the contents are pulled out of the accessibility tree instead.
 *
 * It is confirmation, not an error path: a failure already sets addError and
 * shows an ErrorBanner, and the two appearing at once would contradict
 * themselves.
 */
function AddToCartToast({
  message,
  productCount,
  visible,
}: {
  message: string;
  productCount: number;
  visible: boolean;
}) {
  // Held in state via a lazy initialiser rather than a ref: an Animated.Value is
  // an object, so it needs a stable identity across renders, and the react-hooks
  // lint rules reject reading a ref during render. An always-zero value is not a
  // problem because the first render is always the hidden one anyway.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = visible
      ? Animated.spring(slide, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.7,
        })
      : Animated.timing(slide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        });

    animation.start();
  }, [slide, visible]);

  // translateY rather than height, so the slide is a movement rather than a
  // relayout of everything under it. `useNativeDriver` keeps it off the JS thread,
  // which is what stops it stuttering while the cart re-renders behind it.
  return (
    <Animated.View
      // A zero-opacity view is still announced by a screen reader, so the
      // contents are hidden from accessibility while it is off screen.
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [90, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.toastIcon}>
        <FontAwesome color={colors.ink} name="check" size={13} />
      </View>
      <Text numberOfLines={1} style={styles.toastText}>
        {message}
      </Text>
      <View style={styles.toastCount}>
        <FontAwesome color={colors.ink} name="shopping-basket" size={11} />
        <Text style={styles.toastCountText}>{productCount}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Recent searches, as chips above the filters.
 *
 * Reads the search_history table through the existing productService helpers, so
 * nothing new was added to the schema. A signed-out shopper has no rows to read,
 * and a failure here must not take the search screen down with it, so both the
 * read and the record are wrapped and left to fail quietly.
 */
function RecentSearches({
  entries,
  onPick,
  onClear,
}: {
  entries: SearchHistoryEntry[];
  onPick: (query: string) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <View style={styles.recentBlock}>
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>Recent searches</Text>
        <Pressable
          accessibilityLabel="Clear recent searches"
          accessibilityRole="button"
          onPress={onClear}
        >
          <Text style={styles.recentClear}>Clear</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.recentRow}
        data={entries}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Search again for ${item.query}`}
            accessibilityRole="button"
            onPress={() => onPick(item.query)}
            style={({ pressed }) => [styles.recentChip, pressed && styles.recentChipPressed]}
          >
            <FontAwesome color={colors.muted} name="clock-o" size={10} />
            <Text numberOfLines={1} style={styles.recentChipText}>
              {item.query}
            </Text>
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

export default function Search() {
  // Nearby Shops and the home category rail deep-link in with these, so the
  // filter row reflects where the shopper actually is instead of resetting.
  const params = useLocalSearchParams<{
    shopId?: string;
    shopName?: string;
    categoryId?: string;
    categoryName?: string;
    offers?: string;
  }>();

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sort, setSort] = useState<ProductSort>("relevance");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(params.offers === "1");
  const [results, setResults] = useState<DiscoveredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();

  const numColumns = width >= 768 ? 4 : 2;
  const gap = 12;
  const horizontalPadding = 44; // AuthFrame has paddingHorizontal: 22
  const itemWidth = (width - horizontalPadding - gap * (numColumns - 1)) / numColumns;

  const { addItem, adding, error: cartError, cart } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");

  /** Text of the sliding confirmation, and whether it is on screen. */
  const [toast, setToast] = useState({ message: "", visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recent, setRecent] = useState<SearchHistoryEntry[]>([]);

  const refreshRecent = useCallback(() => {
    listSearchHistory(8)
      .then(setRecent)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  // Cleared on unmount so a toast cannot try to setState after the screen is
  // gone, which React warns about and which is reachable by navigating away
  // inside the toast's own lifetime.
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast((current) => ({ ...current, visible: false })),
      ADD_TOAST_MS,
    );
  };

  const runSearch = useCallback(
    (term: string) => {
      fetchDiscoveryProducts({
        query: term,
        shopId: params.shopId,
        categoryId: params.categoryId,
        inStockOnly,
        offersOnly,
        sort,
      })
        .then(setResults)
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
    [inStockOnly, offersOnly, params.categoryId, params.shopId, sort],
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

  /**
   * Re-runs a search and records it, then refreshes the recent chips.
   *
   * Recording waits for the result count because that is the number stored, and
   * it is fire-and-forget afterwards: a shopper should not be able to tell that
   * history bookkeeping happened, and a signed-out shopper has nowhere to record
   * to. Either way the search itself has already been issued.
   */
  const submitAndRemember = (term: string) => {
    submit(term);

    const trimmed = term.trim();
    if (!trimmed) return;

    void fetchDiscoveryProducts({
      query: trimmed,
      shopId: params.shopId,
      categoryId: params.categoryId,
    })
      .then((found) => recordSearch(trimmed, found.length))
      .then(refreshRecent)
      .catch(() => undefined);
  };

  const handleAddToCart = async (product: DiscoveredProduct) => {
    setAddingId(product.id);
    setAddError("");

    const { added, reason } = await addItem(toCartProduct(product));

    if (!added && reason) {
      // A failure is reported by the banner above, so the toast stays hidden
      // rather than claiming the item was added.
      setAddError(reason);
    } else {
      showToast(`${product.name} added to cart`);
    }

    setAddingId(null);
  };

  /** How the result set is described, accounting for any deep-linked filter. */
  const scopeLabel = params.categoryName
    ? params.categoryName
    : params.shopName || params.shopId
      ? "This shop"
      : null;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          onChangeText={setQuery}
          onSubmitEditing={() => submitAndRemember(query)}
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

      {scopeLabel ? (
        <View style={styles.scope}>
          <FontAwesome color="#07856A" name="filter" size={11} />
          <Text numberOfLines={1} style={styles.scopeText}>
            Showing {scopeLabel}
          </Text>
        </View>
      ) : null}

      {/* Only before the first search of this visit: once there is a query on
          screen the results are the answer, and the chips would just push them
          down. */}
      {!submitted ? (
        <RecentSearches
          entries={recent}
          onClear={() => {
            setRecent([]);
            void clearSearchHistory().catch(() => undefined);
          }}
          onPick={submitAndRemember}
        />
      ) : null}

      {/* Category chips used to sit here. They duplicated the "Browse categories"
          rail on the home screen and pushed a separate screen per tap, so they are
          gone; categoryId still filters this list when a category screen links here
          with its search icon. Categories remain reachable from home. */}
      <FlatList
        contentContainerStyle={styles.chipRow}
        data={SORTS}
        horizontal
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
        showsHorizontalScrollIndicator={false}
      />

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setOffersOnly((value) => !value)} style={styles.stockToggle}>
          <View style={[styles.checkbox, offersOnly && styles.checkboxOn]}>
            {offersOnly ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <FontAwesome
            color={offersOnly ? colors.coral : colors.muted}
            name="tag"
            size={11}
            style={styles.toggleIcon}
          />
          <Text style={[styles.stockLabel, offersOnly && styles.stockLabelOn]}>
            Offers only
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setInStockOnly((value) => !value)}
          style={styles.stockToggle}
        >
          <View style={[styles.checkbox, inStockOnly && styles.checkboxOn]}>
            {inStockOnly ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.stockLabel}>In stock only</Text>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {addError ? <ErrorBanner message={addError} /> : null}
      {!addError && !error && cartError ? <ErrorBanner message={cartError} /> : null}

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
          {offersOnly
            ? "Nothing is on offer with these filters. Turn off Offers only to see the full range."
            : "Try a different keyword or clear your filters."}
        </Text>
      </View>
    );
  };

  return (
    // scroll={false} because the FlatList below is this screen's scroller. Inside
    // AuthFrame's default ScrollView it would be a vertical list inside another
    // vertical scroller with no bounded height, so it collapsed to zero rows and
    // the screen showed the header with no products under it.
    <AuthFrame scroll={false}>
      <AuthHeader title="Search" />
      <FlatList
        // Handed an element rather than a function reference: a component-type
        // header whose identity changes every render remounts the subtree and
        // the TextInput loses focus after one character.
        ListEmptyComponent={renderEmpty()}
        ListHeaderComponent={renderHeader()}
        columnWrapperStyle={results.length > 0 ? styles.columnWrapper : undefined}
        contentContainerStyle={styles.listContent}
        data={results}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <View style={{ width: itemWidth }}>
            <BrowseProductCard
              addDisabled={adding}
              addingId={addingId}
              onAdd={handleAddToCart}
              product={item}
            />
          </View>
        )}
      />

      <AddToCartToast
        message={toast.message}
        productCount={cart.length}
        visible={toast.visible}
      />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  headerContainer: { paddingBottom: 10 },
  searchWrap: {
    alignItems: "center",
    backgroundColor: "#F0F1FC",
    borderRadius: 24,
    flexDirection: "row",
    marginBottom: 14,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  searchIcon: { color: colors.muted, fontSize: 18, marginRight: 8 },
  search: { color: colors.ink, flex: 1, fontSize: 14, paddingVertical: 12 },
  clear: {
    alignItems: "center",
    backgroundColor: colors.line,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    marginLeft: 8,
    width: 24,
  },
  clearText: { color: colors.muted, fontSize: 14, fontWeight: "bold" },
  scope: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 10,
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scopeText: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: "800" },
  chipRow: { gap: 8, paddingBottom: 12, paddingRight: 22 },
  chip: {
    backgroundColor: "#E9EAF9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: "row", gap: 18, marginBottom: 14 },
  stockToggle: { alignItems: "center", flexDirection: "row" },
  toggleIcon: { marginRight: 5 },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    marginRight: 8,
    width: 20,
  },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: "900" },
  stockLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  stockLabelOn: { color: colors.coral },
  recentBlock: { marginBottom: 12 },
  recentHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  recentTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  recentClear: { color: colors.coral, fontSize: 11, fontWeight: "800" },
  recentRow: { gap: 7, paddingRight: 22 },
  recentChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recentChipPressed: { opacity: 0.7 },
  recentChipText: { color: colors.ink, fontSize: 11, fontWeight: "700" },

  // Floats above the tab bar: bottom 90 clears the bar plus its own padding, and
  // the horizontal inset keeps it off the screen edge on wide layouts.
  toast: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderRadius: 16,
    bottom: 90,
    flexDirection: "row",
    gap: 10,
    left: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "absolute",
    right: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  toastIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  toastText: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800" },
  toastCount: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 10,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  toastCountText: { color: colors.ink, fontSize: 11, fontWeight: "900" },

  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  resultCount: { color: colors.muted, fontSize: 12 },
  listContent: { paddingBottom: 100 },
  columnWrapper: { gap: 12, marginBottom: 16 },
  emptyContainer: { alignItems: "center", paddingTop: 40 },
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
});