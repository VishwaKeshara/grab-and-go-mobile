import { supabase } from "@/lib/supabase";

/**
 * Cross-shop price comparison for the Product Details screen.
 *
 * customer_products has no shared catalogue identity between shops -- there is
 * no product_group or catalogue_id column, and the free-text category is null for
 * every row currently in the database. The only signal linking the same item across shops
 * is the product name, so that is what this module matches on.
 *
 * Two tiers are returned and kept strictly separate, so the UI never implies
 * two different products are the same one:
 *   • sameName - normalised name equality. Definitive.
 *   • similar   - meaningful word overlap. A suggestion, not a match.
 */

/** One shop's offer for a product. */
export type ShopOffer = {
    /** customer_products.id, so the card can link through to that listing. */
    productId: string;
    shopId: string;
    shopName: string;
    /** Short code shown in the header, e.g. "1E68A4C8". */
    shopCode: string | null;
    address: string;
    pickupCounter: string;
    isOpen: boolean;
    preparationMinutes: number;
    /** The listing's own product name, kept so tiers can be split reliably. */
    productName: string;
    unit: string;
    priceLkr: number;
    regularPriceLkr: number;
    available: boolean;
    stockQuantity: number;
    /** True for the shop the product was opened from. */
    isCurrent: boolean;
};

const OFFER_COLUMNS = `
  id, shop_id, name, unit, price_lkr, regular_price_lkr, available, stock_quantity,
  customer_shops!inner(id, name, address, pickup_counter, is_open, shop_code, preparation_minutes)
`;

/** Similarity below this is not worth showing as a related product. */
const SIMILARITY_FLOOR = 0.5;

function one(value: unknown): Record<string, unknown> | null {
    if (Array.isArray(value)) {
        return (value[0] as Record<string, unknown> | undefined) ?? null;
    }
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return null;
}

/** Lowercase, strip punctuation, collapse whitespace. */
function normalise(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Words too generic to imply two products are related. */
const STOP_WORDS = new Set([
    "fresh", "pack", "packed", "packet", "box", "bag", "bottle", "can",
    "the", "and", "with", "for", "per", "size", "unit",
]);

/** Comparison-relevant words of four characters or more. */
function tokens(name: string): string[] {
    return Array.from(new Set(normalise(name).split(" "))).filter(
        (word) => word.length >= 4 && !STOP_WORDS.has(word),
    );
}

/**
 * How strongly two names describe the same thing, from 0 to 1.
 *
 * This is containment (shared words divided by the shorter name), not Jaccard.
 * The brand word is precisely what differs between two listings of the same
 * product -- "Kothmale Fresh Milk" and "chello fresh milk" share only "milk" --
 * so scoring against the union would reject genuine matches while weighting by
 * word length would penalise them further.
 */
export function similarity(a: string, b: string): number {
    const left = tokens(a);
    const right = tokens(b);
    if (left.length === 0 || right.length === 0) return 0;

    const rightSet = new Set(right);
    const shared = left.filter((word) => rightSet.has(word));
    if (shared.length === 0) return 0;

    return shared.length / Math.min(left.length, right.length);
}

function toOffer(
    row: Record<string, unknown>,
    currentShopId: string,
): ShopOffer | null {
    const shop = one(row.customer_shops);
    if (!shop) return null;

    return {
        productId: row.id as string,
        shopId: row.shop_id as string,
        shopName: (shop.name as string) ?? "Unknown shop",
        shopCode: (shop.shop_code as string | null) ?? null,
        address: (shop.address as string) ?? "",
        pickupCounter: (shop.pickup_counter as string) ?? "",
        isOpen: shop.is_open !== false,
        preparationMinutes: Number(shop.preparation_minutes ?? 25),
        productName: (row.name as string) ?? "",
        unit: (row.unit as string) ?? "",
        priceLkr: Number(row.price_lkr ?? 0),
        regularPriceLkr: Number(row.regular_price_lkr ?? 0),
        available: row.available !== false,
        stockQuantity: Number(row.stock_quantity ?? 0),
        isCurrent: row.shop_id === currentShopId,
    };
}

export type ComparisonResult = {
    /** Other shops listing a product with exactly the same name. */
    sameName: ShopOffer[];
    /** Other shops listing a related product. Different brand, not the same SKU. */
    similar: ShopOffer[];
    /** Cheapest comparable offer across both tiers, or null when nothing matches. */
    best: ShopOffer | null;
    /** Spread between the cheapest and dearest comparable offer, including this shop. */
    spreadLkr: number;
};

const byPrice = (a: ShopOffer, b: ShopOffer) => a.priceLkr - b.priceLkr;

/**
 * Related products sort strongest match against the product being viewed first,
 * then cheapest. Needs the target name, so it is built per comparison.
 */
const relevanceTo =
    (target: string) =>
    (a: ShopOffer, b: ShopOffer): number => {
        const diff = similarity(b.productName, target) - similarity(a.productName, target);
        return diff !== 0 ? diff : a.priceLkr - b.priceLkr;
    };

/**
 * Compares a product against every other active listing that shares its name or
 * closely resembles it, cheapest first within each tier.
 */
export async function compareAcrossShops(
    productName: string,
    currentShopId: string,
    currentPriceLkr: number,
): Promise<ComparisonResult> {
    // Availability is deliberately not filtered here. A shop that lists the
    // item but is sold out is still a real price the customer should see, and
    // each offer card shows its own stock state. Filtering it out silently
    // removed shops from the comparison without saying so.
    const { data, error } = await supabase
        .from("customer_products")
        .select(OFFER_COLUMNS)
        .eq("active", true)
        .eq("customer_shops.active", true);

    if (error) throw error;

    const target = normalise(productName);
    const sameName: ShopOffer[] = [];
    const similar: ShopOffer[] = [];

    for (const row of (data as unknown as Record<string, unknown>[]) ?? []) {
        const offer = toOffer(row, currentShopId);
        if (!offer) continue;

        if (normalise(offer.productName) === target) {
            sameName.push(offer);
        } else if (similarity(productName, offer.productName) >= SIMILARITY_FLOOR) {
            similar.push(offer);
        }
    }

    sameName.sort(byPrice);
    similar.sort(relevanceTo(productName));

    const others = [...sameName, ...similar];

    // "Best deal" prefers something actually purchasable. Only when every
    // comparable listing is sold out does it fall back to the lowest price,
    // which is then shown as unavailable on the card.
    const buyable = others.filter(
        (offer) => offer.stockQuantity > 0 && offer.available,
    );
    const best =
        buyable.length > 0
            ? buyable.reduce((lowest, offer) =>
                  offer.priceLkr < lowest.priceLkr ? offer : lowest,
              )
            : others.length > 0
              ? others[0]
              : null;

    // Spread compares prices the customer could actually pay.
    const spreadPool =
        buyable.length > 0
            ? buyable.map((offer) => offer.priceLkr)
            : [...others.map((offer) => offer.priceLkr), currentPriceLkr];
    const spreadLkr =
        spreadPool.length > 1
            ? Math.max(...spreadPool) - Math.min(...spreadPool)
            : 0;

    return { sameName, similar, best, spreadLkr };
}
