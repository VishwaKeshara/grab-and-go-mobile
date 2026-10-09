import { colors } from "@/constants/colors";
import { listNearbyShops } from "@/services/discoveryService";
import type { NearbyShop } from "@/types/discovery";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The list reached from the home screen's "Nearby shops" action.
 *
 * Every shop comes from customer_shops, sorted so the ones serving the
 * customer's preferred pickup hub lead. Tapping a shop opens its products, which
 * is the same screen and the same add-to-cart path as search results.
 */
export default function NearbyShops() {
  const insets = useSafeAreaInsets();
  // Only used to highlight the shop the cart currently belongs to, so a shopper
  // can see which shop switching will cost them a cleared cart.
  const { shopId: cartShopId } = useLocalSearchParams<{ shopId?: string }>();

  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // `loading` starts true and is only ever cleared here, so the effect below has
  // no synchronous setState to make it cascade a render. The search box filters
  // the loaded list, so nothing here needs to set loading back to true.
  const load = useCallback(() => {
    listNearbyShops()
      .then(setShops)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not load the shops near you.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const term = query.trim().toLowerCase();

  // Filtering locally because the whole list is already in memory -- a request
  // per keystroke to narrow ~10 rows would be slower and no fresher.
  const visible = term
    ? shops.filter((shop) =>
        [shop.name, shop.address, shop.pickup_counter]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
    : shops;

  const openShop = (shop: NearbyShop) =>
    router.push({
      pathname: "/(customer)/shop-products",
      params: { shopId: shop.id, shopName: shop.name },
    });

  const renderItem = ({ item }: { item: NearbyShop }) => {
    const isCartShop = item.id === cartShopId;

    return (
      // A View rather than a Pressable, because the offers chip below is its own
      // button and one button cannot be nested inside another. On web both become
      // <button> elements, which is invalid HTML and breaks keyboard and screen
      // reader handling. The row and the chip are siblings instead, so either can
      // be the tap target without either trapping the other's events.
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={`Browse ${item.name}`}
          accessibilityRole="button"
          onPress={() => openShop(item)}
          style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <FontAwesome color={colors.ink} name="shopping-basket" size={17} />
          </View>

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <View
                style={[styles.pill, item.is_open ? styles.pillOpen : styles.pillShut]}
              >
                <Text
                  style={[styles.pillText, !item.is_open && styles.pillTextShut]}
                >
                  {item.is_open ? "Open now" : "Closed"}
                </Text>
              </View>
            </View>

            {isCartShop ? (
              <Text style={styles.cartShop}>Your current cart shop</Text>
            ) : null}

            <Text numberOfLines={1} style={styles.meta}>
              {item.productCount} item{item.productCount === 1 ? "" : "s"} · Ready in{" "}
              {item.preparation_minutes} min · {item.pickup_counter}
            </Text>

            <Text numberOfLines={1} style={styles.address}>
              {item.address || "No address on file"}
            </Text>
          </View>

          <FontAwesome color={colors.muted} name="chevron-right" size={12} />
        </Pressable>

        {item.offerCount > 0 ? (
          <Pressable
            accessibilityLabel={`See ${item.offerCount} offers at ${item.name}`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/(customer)/search",
                params: { shopId: item.id, offers: "1" },
              })
            }
            style={({ pressed }) => [styles.offers, pressed && styles.pressed]}
          >
            <FontAwesome color={colors.coral} name="tag" size={9} />
            <Text style={styles.offersText}>
              {item.offerCount} offer{item.offerCount === 1 ? "" : "s"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

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
        <Text style={styles.heading}>Nearby shops</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.searchWrap}>
        <FontAwesome color={colors.muted} name="search" size={14} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search shops by name or area"
          placeholderTextColor={colors.muted}
          style={styles.search}
          value={query}
        />
        {query ? (
          <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery("")}>
            <FontAwesome color={colors.muted} name="times-circle" size={14} />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(shop) => shop.id}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.ink} size="large" />
              <Text style={styles.emptyText}>Finding shops near you…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <FontAwesome color={colors.muted} name="shopping-basket" size={30} />
              <Text style={styles.emptyTitle}>No shops to show</Text>
              <Text style={styles.emptyText}>
                {term
                  ? `Nothing matched “${query.trim()}”. Try a different name.`
                  : "No shops are open for pickup yet. Check again shortly."}
              </Text>
            </View>
          )
        }
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
  back: { height: 30, justifyContent: "center", width: 30 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 46,
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
  },
  search: { fontWeight: "400", color: colors.ink, flex: 1, fontSize: 16, paddingHorizontal: 9 },
  error: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
    marginHorizontal: 20,
    marginTop: 10,
    padding: 10,
  },
  list: { gap: 11, paddingBottom: 110, paddingHorizontal: 20, paddingTop: 15 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },
  // The tappable shop row. Separate from `card` so the offers chip can sit beside
  // it rather than inside it -- see the note on the View in renderItem.
  cardMain: { alignItems: "center", flexDirection: "row" },
  pressed: { opacity: 0.75 },
  icon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  copy: { flex: 1, marginLeft: 11, minWidth: 0 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  name: { color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "700" },
  pill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  pillOpen: { backgroundColor: colors.mintSoft },
  pillShut: { backgroundColor: colors.lilac },
  pillText: { color: "#15803D", fontSize: 12, fontWeight: "700" },
  pillTextShut: { color: colors.muted },
  cartShop: { color: colors.ink, fontSize: 12, fontWeight: "600", marginTop: 4 },
  meta: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 4 },
  address: {fontWeight: "400", color: colors.muted, fontSize: 12, marginTop: 3 },
  offers: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  offersText: { color: colors.coral, fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 56 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptyText: {fontWeight: "400", color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 260,
    textAlign: "center",
  },
});