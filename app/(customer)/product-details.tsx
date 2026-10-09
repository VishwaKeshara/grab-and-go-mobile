import { colors } from "@/constants/colors";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addFavourite,
  getProduct,
  listFavouriteIds,
  removeFavourite,
} from "@/services/productService";
import {
  compareAcrossShops,
  type ComparisonResult,
  type ShopOffer,
} from "@/services/productComparisonService";
import type { ProductWithShop } from "@/types/product";
import type { GroceryProduct } from "@/types/cart";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/utils/formatters";

/**
 * Product Details (Member 2).
 *
 * Shows one product plus what every other active shop charges for the same or
 * a related item. See productComparisonService for how listings are matched --
 * customer_products has no shared catalogue id, so matching is name based and
 * the two tiers are labelled separately.
 */

type UnitPrice = { amount: number; label: string };

/**
 * Price per base unit, e.g. 490 rupees for "200g" is LKR 2,450 / kg.
 * Grams are converted to kilograms and millilitres to litres so the figure is
 * comparable across products.
 */
function unitPriceOf(priceLkr: number, unit: string): UnitPrice | null {
    const match = /^(\d+(?:\.\d+)?)\s*(kg|kgs|g|grams?|l|ltr|litre|liter|litres|ml)?/i.exec(
        unit.trim(),
    );
    if (!match) return null;

    const amount = Number(match[1]);
    const kind = (match[2] ?? "").toLowerCase();

    if (!amount || amount <= 0) return null;

    if (kind.startsWith("g")) return { amount: priceLkr / (amount / 1000), label: "kg" };
    if (kind === "ml") return { amount: priceLkr / (amount / 1000), label: "L" };
    if (kind.startsWith("l")) return { amount: priceLkr / amount, label: "L" };
    if (kind.startsWith("k")) return { amount: priceLkr / amount, label: "kg" };

    return { amount: priceLkr / amount, label: "unit" };
}

export default function ProductDetails() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [product, setProduct] = useState<ProductWithShop | null>(null);
    const [comparison, setComparison] = useState<ComparisonResult | null>(null);
    const [isFavourite, setIsFavourite] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [needsSignIn, setNeedsSignIn] = useState(false);
    const [ordering, setOrdering] = useState(false);

    const { addItem, setQuantity: setCartQuantity } = useCart();

    const load = useCallback(() => {
        // Every state update happens inside a promise callback. Setting state
        // directly in this function would cascade a render when the effect below
        // calls it.
        const run = id
            ? getProduct(id).then((item: ProductWithShop) => {
                  setProduct(item);

                  // Comparison is secondary: if it fails the product still shows.
                  return compareAcrossShops(item.name, item.shop_id, item.price)
                      .then(setComparison)
                      .catch(() => setComparison(null));
              })
            : Promise.reject(new Error("No product was selected."));

        run.catch((loadError: unknown) => {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "We could not load this product.",
            );
        }).finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        listFavouriteIds()
            .then((ids) => setIsFavourite(ids.includes(id)))
            // Favourites need a signed-in user; ignoring the failure keeps the
            // page usable for guests.
            .catch(() => undefined);
    }, [id]);

    const toggleFavourite = async () => {
        if (!id) return;

        const next = !isFavourite;
        setIsFavourite(next);
        setNotice("");

        try {
            if (next) {
                await addFavourite(id);
            } else {
                await removeFavourite(id);
            }
        } catch (favError) {
            setIsFavourite(!next);
            setNotice(
                favError instanceof Error
                    ? favError.message
                    : "Sign in to save favourites.",
            );
        }
    };

    const unitPrice = useMemo(() => {
        if (!product) return null;
        return unitPriceOf(product.price, product.unit);
    }, [product]);

    /**
     * Adds the product to the cart then opens it.
     *
     * addItem reports `added: false` when it refuses -- an empty catalog because
     * the user is signed out, a checkout lock, or a declined shop switch -- and
     * shows its own alert in those cases. Only navigate once it reports success,
     * otherwise the cart would open empty.
     */
    const placePreOrder = async () => {
        if (!product || ordering) return;

        setOrdering(true);
        setNotice("");

        // The cart belongs to a user account, so a guest cannot start an order.
        // Checking here gives a clear reason instead of addItem's generic
        // refusal, which also fires an Alert on native.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
            setOrdering(false);
            setNeedsSignIn(true);
            setNotice("Sign in to place an order.");
            return;
        }

        const addable: GroceryProduct = {
            id: product.id,
            shopId: product.shop_id,
            name: product.name,
            unit: product.unit,
            price: product.price,
            regularPrice: product.regular_price ?? product.price,
            image: product.image_url ?? "",
        };

        try {
            const { added, reason } = await addItem(addable);
            if (!added) {
                // A declined shop switch reports no reason -- that was the
                // shopper's choice, so nothing is shown.
                setNotice(reason || "That item could not be added to your cart.");
                return;
            }

            // addItem always adds a single unit, so apply the stepper choice.
            if (quantity > 1) setCartQuantity(product.id, quantity);

            router.push("/(customer)/cart");
        } catch (orderError) {
            setNotice(
                orderError instanceof Error
                    ? orderError.message
                    : "We could not start that order.",
            );
        } finally {
            setOrdering(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centre}>
                <ActivityIndicator color={colors.ink} size="large" />
                <Text style={styles.muted}>Loading product...</Text>
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.centre}>
                <Text style={styles.emptyTitle}>Product unavailable</Text>
                <Text style={styles.muted}>{error}</Text>
                <Pressable onPress={() => router.back()} style={styles.backAction}>
                    <Text style={styles.backActionText}>Go back</Text>
                </Pressable>
            </View>
        );
    }

    const saving = (product.regular_price ?? product.price) > product.price;
    const savedLkr = saving ? (product.regular_price ?? product.price) - product.price : 0;
    const inStock = product.stock_quantity > 0 && product.is_available !== false;

    const sameNameOthers = (comparison?.sameName ?? []).filter((o) => !o.isCurrent);
    const similarOthers = (comparison?.similar ?? []).filter((o) => !o.isCurrent);
    const totalLkr = product.price * quantity;

    return (
        <View style={styles.screen}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <Pressable
                    accessibilityLabel="Go back"
                    onPress={() => router.back()}
                    style={styles.iconButton}
                >
                    <Text style={styles.headerIcon}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Product Details</Text>
                <Pressable
                    accessibilityLabel={isFavourite ? "Remove from favourites" : "Save to favourites"}
                    onPress={toggleFavourite}
                    style={styles.iconButton}
                >
                    <Text style={styles.headerIcon}>{isFavourite ? "♥" : "♡"}</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.hero}>
                    {product.image_url ? (
                        <Image
                            contentFit="contain"
                            source={{ uri: product.image_url }}
                            style={styles.heroImage}
                            transition={200}
                        />
                    ) : (
                        <View style={styles.heroPlaceholder}>
                            <Text style={styles.heroPlaceholderText}>
                                {product.name.slice(0, 1)}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.titleBlock}>
                    <Text style={styles.name}>{product.name}</Text>
                    <Text style={styles.subtitle}>
                        {product.unit ? `${product.unit} pack` : "Pack"}
                        {product.shop_name ? ` · ${product.shop_name}` : ""}
                    </Text>
                </View>

                <View style={styles.priceCard}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceMain}>{formatCurrency(product.price)}</Text>
                        {saving ? (
                            <View style={styles.saveBadge}>
                                <Text style={styles.saveBadgeText}>Save {formatCurrency(savedLkr)}</Text>
                            </View>
                        ) : null}
                    </View>

                    {saving ? (
                        <Text style={styles.wasPrice}>{formatCurrency((product.regular_price ?? product.price))}</Text>
                    ) : null}

                    {unitPrice ? (
                        <Text style={styles.unitPrice}>
                            Unit price: {formatCurrency(Math.round(unitPrice.amount))} /{" "}
                            {unitPrice.label}
                        </Text>
                    ) : null}

                    {notice ? (
                        <View style={styles.noticeRow}>
                            <Text style={styles.notice}>{notice}</Text>
                            {needsSignIn ? (
                                <Pressable
                                    onPress={() => router.replace("/(auth)/login")}
                                    style={styles.signInButton}
                                >
                                    <Text style={styles.signInText}>Sign in</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}
                </View>

                <View style={styles.stockCard}>
                    <View style={styles.stockHead}>
                        <Text style={styles.stockBadge}>
                            {inStock ? "IN STOCK" : "OUT OF STOCK"}
                        </Text>
                        {inStock ? (
                            <Text style={styles.stockCount}>
                                {product.stock_quantity} left
                            </Text>
                        ) : null}
                    </View>
                    <Text style={styles.stockLine}>
                        Counter: {product.shop_name}
                        {product.unit ? ` · ${product.unit}` : ""}
                    </Text>
                    <Text style={styles.stockFoot}>
                        {inStock
                            ? "Pickup from this shop"
                            : "Hidden from customer search until restocked"}
                    </Text>
                </View>

                {error ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <ComparisonSection
                    currentPriceLkr={product.price}
                    currentShopName={product.shop_name}
                    sameName={sameNameOthers}
                    similar={similarOthers}
                    spreadLkr={comparison?.spreadLkr ?? 0}
                />

                <View style={styles.guarantee}>
                    <Text style={styles.guaranteeTitle}>Smart Substitution Guarantee</Text>
                    <Text style={styles.guaranteeBody}>
                        If an item is unavailable, our team calls you first. Nothing is
                        substituted without your approval.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.bottomBar}>
                <View style={styles.stepper}>
                    <Pressable
                        accessibilityLabel="Decrease quantity"
                        disabled={quantity <= 1}
                        onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                        style={styles.stepButton}
                    >
                        <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{quantity}</Text>
                    <Pressable
                        accessibilityLabel="Increase quantity"
                        onPress={() => setQuantity((q) => q + 1)}
                        style={styles.stepButton}
                    >
                        <Text style={styles.stepText}>+</Text>
                    </Pressable>
                </View>

                <Pressable
                    disabled={ordering}
                    onPress={placePreOrder}
                    style={[styles.preOrder, ordering && styles.preOrderDisabled]}
                >
                    <Text style={styles.preOrderText}>
                        {ordering ? "Adding..." : "Pre-Order"}
                    </Text>
                    <Text style={styles.preOrderPrice}>{formatCurrency(totalLkr)}</Text>
                </Pressable>
            </View>
        </View>
    );
}

function ComparisonSection({
    currentPriceLkr,
    currentShopName,
    sameName,
    similar,
    spreadLkr,
}: {
    currentPriceLkr: number;
    currentShopName: string;
    sameName: ShopOffer[];
    similar: ShopOffer[];
    spreadLkr: number;
}) {
    const others = [...sameName, ...similar];

    return (
        <View style={styles.comparison}>
            <View style={styles.comparisonHead}>
                <Text style={styles.comparisonTitle}>
                    {others.length > 0
                        ? `Compare ${others.length} other ${others.length === 1 ? "shop" : "shops"}`
                        : "Price comparison"}
                </Text>
                {spreadLkr > 0 ? (
                    <Text style={styles.comparisonSpread}>
                        Spread {formatCurrency(spreadLkr)}
                    </Text>
                ) : null}
            </View>

            {others.length === 0 ? (
                <View style={styles.comparisonEmpty}>
                    <Text style={styles.comparisonEmptyText}>
                        No other active shop lists this product. {currentShopName} is the
                        only listing at {formatCurrency(currentPriceLkr)}.
                    </Text>
                </View>
            ) : (
                <View style={styles.offerGrid}>
                    {sameName.length > 0 ? (
                        <>
                            <Text style={styles.tierLabel}>Same product, other shops</Text>
                            {sameName.map((offer) => (
                                <OfferCard
                                    currentPriceLkr={currentPriceLkr}
                                    key={`${offer.shopId}-same`}
                                    offer={offer}
                                />
                            ))}
                        </>
                    ) : null}

                    {similar.length > 0 ? (
                        <>
                            <Text style={styles.tierLabel}>
                                Related products, other brands
                            </Text>
                            {similar.map((offer) => (
                                <OfferCard
                                    currentPriceLkr={currentPriceLkr}
                                    key={`${offer.shopId}-sim`}
                                    offer={offer}
                                />
                            ))}
                        </>
                    ) : null}
                </View>
            )}
        </View>
    );
}

function OfferCard({
    currentPriceLkr,
    offer,
}: {
    currentPriceLkr: number;
    offer: ShopOffer;
}) {
    const difference = offer.priceLkr - currentPriceLkr;
    const isCheaper = difference < 0;
    const isSame = difference === 0;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${offer.productName} at ${offer.shopName}`}
            onPress={() =>
                router.push({
                    pathname: "/(customer)/product-details",
                    params: { id: offer.productId },
                })
            }
            style={({ pressed }) => [styles.offerCard, pressed && styles.pressed]}
        >
            <View style={styles.offerHead}>
                <Text numberOfLines={1} style={styles.offerShop}>
                    {offer.shopName}
                </Text>
                <Text style={styles.offerChevron}>›</Text>
            </View>
            <Text numberOfLines={2} style={styles.offerProduct}>
                {offer.productName}
            </Text>
            <Text numberOfLines={1} style={styles.offerMeta}>
                {offer.pickupCounter || offer.address || "Pickup counter"}
                {offer.isOpen ? " · Open" : " · Closed"}
            </Text>
            <Text style={styles.offerPrice}>{formatCurrency(offer.priceLkr)}</Text>
            <Text style={styles.offerUnit}>{offer.unit}</Text>

            <Text
                style={[
                    styles.offerDelta,
                    {
                        color: isSame
                            ? colors.muted
                            : isCheaper
                              ? "#15803D"
                              : "#DC2626",
                    },
                ]}
            >
                {isSame
                    ? "Same price as here"
                    : `${isCheaper ? "-" : "+"} ${formatCurrency(Math.abs(difference))} vs here`}
            </Text>

            <Text
                style={[
                    styles.offerStock,
                    { color: offer.stockQuantity > 0 ? "#15803D" : "#DC2626" },
                ]}
            >
                {offer.stockQuantity > 0
                    ? `${offer.stockQuantity} in stock`
                    : "Out of stock"}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.paper, flex: 1 },
    centre: {
        alignItems: "center",
        backgroundColor: colors.paper,
        flex: 1,
        gap: 10,
        justifyContent: "center",
        padding: 24,
    },
    header: {
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    iconButton: { padding: 6 },
    headerIcon: {fontWeight: "400", color: colors.ink, fontSize: 20 },
    headerTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "600" },
    body: {
        gap: 14,
        paddingBottom: 30,
        paddingHorizontal: 18,
        // Caps the column on a wide browser window so the layout stays phone
        // shaped instead of stretching to the full desktop width.
        alignSelf: "center",
        maxWidth: 460,
        width: "100%",
    },
    pressed: { opacity: 0.7 },
    // Fixed height rather than aspectRatio: the catalogue mixes square and
    // non-square photos, and a set height keeps the block the same size on every
    // product instead of jumping around as images load. contentFit="contain"
    // means the whole photo is always visible, letterboxed rather than cropped.
    hero: {
        alignItems: "center",
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        height: 230,
        justifyContent: "center",
        overflow: "hidden",
    },
    heroImage: { height: "100%", width: "100%" },
    heroPlaceholder: {
        alignItems: "center",
        backgroundColor: colors.mintSoft,
        flex: 1,
        justifyContent: "center",
        width: "100%",
    },
    heroPlaceholderText: { color: colors.ink, fontSize: 52, fontWeight: "700" },
    titleBlock: { gap: 3 },
    name: { color: colors.ink, fontSize: 18, fontWeight: "700" },
    subtitle: {fontWeight: "400", color: colors.muted, fontSize: 14 },
    priceCard: {
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 12,
        borderWidth: 1,
        padding: 13,
    },
    priceRow: { alignItems: "center", flexDirection: "row", gap: 10 },
    priceMain: { color: colors.ink, fontSize: 24, fontWeight: "700" },
    saveBadge: {
        backgroundColor: "#DCFCE7",
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    saveBadgeText: { color: "#15803D", fontSize: 12, fontWeight: "600" },
    wasPrice: {fontWeight: "400", color: colors.muted,
        fontSize: 12,
        marginTop: 2,
        textDecorationLine: "line-through",
    },
    unitPrice: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 6 },
    notice: {fontWeight: "400", color: "#92400E", fontSize: 12, marginTop: 8 },
    noticeRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginTop: 8,
    },
    signInButton: {
        backgroundColor: colors.ink,
        borderRadius: 7,
        paddingHorizontal: 11,
        paddingVertical: 5,
    },
    signInText: { color: colors.white, fontSize: 12, fontWeight: "600" },
    stockCard: {
        backgroundColor: colors.night,
        borderRadius: 14,
        padding: 14,
    },
    stockHead: { alignItems: "center", flexDirection: "row", gap: 8 },
    stockBadge: {
        backgroundColor: colors.mint,
        borderRadius: 6,
        color: colors.night,
        fontSize: 12,
        fontWeight: "700",
        overflow: "hidden",
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    stockCount: { color: colors.white, fontSize: 12, fontWeight: "600" },
    stockLine: {fontWeight: "400", color: "#D1D5DB", fontSize: 12, marginTop: 8 },
    stockFoot: {fontWeight: "400", color: colors.mint, fontSize: 12, marginTop: 6 },
    errorBanner: {
        backgroundColor: "#FEE2E2",
        borderRadius: 10,
        padding: 11,
    },
    errorText: {fontWeight: "400", color: "#DC2626", fontSize: 13, lineHeight: 16 },
    comparison: {
        backgroundColor: colors.white,
        borderColor: colors.line,
        borderRadius: 14,
        borderWidth: 1,
        padding: 13,
    },
    comparisonHead: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    comparisonTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
    comparisonSpread: { color: "#15803D", fontSize: 12, fontWeight: "600" },
    comparisonEmpty: { marginTop: 10 },
    comparisonEmptyText: {fontWeight: "400", color: colors.muted, fontSize: 12, lineHeight: 17 },
    offerGrid: { gap: 9, marginTop: 12 },
    tierLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.4,
        marginTop: 4,
        textTransform: "uppercase",
    },
    offerCard: {
        backgroundColor: colors.paper,
        borderColor: colors.line,
        borderRadius: 10,
        borderWidth: 1,
        padding: 11,
    },
    offerShop: { color: colors.ink, fontSize: 12, fontWeight: "600" },
    offerHead: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    offerChevron: { color: colors.muted, fontSize: 16, fontWeight: "600" },
    offerProduct: {fontWeight: "400", color: colors.ink, fontSize: 12, marginTop: 3 },
    offerMeta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 2 },
    offerPrice: { color: colors.ink, fontSize: 16, fontWeight: "700", marginTop: 6 },
    offerUnit: {fontWeight: "400", color: colors.muted, fontSize: 12 },
    offerDelta: { fontSize: 12, fontWeight: "600", marginTop: 5 },
    offerStock: { fontSize: 12, fontWeight: "600", marginTop: 5 },
    guarantee: {
        backgroundColor: colors.mintSoft,
        borderRadius: 12,
        padding: 13,
    },
    guaranteeTitle: { color: "#15803D", fontSize: 12, fontWeight: "600" },
    guaranteeBody: {fontWeight: "400", color: "#15803D",
        fontSize: 12,
        lineHeight: 16,
        marginTop: 4,
    },
    bottomBar: {
        alignItems: "center",
        backgroundColor: colors.white,
        borderTopColor: colors.line,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
        paddingBottom: 26,
        paddingHorizontal: 18,
        paddingTop: 12,
    },
    stepper: {
        alignItems: "center",
        backgroundColor: colors.paper,
        borderRadius: 10,
        flexDirection: "row",
    },
    stepButton: {
        alignItems: "center",
        height: 34,
        justifyContent: "center",
        width: 34,
    },
    stepText: { color: colors.ink, fontSize: 17, fontWeight: "600" },
    stepValue: {
        color: colors.ink,
        fontSize: 13,
        fontWeight: "600",
        minWidth: 24,
        textAlign: "center",
    },
    preOrder: {
        alignItems: "center",
        backgroundColor: colors.ink,
        borderRadius: 11,
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        paddingVertical: 11,
    },
    preOrderText: { color: colors.white, fontSize: 13, fontWeight: "600" },
    preOrderPrice: { color: colors.mint, fontSize: 14, fontWeight: "700" },
    preOrderDisabled: { opacity: 0.6 },
    backAction: {
        backgroundColor: colors.ink,
        borderRadius: 9,
        marginTop: 10,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    backActionText: { color: colors.white, fontSize: 12, fontWeight: "600" },
    emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
    muted: {fontWeight: "400", color: colors.muted, fontSize: 12, textAlign: "center" },
});
