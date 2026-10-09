import { colors } from "@/constants/colors";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { formatCurrencyShort } from "@/utils/formatters";
import {
  listCheapestElsewhere,
  listStockItems,
  saveStock,
} from "@/services/stockService";
import { getShopByProfileId } from "@/services/shopService";
import {
  stockStatusOf,
  type CheapestElsewhere,
  type StockFilter,
  type StockItem,
} from "@/types/stockUpdate";

/**
 * Stock Update (Member 2).
 *
 * Lists every active product in customer_products for the signed-in owner's shop
 * and lets the clerk change quantity and availability. Stock is written to
 * shop_inventory, which is the source of truth, and mirrored onto
 * customer_products in the same operation.
 *
 * Note: customer_products has no SKU column, so the reference shown on each card
 * is derived from the product UUID rather than a real SKU.
 */

type Shop = { id: string; name: string; shopCode: string | null };

const STATUS_STYLES = {
  in: { bg: colors.mintSoft, fg: "#0A7D5F", label: "In Stock" },
  low: { bg: "#FDF0DC", fg: "#9A6412", label: "Low Stock" },
  out: { bg: "#FDE4E0", fg: "#A33D2F", label: "Out Of Stock" },
} as const;

export default function StockUpdate() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [cheapest, setCheapest] = useState<Record<string, CheapestElsewhere>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>({ kind: "all" });
  const [savingId, setSavingId] = useState<string | null>(null);

  /**
   * Fetches the shop, its products and the cross-shop price comparison.
   *
   * Written as a promise chain rather than async/await so every setState sits
   * inside a callback. Calling setState in the effect body itself would
   * trigger a cascading render.
   */
  const fetchItems = useCallback(() => {
    supabase.auth
      .getUser()
      .then(({ data: userData }) => {
        const userId = userData.user?.id;
        if (!userId) throw new Error("Sign in to manage stock.");
        return getShopByProfileId(userId);
      })
      .then((found) => {
        if (!found) throw new Error("No shop is linked to this account yet.");
        setShop({
          id: found.id,
          name: found.name,
          shopCode: found.shopCode ?? null,
        });
        return Promise.all([
          listStockItems(found.id),
          listCheapestElsewhere(found.id),
        ]);
      })
      .then(([rows, elsewhere]) => {
        setItems(rows);
        setCheapest(elsewhere);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load your stock.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /** Optimistic write: update the row immediately, roll back if the save fails. */
  const persist = useCallback(
    async (
      item: StockItem,
      next: { quantity?: number; isAvailable?: boolean },
    ) => {
      setSavingId(item.id);
      setError("");
      setNotice("");

      const previous = items;
      const quantity = next.quantity ?? item.quantity;
      const isAvailable = next.isAvailable ?? item.isAvailable;

      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, quantity, isAvailable } : row,
        ),
      );

      try {
        await saveStock({
          shopId: item.shopId,
          productId: item.id,
          quantity,
          isAvailable,
        });
        setNotice(`Saved ${item.name}.`);
      } catch (saveError) {
        setItems(previous);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "That change could not be saved.",
        );
      } finally {
        setSavingId(null);
      }
    },
    [items],
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      low: items.filter((item) => stockStatusOf(item) === "low").length,
      out: items.filter((item) => stockStatusOf(item) === "out").length,
    }),
    [items],
  );

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      if (item.categoryName) names.add(item.categoryName);
    }
    return Array.from(names).sort();
  }, [items]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    return items.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term)) return false;

      if (filter.kind === "low") return stockStatusOf(item) === "low";
      if (filter.kind === "out") return stockStatusOf(item) === "out";
      if (filter.kind === "category") {
        return item.categoryName === filter.value;
      }
      return true;
    });
  }, [items, query, filter]);

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.ink} size="large" />
        <Text style={styles.muted}>Loading your catalogue...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Stock Update</Text>
        <Text style={styles.shopCode}>{shop?.shopCode ?? "C/2"}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          onChangeText={setQuery}
          placeholder={`Search ${items.length} catalogued SKUs...`}
          placeholderTextColor="#9A98AA"
          returnKeyType="search"
          style={styles.search}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} style={styles.clear}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Refresh stock"
            onPress={refresh}
            style={styles.filterButton}
          >
            <Text style={styles.filterIcon}>⚟</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Chip
          active={filter.kind === "all"}
          label={`All Items · ${counts.all}`}
          onPress={() => setFilter({ kind: "all" })}
          tone="neutral"
        />
        <Chip
          active={filter.kind === "low"}
          label={`Low Stock · <${5}`}
          onPress={() => setFilter({ kind: "low" })}
          tone="amber"
        />
        <Chip
          active={filter.kind === "out"}
          label={`Out of Stock · ${counts.out}`}
          onPress={() => setFilter({ kind: "out" })}
          tone="coral"
        />
        {categories.map((name) => (
          <Chip
            active={filter.kind === "category" && filter.value === name}
            key={name}
            label={name}
            onPress={() => setFilter({ kind: "category", value: name })}
            tone="neutral"
          />
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to show</Text>
            <Text style={styles.emptyText}>
              {items.length === 0
                ? "No active products are linked to this shop."
                : "Try a different search or filter."}
            </Text>
          </View>
        ) : (
          visible.map((item) => (
            <StockCard
              busy={savingId === item.id}
              cheapest={cheapest[item.name]}
              item={item}
              key={item.id}
              onChange={(next) => persist(item, next)}
            />
          ))
        )}

        <View style={styles.syncNote}>
          <Text style={styles.syncDot}>●</Text>
          <Text style={styles.syncText}>
            {notice
              ? notice
              : "Inventory changes are saved immediately and apply to customer search results."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  tone: "neutral" | "amber" | "coral";
}) {
  const toneColor = { neutral: colors.ink, amber: "#9A6412", coral: "#A33D2F" }[tone];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        !active && tone !== "neutral" && { backgroundColor: STATUS_STYLES[tone === "amber" ? "low" : "out"].bg },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        <Text style={!active ? { color: toneColor } : undefined}>{label}</Text>
      </Text>
    </Pressable>
  );
}

function StockCard({
  busy,
  cheapest,
  item,
  onChange,
}: {
  busy: boolean;
  cheapest?: CheapestElsewhere;
  item: StockItem;
  onChange: (next: { quantity?: number; isAvailable?: boolean }) => void;
}) {
  const status = stockStatusOf(item);
  const tone = STATUS_STYLES[status];

  // customer_products has no SKU column, so the reference is the tail of the
  // product UUID. Replace this with a real SKU once one is added.
  const reference = `REF #${item.id.slice(0, 8).toUpperCase()}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {item.imageUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: item.imageUrl }}
            style={styles.thumb}
            transition={150}
          />
        ) : (
          <View style={styles.thumb}>
            <Text style={styles.thumbText}>{item.name.slice(0, 1)}</Text>
          </View>
        )}

        <View style={styles.cardHead}>
          <Text style={styles.reference}>
            {reference} · {item.categoryName ?? "Uncategorised"}
            {item.unit ? ` · ${item.unit}` : ""}
          </Text>
          <Text numberOfLines={2} style={styles.cardName}>
            {item.name}
          </Text>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.fg }]}>
              {tone.label} ({item.quantity} {item.unit || "units"})
            </Text>
          </View>
        </View>

        <Switch
          disabled={busy}
          onValueChange={(next) => onChange({ isAvailable: next })}
          thumbColor={colors.white}
          trackColor={{ false: colors.line, true: "#2FB98C" }}
          value={item.isAvailable}
        />
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>
            LKR {item.priceLkr.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.stepper}>
          <Pressable
            accessibilityLabel={`Decrease ${item.name}`}
            disabled={busy || item.quantity <= 0}
            onPress={() => onChange({ quantity: item.quantity - 1 })}
            style={styles.stepButton}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{item.quantity}</Text>
          <Pressable
            accessibilityLabel={`Increase ${item.name}`}
            disabled={busy}
            onPress={() => onChange({ quantity: item.quantity + 1 })}
            style={styles.stepButton}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actionRow}>
        {status === "out" ? (
          <Pressable
            disabled={busy}
            onPress={() => onChange({ quantity: item.quantity + 10 })}
            style={styles.action}
          >
            <Text style={styles.actionText}>+ Restock ×10</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={busy}
            onPress={() => onChange({ isAvailable: false, quantity: 0 })}
            style={[styles.action, styles.actionSoft]}
          >
            <Text style={[styles.actionText, styles.actionTextSoft]}>
              Mark Sold Out
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.cardFoot}>
        <Text style={styles.footText}>
          {cheapest
            ? `Lowest elsewhere (${cheapest.shopName}) · ${formatCurrencyShort(cheapest.priceLkr)}`
            : "Lowest price at your shop"}
        </Text>
      </View>

      {!item.isAvailable ? (
        <Text style={styles.hiddenNote}>
          Hidden from customer search results until restocked
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  centre: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  back: { marginRight: 10 },
  backIcon: { color: colors.ink, fontSize: 22 },
  title: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: "800" },
  shopCode: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 18,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchIcon: { color: colors.muted, fontSize: 16, marginRight: 8 },
  search: { color: colors.ink, flex: 1, fontSize: 13, paddingVertical: 10 },
  clear: { paddingHorizontal: 4 },
  clearText: { color: colors.muted, fontSize: 18 },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: 7,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  filterIcon: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  chipRow: { gap: 7, paddingHorizontal: 18, paddingVertical: 12 },
  chip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  errorBanner: {
    backgroundColor: "#FFF0ED",
    borderRadius: 10,
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 11,
  },
  errorText: { color: "#A33D2F", fontSize: 11, lineHeight: 16 },
  list: { gap: 12, paddingBottom: 96, paddingHorizontal: 18, paddingTop: 4 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cardTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  thumb: {
    backgroundColor: colors.mintSoft,
    borderRadius: 8,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  thumbText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  cardHead: { flex: 1 },
  reference: { color: colors.muted, fontSize: 9, letterSpacing: 0.3 },
  cardName: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 9,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontWeight: "800" },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  priceBlock: { flex: 1 },
  priceLabel: { color: colors.muted, fontSize: 9 },
  priceValue: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  stepper: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: 9,
    flexDirection: "row",
  },
  stepButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  stepText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  stepValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "center",
  },
  actionRow: { alignItems: "flex-start", marginTop: 10 },
  action: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  actionSoft: { backgroundColor: "#E4F3FB" },
  actionText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  actionTextSoft: { color: "#0B5D7A" },
  cardFoot: { marginTop: 9 },
  footText: { color: colors.muted, fontSize: 9 },
  hiddenNote: { color: colors.muted, fontSize: 9, marginTop: 4 },
  syncNote: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 11,
  },
  syncDot: { color: "#2FB98C", fontSize: 8 },
  syncText: { color: colors.muted, flex: 1, fontSize: 9, lineHeight: 14 },
  empty: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 26,
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  muted: { color: colors.muted, fontSize: 12 },
});
