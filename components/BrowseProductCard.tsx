import { colors } from "@/constants/colors";
import type { GroceryProduct } from "@/types/cart";
import type { DiscoveredProduct } from "@/types/discovery";
import { discountSummary } from "@/utils/discounts";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { formatCurrencyShort } from "@/utils/formatters";

/**
 * The product card shared by Search, a shop's product page and the home rails.
 *
 * `mode` is layout only -- the same card has to work as a 2-up grid tile and as a
 * narrow row inside a horizontal rail.
 */
export type BrowseCardMode = "tile" | "rail";

type Props = {
  product: DiscoveredProduct;
  onAdd: (product: DiscoveredProduct) => void;
  mode?: BrowseCardMode;
  /** Currently being added, so only that card shows a spinner. */
  addingId?: string | null;
  /** True while the cart is loading or another add is in flight. */
  addDisabled?: boolean;
};

/** False for a listing nobody can actually buy right now. */
function isPurchasable(product: DiscoveredProduct): boolean {
  return product.stock_quantity > 0 && product.is_available;
}

export function BrowseProductCard({
  product,
  onAdd,
  mode = "tile",
  addingId,
  addDisabled,
}: Props) {
  const discount = discountSummary(product);
  const purchasable = isPurchasable(product);
  const adding = addingId === product.id;
  const blocked = !purchasable || Boolean(addDisabled) || adding;

  const openDetails = () =>
    router.push({
      pathname: "/(customer)/product-details",
      params: { id: product.id },
    });

  return (
    <View style={[styles.card, mode === "rail" && styles.cardRail]}>
      <Pressable
        accessibilityLabel={`View ${product.name}`}
        accessibilityRole="button"
        onPress={openDetails}
        style={[styles.imageWrap, mode === "rail" && styles.imageWrapRail]}
      >
        {product.image_url ? (
          <Image
            contentFit="cover"
            source={product.image_url}
            style={styles.image}
            transition={200}
          />
        ) : (
          <View style={styles.thumb}>
            <Text style={styles.thumbText}>{product.name.slice(0, 1)}</Text>
          </View>
        )}

        {discount.hasDiscount ? (
          <View style={styles.discountBadge}>
            <FontAwesome color={colors.white} name="tag" size={9} />
            <Text style={styles.discountBadgeText}>{discount.label}</Text>
          </View>
        ) : null}

        {!purchasable ? (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutBadgeText}>
              {product.stock_quantity <= 0 ? "Sold out" : "Unavailable"}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.body}>
        <Pressable
          accessibilityLabel={`View ${product.name}`}
          accessibilityRole="button"
          onPress={openDetails}
        >
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
        </Pressable>

        <Text numberOfLines={1} style={styles.shop}>
          {product.shop_name}
        </Text>

        <Text numberOfLines={1} style={styles.meta}>
          {product.category_name ? `${product.category_name} · ` : ""}
          {product.unit}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrencyShort(product.price)}</Text>
          {/* Only struck through when the regular price really is higher, so a
              product with no discount never shows a misleading "was". */}
          {discount.hasDiscount && discount.amountLkr > 0 ? (
            <Text style={styles.wasPrice}>
              {formatCurrencyShort(product.regular_price)}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel={
            purchasable ? `Add ${product.name} to cart` : `${product.name} is unavailable`
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={() => onAdd(product)}
          style={[styles.addButton, blocked && styles.addButtonDisabled]}
        >
          {adding ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <FontAwesome color={colors.white} name="plus" size={10} />
              <Text style={styles.addButtonText}>Add</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Adapts a discovered product to the shape the cart hook takes.
 *
 * `useCart.addItem` matches on id and only needs the display fields, so this is
 * an explicit mapping rather than a cast -- the two types are not interchangeable
 * and a cast here would hide a future mismatch.
 */
export function toCartProduct(product: DiscoveredProduct): GroceryProduct {
  return {
    id: product.id,
    shopId: product.shop_id,
    name: product.name,
    unit: product.unit,
    price: product.price,
    regularPrice: product.regular_price,
    image: product.image_url ?? "",
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden",
  },
  cardRail: { flex: 0, width: 152 },
  imageWrap: { backgroundColor: "#F4F4FB", height: 116 },
  imageWrapRail: { height: 104 },
  image: { height: "100%", width: "100%" },
  thumb: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  thumbText: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  discountBadge: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 6,
  },
  discountBadgeText: { color: colors.white, fontSize: 8, fontWeight: "900" },
  soldOutBadge: {
    backgroundColor: "rgba(23,21,67,0.82)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    right: 6,
    top: 6,
  },
  soldOutBadgeText: { color: colors.white, fontSize: 8, fontWeight: "900" },
  body: { flex: 1, padding: 10 },
  name: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    minHeight: 32,
  },
  shop: { color: "#07856A", fontSize: 9, fontWeight: "700", marginTop: 4 },
  meta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 5, marginTop: 7 },
  price: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  wasPrice: {
    color: colors.muted,
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 9,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 8,
  },
  addButtonDisabled: { backgroundColor: colors.muted },
  addButtonText: { color: colors.white, fontSize: 11, fontWeight: "900" },
});