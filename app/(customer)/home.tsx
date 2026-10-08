import { BrowseProductCard, toCartProduct } from "@/components/BrowseProductCard";
import { canShowAlert } from "@/components/ShopSwitchModal";
import { colors } from "@/constants/colors";
import { useCart } from "@/hooks/useCart";
import {
  listBrowseCategories,
  listNearbyShops,
  listOffers,
} from "@/services/discoveryService";
import { getHomeContext } from "@/services/homeService";
import type {
  BrowseCategory,
  DiscoveredProduct,
  NearbyShop,
} from "@/types/discovery";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Home() {
  const {
    addItem,
    adding,
    loading: cartLoading,
    error: cartError,
    shop,
  } = useCart();

  const [firstName, setFirstName] = useState("Dilshan");
  const [pickupHub, setPickupHub] = useState("Malabe Bazaar Hub");
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [offers, setOffers] = useState<DiscoveredProduct[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [browseError, setBrowseError] = useState("");
  const [offersOnly, setOffersOnly] = useState(false);

  /**
   * The rails load together but independently.
   *
   * AllSettled rather than Promise.all so one failing query -- categories need a
   * migration applied, say -- hides its own section instead of blanking the whole
   * home screen. The remaining rails are still worth showing.
   */
  const loadRails = useCallback(() => {
    Promise.allSettled([listBrowseCategories(), listNearbyShops()])
      .then(([categoriesResult, shopsResult]) => {
        if (categoriesResult.status === "fulfilled") {
          setCategories(categoriesResult.value);
        }
        if (shopsResult.status === "fulfilled") {
          setShops(shopsResult.value);
        }

        const failure = [categoriesResult, shopsResult].find(
          (result) => result.status === "rejected",
        );

        setBrowseError(
          failure?.status === "rejected" && failure.reason instanceof Error
            ? failure.reason.message
            : "",
        );
      })
      .catch(() => {
        // allSettled never rejects, so this is unreachable in practice. Kept so a
        // future change to the query list cannot leave an unhandled rejection.
        setBrowseError("We could not load what is near you right now.");
      });
  }, []);

  useEffect(() => {
    void loadRails();

    getHomeContext()
      .then((context) => {
        if (!context) return;
        setFirstName(context.firstName);
        setPickupHub(context.pickupHub);
      })
      .catch(() => undefined);
  }, [loadRails]);

  /**
   * Offers is the one rail that reacts to a tap, so it loads separately from the
   * rest and only refetches when the filter actually changes. The unfiltered pass
   * runs once on mount so the section is populated before anyone taps.
   */
  useEffect(() => {
    let active = true;

    listOffers(offersOnly ? 20 : 6)
      .then((products) => {
        if (active) setOffers(products);
      })
      .catch(() => {
        // A failed offers query just leaves the section empty; the rest of the
        // home screen is unaffected and the user can still search.
        if (active) setOffers([]);
      });

    return () => {
      active = false;
    };
  }, [offersOnly]);

  const handleAdd = async (product: DiscoveredProduct) => {
    setAddingId(product.id);
    setAddError("");

    try {
      const { added, reason } = await addItem(toCartProduct(product));

      if (!added && reason) {
        // addItem raises its own Alert on native. On web Alert.alert is a no-op,
        // so this message is what the shopper actually sees there.
        setAddError(reason);
        if (canShowAlert()) {
          Alert.alert("Could not add", reason);
        }
      }
    } finally {
      setAddingId(null);
    }
  };

  const openShop = (target: NearbyShop) =>
    router.push({
      pathname: "/(customer)/shop-products",
      params: { shopId: target.id, shopName: target.name },
    });

  const openCategory = (category: BrowseCategory) =>
    router.push({
      pathname: "/(customer)/category-products",
      params: { categoryId: category.id, categoryName: category.name },
    });

  const shownOffers = offers.slice(0, 6);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.kicker}>
              GOOD MORNING, {firstName.toUpperCase()}
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

        <Pressable
          accessibilityLabel="Search products and shops"
          onPress={() => router.push("/(customer)/search")}
          style={styles.searchBox}
        >
          <FontAwesome color={colors.muted} name="search" size={15} />
          <Text style={styles.searchPlaceholder}>
            Search groceries, shops or brands
          </Text>
          <View style={styles.filterButton}>
            <FontAwesome color={colors.white} name="sliders" size={13} />
          </View>
        </Pressable>

        <View style={styles.quickRow}>
          <QuickAction
            icon="bolt"
            label="Express pickup"
            onPress={() => router.push("/(customer)/search")}
            tint={colors.mintSoft}
          />
          <QuickAction
            icon="repeat"
            label="Buy again"
            onPress={() => router.push("/(customer)/my-orders")}
            tint="#FFF0D5"
          />
          <QuickAction
            icon="map-marker"
            label="Nearby shops"
            onPress={() => router.push("/(customer)/nearby-shops")}
            tint="#E8ECFF"
          />
        </View>

        <Pressable
          accessibilityLabel="Shop this week's fresh picks"
          onPress={() => router.push("/(customer)/search")}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroContent}>
            <View style={styles.heroColumn}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>THIS WEEK</Text>
              </View>
              <Text style={styles.heroTitle}>
                Fresh picks,{"\n"}better prices.
              </Text>
              <Text style={styles.heroNote}>
                Fresh produce from shops near {pickupHub}.
              </Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Explore deals</Text>
                <FontAwesome color={colors.ink} name="arrow-right" size={12} />
              </View>
            </View>

            {/* The source is 1:1, so a square frame shows the whole hamper
                instead of slicing its top and bottom off. Kept beside the copy
                rather than full-bleed behind it for the same reason. */}
            <Image
              accessibilityLabel="A grocery hamper ready for pickup"
              contentFit="cover"
              source="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGClgGmPf_quyvhv6vvHCTOFWL3pH7wypTqXKD1NcWXg&s=10"
              style={styles.heroShot}
              transition={250}
            />
          </View>
        </Pressable>

        {/* Categories come from product_categories, with the count of live
            listings behind each one. Nothing here is hard-coded, so a category a
            shop fills up shows up on its own. */}
        <SectionHeader
          title="Browse categories"
          action="See all"
          onPress={() => router.push("/(customer)/search")}
        />

        {categories.length ? (
          <ScrollView
            contentContainerStyle={styles.categoryRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((category) => (
              <Pressable
                accessibilityLabel={`Browse ${category.name}`}
                accessibilityRole="button"
                key={category.id}
                onPress={() => openCategory(category)}
                style={styles.category}
              >
                <View
                  style={[styles.categoryIcon, { backgroundColor: category.tint }]}
                >
                  <FontAwesome
                    color={colors.ink}
                    name={categoryIcon(category.icon)}
                    size={17}
                  />
                </View>
                <Text numberOfLines={2} style={styles.categoryLabel}>
                  {category.name}
                </Text>
                <Text style={styles.categoryCount}>
                  {category.productCount} item{category.productCount === 1 ? "" : "s"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.railEmpty}>
            Categories will appear here once shops list products.
          </Text>
        )}

        {/* Offers, filtered live from customer_products.discount_*. The chip
            toggles between the biggest cuts and everything on offer. */}
        <SectionHeader
          title="Offers near you"
          action={offersOnly ? "All products" : "See all"}
          onPress={() =>
            offersOnly
              ? setOffersOnly(false)
              : router.push({ pathname: "/(customer)/search", params: { offers: "1" } })
          }
        />

        <Pressable
          accessibilityLabel={
            offersOnly ? "Show only the biggest discounts" : "Show all offers"
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: offersOnly }}
          onPress={() => setOffersOnly((value) => !value)}
          style={[styles.offersToggle, offersOnly && styles.offersToggleOn]}
        >
          <FontAwesome
            color={offersOnly ? colors.white : colors.coral}
            name="tag"
            size={11}
          />
          <Text style={[styles.offersToggleText, offersOnly && styles.offersToggleTextOn]}>
            {offersOnly ? "Showing every discount" : "Biggest discounts first"}
          </Text>
        </Pressable>

        {shownOffers.length ? (
          <ScrollView
            contentContainerStyle={styles.productRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {shownOffers.map((product) => (
              <BrowseProductCard
                addDisabled={cartLoading || adding}
                addingId={addingId}
                key={product.id}
                mode="rail"
                onAdd={handleAdd}
                product={product}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.railEmpty}>
            No discounts are running right now. Check back soon.
          </Text>
        )}

        <SectionHeader
          title="Popular near you"
          action="All shops"
          onPress={() => router.push("/(customer)/nearby-shops")}
        />

        {shops.length ? (
          <View style={styles.shopList}>
            {shops.slice(0, 4).map((item) => {
              const isCartShop = item.id === shop?.id;

              return (
                <Pressable
                  accessibilityLabel={`Browse ${item.name}`}
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => openShop(item)}
                  style={({ pressed }) => [
                    styles.shopCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.shopIcon}>
                    <FontAwesome
                      color={colors.ink}
                      name="shopping-basket"
                      size={18}
                    />
                  </View>

                  <View style={styles.shopCopy}>
                    <View style={styles.shopTitleRow}>
                      <Text numberOfLines={1} style={styles.shopName}>
                        {item.name}
                      </Text>
                      <View
                        style={[
                          styles.pill,
                          item.is_open ? styles.pillOpen : styles.pillShut,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            !item.is_open && styles.pillTextShut,
                          ]}
                        >
                          {item.is_open ? "Open now" : "Closed"}
                        </Text>
                      </View>
                    </View>

                    <Text numberOfLines={1} style={styles.shopMeta}>
                      {item.productCount} item{item.productCount === 1 ? "" : "s"} · Ready in{" "}
                      {item.preparation_minutes} min · {item.pickup_counter}
                    </Text>

                    {isCartShop ? (
                      <Text style={styles.shopDelivery}>Your current cart shop</Text>
                    ) : item.offerCount > 0 ? (
                      <Text style={styles.shopOffers}>
                        {item.offerCount} offer{item.offerCount === 1 ? "" : "s"} on
                      </Text>
                    ) : (
                      <Text style={styles.shopDelivery}>
                        Pickup from {item.pickup_counter}
                      </Text>
                    )}
                  </View>

                  <FontAwesome color={colors.muted} name="chevron-right" size={12} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.railEmpty}>
            No shops are open for pickup yet. Check again shortly.
          </Text>
        )}

        {addError ? <Text style={styles.cartError}>{addError}</Text> : null}
        {!addError && cartError ? <Text style={styles.cartError}>{cartError}</Text> : null}
        {browseError ? <Text style={styles.cartError}>{browseError}</Text> : null}
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
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
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

/**
 * Maps a product_categories.icon onto a FontAwesome name.
 *
 * The seeded rows all say "basket", which would render six identical circles, so
 * the category name is used to pick something distinguishable. Unknown names fall
 * back to the basket rather than crashing on an icon that may not exist.
 */
function categoryIcon(icon: string): React.ComponentProps<typeof FontAwesome>["name"] {
  const known: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
    basket: "shopping-basket",
    leaf: "leaf",
    glass: "glass",
    heart: "heart",
    cutlery: "cutlery",
    car: "car",
    bolt: "bolt",
    coffee: "coffee",
    snowflake: "snowflake-o",
  };

  return known[icon] ?? "shopping-basket";
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  greetingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  greetingCopy: { flex: 1, minWidth: 0 },
  kicker: {
    color: "#07856A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
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
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 50,
    marginTop: 18,
    paddingLeft: 15,
  },
  searchPlaceholder: {
    color: "#9693A6",
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 10,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    marginRight: 7,
    width: 34,
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
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 6,
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    marginTop: 20,
    minHeight: 200,
    overflow: "hidden",
  },
  /* A soft mint wash stands in for a gradient, which keeps the card from
     reading as a flat black block without pulling in another dependency. */
  heroGlow: {
    backgroundColor: colors.mint,
    borderRadius: 95,
    height: 190,
    left: -60,
    opacity: 0.13,
    position: "absolute",
    top: -55,
    width: 190,
  },
  heroContent: {
    alignItems: "center",
    flexDirection: "row",
    padding: 18,
  },
  heroColumn: { flex: 1, minWidth: 0 },
  heroShot: {
    aspectRatio: 1,
    borderRadius: 16,
    marginLeft: 14,
    width: 148,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.mint,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 11,
  },
  heroNote: { color: "#E9E8F6", fontSize: 9.5, lineHeight: 13, marginTop: 7 },
  heroCta: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
    width: 106,
  },
  heroCtaText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  sectionAction: { color: "#07856A", fontSize: 10, fontWeight: "900" },
  categoryRow: { gap: 12, paddingTop: 14 },
  category: { alignItems: "center", width: 70 },
  categoryIcon: {
    alignItems: "center",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  categoryLabel: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
    marginTop: 7,
    textAlign: "center",
  },
  categoryCount: { color: colors.muted, fontSize: 8, marginTop: 3 },
  railEmpty: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 13,
    paddingHorizontal: 2,
  },
  offersToggle: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFF0ED",
    borderRadius: 14,
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  offersToggleOn: { backgroundColor: colors.ink },
  offersToggleText: { color: colors.coral, fontSize: 10, fontWeight: "900" },
  offersToggleTextOn: { color: colors.white },
  productRow: { gap: 12, paddingTop: 13 },
  shopList: { gap: 11, marginTop: 13 },
  shopCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    padding: 13,
  },
  pressed: { opacity: 0.75 },
  shopIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  shopCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  shopTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  shopName: { color: colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "900" },
  pill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  pillOpen: { backgroundColor: colors.mintSoft },
  pillShut: { backgroundColor: colors.lilac },
  pillText: { color: "#07856A", fontSize: 8, fontWeight: "900" },
  pillTextShut: { color: colors.muted },
  shopMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  shopDelivery: { color: "#07856A", fontSize: 9, fontWeight: "800", marginTop: 5 },
  shopOffers: { color: colors.coral, fontSize: 9, fontWeight: "800", marginTop: 5 },
  cartError: { color: "#A43A32", fontSize: 12, marginTop: 10 },
  bottomSpace: { height: 105 },
});