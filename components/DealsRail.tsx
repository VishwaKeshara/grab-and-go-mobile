import { BrowseProductCard } from "@/components/BrowseProductCard";
import { colors } from "@/constants/colors";
import { listOffers } from "@/services/discoveryService";
import type { DiscoveredProduct } from "@/types/discovery";
import { FontAwesome } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * "Deals on now" -- the offers rail the home hero's Explore button targets.
 *
 * Every card here comes from discoveryService.listOffers, which filters on
 * hasDiscount and ranks by how deep the cut is. A product with no promotion
 * cannot appear: the filter is the same one the Search screen's Offers toggle
 * uses, so the two can never disagree about what counts as a deal.
 *
 * Sold-out listings are excluded as well, because a discount on something nobody
 * can buy is not a deal.
 */

const RAIL_LIMIT = 10;

/**
 * Read once on mount.
 *
 * Lifted out of the component so the fetch is not re-declared on every render,
 * and so the effect below has exactly one dependency and runs once.
 */
async function loadDealRail() {
  return listOffers(RAIL_LIMIT);
}

export function DealsRail({
  onAdd,
  onSeeAll,
  addDisabled,
  addingId,
  onAddingChange,
}: {
  onAdd: (product: DiscoveredProduct) => void | Promise<void>;
  onSeeAll: () => void;
  addDisabled: boolean;
  addingId: string | null;
  onAddingChange: (id: string | null) => void;
}) {
  const [deals, setDeals] = useState<DiscoveredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // `loading` starts true and the request only ever resolves it, so the effect
  // body has no synchronous setState -- one there would cascade a render before
  // the request is even issued.
  useEffect(() => {
    let active = true;

    loadDealRail()
      .then((found) => {
        if (active) setDeals(found);
      })
      .catch(() => {
        if (active) {
          setDeals([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAdd = async (product: DiscoveredProduct) => {
    onAddingChange(product.id);
    try {
      await onAdd(product);
    } finally {
      onAddingChange(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} size="small" />
        <Text style={styles.loadingText}>Loading today&apos;s deals…</Text>
      </View>
    );
  }

  if (!deals.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <FontAwesome color={colors.ink} name="tag" size={20} />
        </View>
        <Text style={styles.emptyTitle}>
          {failed ? "Deals are unavailable right now" : "No deals running today"}
        </Text>
        <Text style={styles.emptyCopy}>
          {failed
            ? "We could not load today's offers. Check your connection and try again."
            : "Nothing is discounted at the moment. Browse the full range and check back soon."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSeeAll}
          style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
        >
          <Text style={styles.emptyCtaText}>Browse all products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {deals.map((product) => (
        <BrowseProductCard
          addDisabled={addDisabled}
          addingId={addingId}
          key={product.id}
          mode="rail"
          onAdd={handleAdd}
          product={product}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingTop: 13 },
  loading: { alignItems: "center", flexDirection: "row", gap: 9, paddingTop: 18 },
  loadingText: {fontWeight: "400", color: colors.muted, fontSize: 12 },
  empty: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 13,
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.mintSoft,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 13,
  },
  emptyCopy: {fontWeight: "400", color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 280,
    textAlign: "center",
  },
  emptyCta: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    marginTop: 15,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  emptyCtaPressed: { opacity: 0.85 },
  emptyCtaText: { color: colors.white, fontSize: 12, fontWeight: "700" },
});