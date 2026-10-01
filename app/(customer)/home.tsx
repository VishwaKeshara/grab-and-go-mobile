import { colors } from "@/constants/colors";
import { getHomeContext } from "@/services/homeService";
import { FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type IconName = ComponentProps<typeof FontAwesome>["name"];
type Category = { icon: IconName; label: string; tint: string };
type Product = {
  id: string;
  name: string;
  shop: string;
  price: string;
  unit: string;
  image: string;
  tag: string;
  tagColor: string;
};

const categories: Category[] = [
  { icon: "leaf", label: "Fresh produce", tint: colors.mintSoft },
  { icon: "cutlery", label: "Rice & grains", tint: "#FFF0D5" },
  { icon: "tint", label: "Dairy & chilled", tint: "#E8ECFF" },
  { icon: "heart", label: "Spices & pantry", tint: "#FFE6E0" },
  { icon: "shopping-basket", label: "Bakery & bites", tint: "#ECE8FF" },
  { icon: "glass", label: "Beverages", tint: "#DFF7F1" },
];

const products: Product[] = [
  {
    id: "bananas",
    name: "Kolikuttu Bananas",
    shop: "Kandy Fresh Market",
    price: "LKR 280",
    unit: "per 500g",
    image:
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
    tag: "Fresh today",
    tagColor: colors.mintSoft,
  },
  {
    id: "coconut",
    name: "King Coconut",
    shop: "Highland Superstore",
    price: "LKR 180",
    unit: "each",
    image:
      "https://images.unsplash.com/photo-1581453883351-9a4e9a7b8f6b?w=400&q=80",
    tag: "Best seller",
    tagColor: "#FFF0D5",
  },
  {
    id: "bread",
    name: "Country Grain Loaf",
    shop: "Pastry Lane",
    price: "LKR 420",
    unit: "400g",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
    tag: "Baked fresh",
    tagColor: "#FFE6E0",
  },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("Dilshan");
  const [pickupHub, setPickupHub] = useState("Malabe Bazaar Hub");

  useEffect(() => {
    getHomeContext()
      .then((context) => {
        if (!context) return;
        setFirstName(context.firstName);
        setPickupHub(context.pickupHub);
      })
      .catch(() => undefined);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View>
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
          <TextInput
            editable={false}
            onChangeText={setSearch}
            placeholder="Search groceries, shops or brands"
            placeholderTextColor="#9693A6"
            style={styles.searchInput}
            value={search}
          />
          <View style={styles.filterButton}>
            <FontAwesome color={colors.white} name="sliders" size={13} />
          </View>
        </Pressable>

        <View style={styles.quickRow}>
          <QuickAction
            icon="bolt"
            label="Express pickup"
            tint={colors.mintSoft}
          />
          <QuickAction icon="repeat" label="Buy again" tint="#FFF0D5" />
          <QuickAction icon="map-marker" label="Nearby shops" tint="#E8ECFF" />
        </View>

        <Pressable
          accessibilityLabel="Shop this week's fresh picks"
          onPress={() => router.push("/(customer)/search")}
          style={styles.hero}
        >
          <Image
            accessibilityLabel="Fresh produce at a market"
            contentFit="cover"
            source="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1000&q=85"
            style={styles.heroImage}
            transition={250}
          />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>THIS WEEK</Text>
            </View>
            <Text style={styles.heroTitle}>
              Fresh picks,{"\n"}better prices.
            </Text>
            <Text style={styles.heroCopy}>
              Hand-picked produce from shops near {pickupHub}.
            </Text>
            <View style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Explore deals</Text>
              <FontAwesome color={colors.ink} name="arrow-right" size={12} />
            </View>
          </View>
        </Pressable>

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
          {categories.map((category) => (
            <Pressable
              key={category.label}
              onPress={() => router.push("/(customer)/search")}
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
          action="View map"
          onPress={() => router.push("/(customer)/search")}
        />
        <View style={styles.shopCard}>
          <View style={styles.shopIcon}>
            <FontAwesome color={colors.ink} name="shopping-basket" size={18} />
          </View>
          <View style={styles.shopCopy}>
            <View style={styles.shopTitleRow}>
              <Text style={styles.shopName}>Pasar Groceries</Text>
              <Text style={styles.open}>Open now</Text>
            </View>
            <Text style={styles.shopMeta}>0.8 km · Fresh produce & pantry</Text>
            <Text style={styles.shopDelivery}>Free pickup from 4:30 PM</Text>
          </View>
          <FontAwesome color={colors.muted} name="chevron-right" size={12} />
        </View>

        <SectionHeader
          title="Picked for your basket"
          action="See all"
          onPress={() => router.push("/(customer)/search")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productRow}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ScrollView>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  tint,
}: {
  icon: IconName;
  label: string;
  tint: string;
}) {
  return (
    <Pressable
      onPress={() => router.push("/(customer)/search")}
      style={styles.quickAction}
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

function ProductCard({ product }: { product: Product }) {
  return (
    <Pressable
      onPress={() => router.push("/(customer)/product-details")}
      style={styles.productCard}
    >
      <View style={styles.productImageWrap}>
        <Image
          contentFit="cover"
          source={product.image}
          style={styles.productImage}
          transition={200}
        />
        <View
          style={[styles.productTag, { backgroundColor: product.tagColor }]}
        >
          <Text style={styles.productTagText}>{product.tag}</Text>
        </View>
        <View style={styles.addButton}>
          <FontAwesome color={colors.white} name="plus" size={12} />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.productName}>
        {product.name}
      </Text>
      <Text numberOfLines={1} style={styles.productShop}>
        {product.shop}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.productPrice}>{product.price}</Text>
        <Text style={styles.productUnit}>{product.unit}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  greetingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
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
  searchInput: {
    color: colors.ink,
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
  hero: { borderRadius: 22, height: 188, marginTop: 20, overflow: "hidden" },
  heroImage: { height: "100%", position: "absolute", width: "100%" },
  heroShade: {
    backgroundColor: "rgba(19, 18, 61, 0.62)",
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  heroContent: { padding: 20 },
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
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 27,
    marginTop: 12,
  },
  heroCopy: { color: "#E9E8F6", fontSize: 10, marginTop: 7, maxWidth: 180 },
  heroCta: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 13,
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 112,
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
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
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
  shopName: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  open: {
    backgroundColor: colors.mintSoft,
    borderRadius: 5,
    color: "#07856A",
    fontSize: 8,
    fontWeight: "900",
    marginLeft: 7,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  shopMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  shopDelivery: {
    color: "#07856A",
    fontSize: 9,
    fontWeight: "800",
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
  productImage: { height: "100%", width: "100%" },
  productTag: {
    borderRadius: 5,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 6,
  },
  productTagText: { color: colors.ink, fontSize: 7, fontWeight: "900" },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.white,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 6,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    width: 28,
  },
  productName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 9,
  },
  productShop: { color: colors.muted, fontSize: 9, marginTop: 3 },
  priceRow: { alignItems: "baseline", flexDirection: "row", marginTop: 7 },
  productPrice: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  productUnit: { color: colors.muted, fontSize: 8, marginLeft: 4 },
  bottomSpace: { height: 105 },
});
