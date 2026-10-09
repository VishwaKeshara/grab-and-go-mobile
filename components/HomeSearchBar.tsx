import { colors } from "@/constants/colors";
import type { BrowseCategory, DiscoveredProduct } from "@/types/discovery";
import { formatCurrencyShort } from "@/utils/formatters";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";

/**
 * The home search box and its live suggestion dropdown.
 *
 * Search happens on this screen rather than by navigating away, which is what the
 * box always implied: it was styled as an input, showed a caret-width placeholder
 * and was marked editable={false} purely to force a tap through to the Search
 * screen. Tapping it now focuses the field instead.
 *
 * Every suggestion is a real customer_products row or a real category. There is no
 * local list behind this, so nothing can appear here that the Search screen would
 * not also return.
 */

export type SearchSuggestion = {
  kind: "product" | "category";
  key: string;
  product?: DiscoveredProduct;
  category?: BrowseCategory;
};

export function HomeSearchBar({
  value,
  onChangeText,
  loading,
  products,
  categories,
  empty,
  error,
  /** Opens a product's detail page. */
  onPickProduct,
  /** Opens a category's product list. */
  onPickCategory,
  /** Runs the full search on the Search screen. */
  onSubmit,
  }: {
  value: string;
  onChangeText: (next: string) => void;
  loading: boolean;
  products: DiscoveredProduct[];
  categories: BrowseCategory[];
  empty: boolean;
  error: string;
  onPickProduct: (product: DiscoveredProduct) => void;
  onPickCategory: (category: BrowseCategory) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // The highlighted row. -1 means "none", which is also what Enter falls back to
  // when the shopper has not arrowed down.
  const [highlighted, setHighlighted] = useState(-1);

  const term = value.trim();

  // Products first, then categories: a shopper typing "mango" almost always wants
  // the thing, not the shelf it sits on.
  const suggestions: SearchSuggestion[] = [
    ...products.map((product) => ({
      kind: "product" as const,
      key: `p:${product.id}`,
      product,
    })),
    ...categories.map((category) => ({
      kind: "category" as const,
      key: `c:${category.name}`,
      category,
    })),
  ];

  // Clamped on read rather than corrected in an effect: a result list that
  // shrank must not leave the highlight pointing past the end, which is what
  // makes Enter open the wrong thing.
  const activeIndex = Math.min(highlighted, suggestions.length - 1);

  // Open only when there is a term and something to show, or something to say
  // about there being nothing. An empty box with a dropdown over it would cover
  // the rest of the home screen for no reason.
  const open = focused && term.length > 0;

  // Typing starts the list again from the top, because row 3 of the results for
  // "man" has no relationship to row 3 of the results for "mango".
  const handleChange = (next: string) => {
    setHighlighted(-1);
    onChangeText(next);
  };

  const close = () => {
    setFocused(false);
    setHighlighted(-1);
  };

  const pick = (suggestion: SearchSuggestion) => {
    if (suggestion.product) onPickProduct(suggestion.product);
    else if (suggestion.category) onPickCategory(suggestion.category);
  };

  const move = (delta: number) => {
    if (!suggestions.length) return;
    // Wraps, so holding ArrowDown cycles rather than sticking at the last item.
    setHighlighted(
      (current) => (current + delta + suggestions.length) % suggestions.length,
    );
  };

  /**
   * Arrow keys and Escape on web.
   *
   * React Native's TextInput has no onKeyPress on native, and on a phone the
   * platform keyboard provides arrows and a return key of its own, so this is
   * deliberately a no-op there rather than dead code pretending to work.
   */
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== "web") return;

    switch (event.nativeEvent.key) {
      case "ArrowDown":
        event.preventDefault?.();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault?.();
        move(-1);
        break;
      case "Enter":
        event.preventDefault?.();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          pick(suggestions[activeIndex]);
        } else {
          onSubmit();
        }
        break;
      case "Escape":
        event.preventDefault?.();
        close();
        break;
      default:
        break;
    }
  };

  const showSpinner = loading && term.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <FontAwesome
          color={focused ? colors.ink : colors.muted}
          name="search"
          size={15}
        />
        <TextInput
          accessibilityLabel="Search products and shops"
          autoCorrect={false}
          autoCapitalize="none"
          onBlur={close}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onKeyPress={onKeyPress}
          onSubmitEditing={() => {
            if (activeIndex >= 0 && suggestions[activeIndex]) {
              pick(suggestions[activeIndex]);
            } else {
              onSubmit();
            }
          }}
          placeholder="Search groceries, shops or brands"
          placeholderTextColor={colors.muted}
          ref={inputRef}
          returnKeyType="search"
          style={styles.input}
          value={value}
        />

        {showSpinner ? <ActivityIndicator color={colors.ink} size="small" /> : null}

        {!showSpinner && value.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => {
              handleChange("");
              inputRef.current?.focus();
            }}
          >
            <FontAwesome color={colors.muted} name="times-circle" size={15} />
          </Pressable>
        ) : null}

        {/* Filters live on the Search screen, which is where the sort and stock
            controls already are. Kept as a separate target so tapping it does not
            first have to dismiss the dropdown. */}
        <Pressable
          accessibilityLabel="Open filters and full search"
          onPress={onSubmit}
          style={styles.filterButton}
        >
          <FontAwesome color={colors.white} name="sliders" size={13} />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.dropdown}>
          {error ? (
            <View style={styles.stateBox}>
              <FontAwesome color={colors.coral} name="exclamation-circle" size={15} />
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : loading && !suggestions.length ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.ink} size="small" />
              <Text style={styles.stateText}>Searching…</Text>
            </View>
          ) : empty ? (
            <View style={styles.stateBox}>
              <FontAwesome color={colors.muted} name="search" size={14} />
              <Text style={styles.stateText}>
                No matching results found for “{term}”
              </Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.list}
            >
              {suggestions.map((suggestion, index) => (
                <SuggestionRow
                  active={index === activeIndex}
                  key={suggestion.key}
                  onPress={() => pick(suggestion)}
                  suggestion={suggestion}
                  term={term}
                />
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.seeAll,
                  pressed && styles.seeAllPressed,
                ]}
              >
                <Text style={styles.seeAllText}>
                  See all results for “{term}”
                </Text>
                <FontAwesome color={colors.primaryDark} name="arrow-right" size={11} />
              </Pressable>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SuggestionRow({
  suggestion,
  active,
  onPress,
  term,
}: {
  suggestion: SearchSuggestion;
  active: boolean;
  onPress: () => void;
  term: string;
}) {
  if (suggestion.product) {
    const product = suggestion.product;

    return (
      <Pressable
        accessibilityLabel={`View ${product.name}`}
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.row, active && styles.rowActive]}
      >
        {product.image_url ? (
          <Image
            contentFit="cover"
            source={product.image_url}
            style={styles.thumb}
            transition={120}
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Text style={styles.thumbInitial}>
              {product.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            <Highlight text={product.name} term={term} />
          </Text>
          <Text numberOfLines={1} style={styles.rowMeta}>
            {product.shop_name}
            {product.unit ? ` · ${product.unit}` : ""}
          </Text>
        </View>

        <Text style={styles.rowPrice}>
          {formatCurrencyShort(product.price)}
        </Text>
      </Pressable>
    );
  }

  const category = suggestion.category!;

  return (
    <Pressable
      accessibilityLabel={`Browse ${category.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, active && styles.rowActive]}
    >
      <View style={[styles.thumbFallback, { backgroundColor: category.tint }]}>
        <FontAwesome color={colors.ink} name="tags" size={13} />
      </View>

      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          <Highlight text={category.name} term={term} />
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          Category · {category.productCount} item
          {category.productCount === 1 ? "" : "s"}
        </Text>
      </View>

      <FontAwesome color={colors.muted} name="chevron-right" size={11} />
    </Pressable>
  );
}

/**
 * Bolds the matched run inside a label.
 *
 * Split rather than a regex replace so the matched text is rendered as its own
 * Text: nesting one <Text> in another is what makes it bold on both platforms,
 * whereas a <Text> inside a <Text> with a style array is unreliable on web.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());

  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <Text style={styles.match}>{text.slice(index, index + term.length)}</Text>
      {text.slice(index + term.length)}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20 },
  box: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    marginTop: 18,
    paddingLeft: 15,
    paddingRight: 7,
  },
  // The focus ring is what makes the box read as an input that took focus,
  // replacing the old behaviour where tapping it left the field behind.
  boxFocused: { borderColor: colors.ink, borderWidth: 2 },
  input: {fontWeight: "400", color: colors.ink, flex: 1, fontSize: 16, height: "100%" },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 6,
    marginTop: 6,
    maxHeight: 396,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  list: { maxHeight: 396 },
  stateBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  stateText: {fontWeight: "400", color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rowActive: { backgroundColor: "#F3F4F6" },
  thumb: {
    backgroundColor: "#F3F4F6",
    borderRadius: 9,
    height: 38,
    width: 38,
  },
  thumbFallback: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 9,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  thumbInitial: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "500" },
  rowMeta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 2 },
  rowPrice: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  match: { color: "#15803D", fontWeight: "900" },
  seeAll: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  seeAllPressed: { backgroundColor: "#F3F4F6" },
  seeAllText: { color: "#15803D", fontSize: 12, fontWeight: "700" },
});