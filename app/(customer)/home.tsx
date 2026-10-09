import { colors } from "@/constants/colors";
import { DealsRail } from "@/components/DealsRail";
import { HeroCarousel, type HeroSlide } from "@/components/HeroCarousel";
import { HomeSearchBar } from "@/components/HomeSearchBar";
import { useCart } from "@/hooks/useCart";
import { useHomeSearch } from "@/hooks/useHomeSearch";
import { homeFeaturedProducts, HOME_SHOP_NAME } from "@/services/cartService";
import type { GroceryProduct } from "@/types/cart";
import { getHomeContext } from "@/services/homeService";
import { listBrowseCategories } from "@/services/discoveryService";
import type { BrowseCategory, DiscoveredProduct } from "@/types/discovery";
import { categoryIcon, categoryTint, SUGGESTED_CATEGORIES } from "@/utils/categories";
import { toCartProduct } from "@/components/BrowseProductCard";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

type IconName = ComponentProps<typeof FontAwesome>["name"];
type Category = { icon: IconName; label: string; tint: string };
type Product = Pick<GroceryProduct, "name" | "unit" | "price" | "image"> & {
  catalogProduct: GroceryProduct | null;
  shop: string;
  tag: string;
  tagColor: string;
};

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

/**
 * Shown until the categories arrive, and kept if the query fails.
 *
 * The same SUGGESTED_CATEGORIES the shop's Add Product form offers, so the rail
 * is never an empty grey strip while the request is in flight -- and so a shopper
 * browses the categories a shop can actually file a product under, rather than
 * waiting for one shop to happen to have typed a label.
 */
const PLACEHOLDER_CATEGORIES: Category[] = SUGGESTED_CATEGORIES.map((label) => ({
  icon: categoryIcon(label),
  label,
  tint: categoryTint(label),
}));

/**
 * Hero slides.
 *
 * The images are remote and fixed rather than read from the database, for two
 * reasons. They are brand art, not inventory, so there is no row they belong to;
 * and tying them to a listing would mean an empty hero whenever a shop archives
 * its stock, which is the one place a promotion cannot afford to be empty.
 *
 * Every slide's CTA goes to the same deals list -- these are different ways of
 * saying "there are discounts", not different destinations. The fifth is the
 * original produce shot so the set keeps the look the hero already had.
 */
/**
 * Built per render because the copy names the shopper's own pickup hub, which is
 * not known until getHomeContext resolves. useMemo would be wrong here: the hub is
 * a late-arriving value, and caching the slides on anything else would freeze the
 * generic copy in place.
 */
function heroSlides(pickupHub: string): HeroSlide[] {
  return [
  {
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1000&q=85",
    badge: "THIS WEEK",
    title: "Fresh picks,\nbetter prices.",
    // The one slide that names the hub, so the hero still personalises after the
    // original copy moved out of the JSX.
    copy: `Hand-picked produce from shops near ${pickupHub}.`,
    cta: "Explore deals",
  },
  {
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAgpTmavFvGTjd4znIlr5rqXO1Bd4HvdZ6lMZrVjws-Q&s=10",
    badge: "OFFER",
    title: "Save on\neveryday staples.",
    copy: "Rice, flour, oil and pantry basics at a discount.",
    cta: "Explore deals",
  },
  {
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGCc0SDjF7-PgEVbMtxhZja6-MGLd47yYrCL6R2BTU3A&s=10",
    badge: "DISCOUNT",
    title: "Dairy and\nchilled, marked down.",
    copy: "Milk, yoghurt and cheese while stocks last.",
    cta: "Explore deals",
  },
  {
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcqu5FYgrBIPw73OE0sHaQRmkGv_vMu8JLbJ-74T9ofw&s=10",
    badge: "THIS WEEKEND",
    title: "Weekend\nbargains.",
    copy: "Snacks and treats picked for the trip home.",
    cta: "Explore deals",
  },
  {
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHwRr_GIfdjWS89WbVLqRz9su2517PtnVhSdDL99CTjg&s=10",
    badge: "NEAR YOU",
    title: "Discounts from\nshops near you.",
    copy: `Collect from ${pickupHub} without the detour.`,
    cta: "Explore deals",
  },
  ];
}

export default function Home() {
  const { addItem, adding, loading: cartLoading, error: cartError, products: catalogProducts, shop } = useCart();
  const [homeAddError, setHomeAddError] = useState("");
  const preferred = homeFeaturedProducts
    .map(display => catalogProducts.find(value => value.name === display.name && value.shopId === shop?.id))
    .filter((value): value is GroceryProduct => Boolean(value));
  const featured = [...preferred, ...catalogProducts.filter(value => !preferred.some(item => item.id === value.id))]
    .slice(0, homeFeaturedProducts.length);
  const products: Product[] = featured.length ? featured.map((catalogProduct, index) => ({
    ...catalogProduct,
    image: catalogProduct.image || homeFeaturedProducts.find(value => value.name === catalogProduct.name)?.image || "",
    catalogProduct,
    shop: shop?.name ?? HOME_SHOP_NAME,
    tag: ["Fresh today", "Baked fresh", "Local favourite"][index],
    tagColor: [colors.mintSoft, "#FEE2E2", "#FEF3C2"][index],
  })) : homeFeaturedProducts.map((display, index) => ({
    ...display,
    catalogProduct: null,
    shop: HOME_SHOP_NAME,
    tag: ["Fresh today", "Baked fresh", "Local favourite"][index],
    tagColor: [colors.mintSoft, "#FEE2E2", "#FEF3C2"][index],
  }));
  const addFeaturedProduct = async (product: Product) => {
    if (__DEV__) console.log("[Home cart] add callback", { product: product.name, productId: product.catalogProduct?.id ?? null });
    if (!product.catalogProduct) {
      const message = shop
        ? `${product.name} is not available for ordering right now.`
        : cartError || "Ordering is unavailable right now. Please try again later.";
      setHomeAddError(message);
      Alert.alert("Product unavailable", message);
      return;
    }
    setHomeAddError("");
    if (!await addItem(product.catalogProduct)) {
      setHomeAddError("Could not add this product. Check your cart and try again.");
    }
  };
  const [firstName, setFirstName] = useState("Dilshan");
  const [pickupHub, setPickupHub] = useState("Malabe Bazaar Hub");
  const [timeGreeting, setTimeGreeting] = useState(() => getTimeGreeting());
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [dealsAddingId, setDealsAddingId] = useState<string | null>(null);

  /**
   * The live search dropdown.
   *
   * The rail's categories are handed in rather than refetched, so a suggestion
   * for a category and the tile for that category can never disagree.
   */
  const search = useHomeSearch(categories);

  const { width } = useWindowDimensions();
  // Desktop gets a wider measure; the phone layout is the default and unchanged.
  const wide = width >= 900;

  // Where "Explore deals" scrolls to. A ref rather than a query for the section,
  // so the tap always lands even if the offers rail is still loading and has not
  // measured itself yet.
  const dealsRef = useRef<View>(null);

  // The outer ScrollView, needed to scroll a measured child into view.
  const scrollRef = useRef<ScrollView>(null);

  const scrollToDeals = () => {
    // measureLayout is how a child of a ScrollView asks "where am I on screen"
    // without knowing the content offset, which is what a ref cannot tell you.
    // The callback fires with an absolute y, so it is converted to a scroll
    // position against the viewport height this render already measured.
    dealsRef.current?.measure?.((_x, _y, _w, _h) => {
      // 12px of breathing room above the section heading rather than flush
      // against the section above it.
      scrollRef.current?.scrollTo({
        y: Math.max(0, _y - 12),
        animated: true,
      });
      void _w;
      void _h;
    });
  };

  const openProduct = (product: DiscoveredProduct) =>
    router.push({
      pathname: "/(customer)/product-details",
      params: { id: product.id },
    });

  const openCategoryFromSearch = (entry: BrowseCategory) =>
    router.push({
      pathname: "/(customer)/category-products",
      params: { category: entry.name, categoryName: entry.name },
    });

  /**
   * The Search screen, for the cases where the dropdown is not enough: the "see
   * all" row, the filter button, and Enter with nothing highlighted. It keeps
   * whatever has been typed, so a shopper who refines on the full screen does not
   * lose the query.
   */
  const runFullSearch = () => {
    const term = search.query.trim();

    router.push({
      pathname: "/(customer)/search",
      params: term ? { query: term } : undefined,
    });
  };

  const addDiscovered = async (product: DiscoveredProduct) => {
    setHomeAddError("");

    const result = await addItem(toCartProduct(product));

    if (!result.added && result.reason) {
      setHomeAddError(result.reason);
    }
  };

  /**
   * The "Browse categories" rail, read from the distinct
   * customer_products.category values.
   *
   * It was a hard-coded list of six, which had two problems once the category
   * became free text: a shop's own "Vegetables" never appeared because the label
   * was "Fresh produce", and every tap went to Search rather than to that
   * category, so the rail was six decorative tiles. Now a tile is a category
   * something is actually filed under, and tapping it opens that category.
   *
   * A failure is swallowed rather than surfaced: the rail is one section of the
   * home screen, and an error banner about a section the shopper did not ask
   * for would be noise while the rest of the screen still works.
   */
  const loadCategories = useCallback(() => {
    listBrowseCategories()
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  /**
   * What the rail shows: the categories that actually have products, then the
   * default suggestions for anything not in use yet.
   *
   * Both halves, rather than one or the other. The database half is what makes the
   * rail trustworthy -- a tile is a shelf that has something on it -- but a rail
   * built only from that would be empty on a new catalogue and would hide every
   * category the shop could file a product under until it happened to type one.
   * The suggestions half is the same list the Add Product form offers, so what a
   * shopper browses here is what a shop can actually choose.
   *
   * Until the query resolves, the suggestions alone -- an empty grey strip while
   * loading would be worse than showing something the shopper recognises.
   */
  const railCategories: Category[] = (() => {
    const merged = categories.map((category) => ({
      icon: categoryIcon(category.name),
      label: category.name,
      tint: category.tint,
    }));

    // Compared on the lower-cased label, so a catalogue holding "vegetables"
    // does not also gain a "Vegetables" tile two positions later.
    const seen = new Set(categories.map((entry) => entry.name.toLowerCase()));

    const extra = SUGGESTED_CATEGORIES.filter(
      (label) => !seen.has(label.toLowerCase()),
    ).map((label) => ({
      icon: categoryIcon(label),
      label,
      tint: categoryTint(label),
    }));

    const all = [...merged, ...extra];

    return all.length ? all : PLACEHOLDER_CATEGORIES;
  })();

  useEffect(() => {
    const updateGreeting = () => setTimeGreeting(getTimeGreeting());
    const interval = setInterval(updateGreeting, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (__DEV__) console.log("[Home cart] add button state", {
      cartLoading, adding, catalogCount: catalogProducts.length,
      shopId: shop?.id ?? null, error: cartError || null,
    });
  }, [cartLoading, adding, catalogProducts.length, shop?.id, cartError]);

  useEffect(() => {
    getHomeContext()
      .then((context) => {
        if (!context) return;
        setFirstName(context.firstName);
        setPickupHub(context.pickupHub);
      })
      .catch(() => undefined);
  }, []);

  /**
   * Opens the products filed under one category.
   *
   * category-products, not search: search is a keyword screen, so arriving there
   * with a category filter set looked like a search result the shopper had not
   * asked for. This screen is scoped to the category and back-navigates to here.
   */
  const openCategory = (label: string) =>
    router.push({
      pathname: "/(customer)/category-products",
      params: { category: label, categoryName: label },
    });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.kicker}>
              {timeGreeting}, {firstName.toUpperCase()}
            </Text>
            <Text style={styles.title}>What are we getting today?</Text>
          </View>
          <Pressable
            accessibilityLabel="Open saved items"
            onPress={() => router.push("/(customer)/notifications")}
            style={styles.savedButton}
          >
            <FontAwesome color={colors.ink} name="bookmark-o" size={17} />
          </Pressable>
        </View>

        <HomeSearchBar
          categories={search.categories}
          empty={search.empty}
          error={search.error}
          loading={search.loading}
          onChangeText={search.setQuery}
          onPickCategory={openCategoryFromSearch}
          onPickProduct={openProduct}
          onSubmit={runFullSearch}
          products={search.products}
          value={search.query}
        />

        <View style={styles.quickRow}>
          <QuickAction
            icon="bolt"
            label="Express pickup"
            onPress={scrollToDeals}
            tint={colors.mintSoft}
          />
          <QuickAction
            icon="repeat"
            label="Buy again"
            onPress={() => router.push("/(customer)/my-orders")}
            tint="#FEF3C2"
          />
          <QuickAction
            icon="map-marker"
            label="Nearby shops"
            onPress={() => router.push("/(customer)/nearby-shops")}
            tint="#F3F4F6"
          />
        </View>

        <HeroCarousel
          onCtaPress={scrollToDeals}
          slides={heroSlides(pickupHub)}
        />

        {/* The section the hero's Explore button scrolls to. Placed directly under
            the carousel because that is where the tap starts, and it carries the
            real filtered offers -- the hero is the advert, this is the answer. */}
        <View ref={dealsRef}>
          <SectionHeader
            title="Deals on now"
            action="See all"
            onPress={runFullSearch}
          />
          <DealsRail
            addDisabled={cartLoading || adding}
            addingId={dealsAddingId}
            onAdd={addDiscovered}
            onAddingChange={setDealsAddingId}
            onSeeAll={runFullSearch}
          />
        </View>

        <SectionHeader
          title="Browse categories"
          action="See all"
          onPress={() => router.push("/(customer)/search")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {railCategories.map((category) => (
            <Pressable
              accessibilityLabel={`Browse ${category.label}`}
              key={category.label}
              onPress={() => openCategory(category.label)}
              style={styles.category}
            >
              <View
                style={[
                  styles.categoryIcon,
                  { backgroundColor: category.tint },
                ]}
              >
                <FontAwesome
                  color={colors.ink}
                  name={category.icon}
                  size={17}
                />
              </View>
              <Text numberOfLines={2} style={styles.categoryLabel}>
                {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader
          title="Popular near you"
          action="All shops"
          onPress={() => router.push("/(customer)/nearby-shops")}
        />
        <Pressable
          accessibilityLabel={`Browse ${HOME_SHOP_NAME}`}
          accessibilityRole="button"
          onPress={() => router.push("/(customer)/nearby-shops")}
          style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}
        >
          <View style={styles.shopIcon}>
            <FontAwesome color={colors.ink} name="shopping-basket" size={18} />
          </View>
          <View style={styles.shopCopy}>
            <View style={styles.shopTitleRow}>
              <Text style={styles.shopName}>{HOME_SHOP_NAME}</Text>
              <Text style={styles.open}>Open now</Text>
            </View>
            <Text style={styles.shopMeta}>0.8 km · Fresh produce & pantry</Text>
            <Text style={styles.shopDelivery}>Free pickup from 4:30 PM</Text>
          </View>
          <FontAwesome color={colors.muted} name="chevron-right" size={12} />
        </Pressable>

        <SectionHeader
          title="Picked for your basket"
          action="See all"
          onPress={runFullSearch}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productRow}
        >
          {products.map((product) => (
            <ProductCard key={product.name} product={product} onAdd={addFeaturedProduct} addingDisabled={cartLoading || adding} />
          ))}
        </ScrollView>
        {(cartError || homeAddError) ? <Text style={styles.cartError}>{cartError || homeAddError}</Text> : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: IconName;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: tint }]}>
        <FontAwesome color={colors.ink} name={icon} size={14} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text style={styles.sectionAction}>{action} ›</Text>
      </Pressable>
    </View>
  );
}

function ProductCard({ product, onAdd, addingDisabled }: { product: Product; onAdd: (product: Product) => void | Promise<void>; addingDisabled: boolean }) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productImageWrap}>
        <Pressable
          accessibilityLabel={`View ${product.name}`}
          accessibilityRole="button"
          onPress={() =>
            product.catalogProduct &&
            router.push({
              pathname: "/(customer)/product-details",
              params: { id: product.catalogProduct.id },
            })
          }
          style={styles.productImageTouch}
        >
          <Image contentFit="cover" source={product.image} style={styles.productImage} transition={200} />
        </Pressable>
        <View
          style={[styles.productTag, { backgroundColor: product.tagColor }]}
        >
          <Text style={styles.productTagText}>{product.tag}</Text>
        </View>
        <Pressable accessibilityLabel={`Add ${product.name} to cart`} accessibilityRole="button" accessibilityState={{ disabled: addingDisabled }} disabled={addingDisabled} onPress={() => {
          if (__DEV__) console.log("[Home ProductCard] + pressed", product.name);
          onAdd(product);
        }} style={[styles.addButton, addingDisabled && styles.addButtonDisabled]}>
          <FontAwesome color={colors.white} name="plus" size={12} />
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`View ${product.name}`}
        accessibilityRole="button"
        onPress={() =>
          product.catalogProduct &&
          router.push({
            pathname: "/(customer)/product-details",
            params: { id: product.catalogProduct.id },
          })
        }
      >
        <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.productShop}>
        {product.shop}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.productPrice}>LKR {product.price.toLocaleString("en-LK")}</Text>
        <Text style={styles.productUnit}>{product.unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  // Desktop: a wider measure with the content centred, so a 1920px window does
  // not stretch a product rail to a length nobody scans.
  contentWide: { alignSelf: "center", maxWidth: 1120, width: "100%" },
  greetingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.1,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 5,
    maxWidth: 280,
  },
  savedButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  quickAction: { alignItems: "center", flexDirection: "row", width: "32%" },
  quickIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  quickLabel: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  // One pressed state for every tappable row on the screen, so a tap reads the
  // same everywhere rather than each card inventing its own feedback.
  pressed: { opacity: 0.75 },
  
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "600" },
  sectionAction: { color: "#15803D", fontSize: 12, fontWeight: "700" },
  categoryRow: { gap: 12, paddingTop: 14 },
  category: { alignItems: "center", width: 68 },
  categoryIcon: {
    alignItems: "center",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  categoryLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 15,
    marginTop: 7,
    textAlign: "center",
  },
  
  shopCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 13,
    padding: 13,
  },
  shopIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  shopCopy: { flex: 1, marginLeft: 11 },
  shopTitleRow: { alignItems: "center", flexDirection: "row" },
  shopName: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  open: {
    backgroundColor: colors.mintSoft,
    borderRadius: 5,
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  shopMeta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 },
  shopDelivery: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
  },
  productRow: { gap: 12, paddingTop: 13 },
  productCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    width: 150,
  },
  productImageWrap: {
    borderRadius: 11,
    height: 112,
    overflow: "hidden",
    position: "relative",
  },
  productImageTouch: { height: "100%", width: "100%" },
  productImage: { height: "100%", width: "100%" },
  productTag: {
    borderRadius: 5,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 6,
  },
  productTagText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.white,
    borderRadius: 19,
    borderWidth: 2,
    bottom: 5,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 5,
    width: 38,
  },
  addButtonDisabled: { opacity: 0.45 },
  cartError: {fontWeight: "400", color: "#DC2626", fontSize: 13, marginTop: 10 },
  productName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500",
    marginTop: 9,
  },
  productShop: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
  priceRow: { alignItems: "baseline", flexDirection: "row", marginTop: 7 },
  productPrice: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  productUnit: {fontWeight: "400", color: colors.muted, fontSize: 12, marginLeft: 4 },
  bottomSpace: { height: 105 },
});
