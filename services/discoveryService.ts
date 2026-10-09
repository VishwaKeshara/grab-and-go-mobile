import { supabase } from "@/lib/supabase";
import type {
  BrowseCategory,
  DiscoveredProduct,
  NearbyShop,
} from "@/types/discovery";
import { categoryIcon, categoryTint } from "@/utils/categories";
import { hasDiscount } from "@/utils/discounts";

/**
 * Customer-facing browse queries: nearby shops, the category rail, discounted
 * offers, and the product lists behind all three.
 *
 * The shop/staff screens read a shop's own catalogue through productService; this
 * file is the read side for people who are not running a shop, so everything here
 * is filtered to active listings and active shops and nothing requires a session
 * beyond the RLS policies in migration 011.
 */

/**
 * Columns every shape shares.
 *
 * shop_inventory is joined, not inner-joined. See below on why the catalogue
 * shows sold-out listings.
 *
 * Do not "fix" an empty list here by tightening this join. An empty list after
 * the 023 backfill means shop_inventory is missing rows for existing listings,
 * which is a stock-data question. Check it with
 *
 *   select p.id, p.name, p.stock_quantity
 *     from public.customer_products p
 *    where not exists (select 1 from public.shop_inventory inv
 *                       where inv.shop_id = p.shop_id and inv.product_id = p.id);
 *
 * and run supabase/deploy/023_shop_inventory_backfill_sql_editor.sql.
 *
 * WHY SOLD-OUT LISTINGS ARE LISTED RATHER THAN HIDDEN
 *
 * This used to be `shop_inventory!inner(quantity, is_available)` filtered to
 * `is_available = true and quantity > 0`, which meant a listing with no stock
 * was not returned at all. The reasoning was that a product you can see must be
 * one you can add, because change_customer_cart refuses the rest -- and on web
 * that refusal was invisible, since react-native-web's Alert.alert is a no-op,
 * so the button silently did nothing.
 *
 * That reasoning is still right about the cart, but it was the wrong remedy. The
 * fix belongs where the button is drawn, not in which products exist:
 * BrowseProductCard already derives `purchasable` from stock and availability,
 * disables its own Add button when it is false, and already renders a
 * "Sold out" badge for exactly this case.
 *
 * So hiding them here only removed information the shopper wanted. Someone
 * searching for an item needs to see that the shop has it and that it is out of
 * stock -- that is the answer, and hiding it sends them to another shop for no
 * reason. See migration 023 for the data side.
 *
 * The join is still not optional: it is what makes the card's stock figure come
 * from shop_inventory rather than the denormalised copy on customer_products,
 * which is the one that goes stale.
 */
const BASE_COLUMNS = `
  id, shop_id, name, unit, price_lkr, regular_price_lkr, image_url,
  active, available, stock_quantity,
  shop_inventory(quantity, is_available)
`;

/**
 * Optional column groups, widest first.
 *
 * PostgREST rejects a WHOLE select when any named column is missing
 * (42703 undefined_column), so naming discount_percent on a database that has
 * not had migration 019 applied would return no products at all -- which is what
 * Shop Management hit before it learned to narrow its select. Discovery needs the
 * same ladder, so the shapes are enumerated and tried in order.
 *
 * `category` is optional because customer_products.category arrives with
 * migration 024. Without it the rail still renders, every product just reads
 * as uncategorised.
 */
const OPTIONAL_SHAPES: { category?: string; discounts?: string }[] = [
  {
    category: "category",
    discounts: "discount_percent, discount_type, discount_amount_lkr",
  },
  { category: "category", discounts: "discount_percent" },
  { category: "category" },
  { discounts: "discount_percent, discount_type, discount_amount_lkr" },
  { discounts: "discount_percent" },
  {},
];

/**
 * Which shape last worked, so the missing-column retry happens once per app run
 * rather than on every screen load. Only ever moves down; a fresh app start probes
 * again, which is when newly applied migrations get picked up.
 */
let shapeIndex = 0;

function shapeSelect(shape: (typeof OPTIONAL_SHAPES)[number]): string {
  return [BASE_COLUMNS, shape.category, shape.discounts].filter(Boolean).join(", ");
}

/**
 * Whether PostgREST refused a select because an optional column is not in the
 * database yet.
 *
 * 42703 is undefined_column and PGRST204 is the schema-cache form of it. Any other
 * code -- 42501 permission denied, PGRST202 missing relation -- is a different
 * problem and must surface its own message rather than being retried around and
 * then reported as something generic.
 */
function isMissingOptionalColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code !== "42703" && error.code !== "PGRST204") return false;

  const message = error.message ?? "";
  return ["discount_percent", "discount_type", "discount_amount_lkr", "category"].some(
    (column) => message.includes(column),
  );
}

/**
 * Maps one raw customer_products row onto DiscoveredProduct.
 *
 * The select string is built at runtime, so supabase-js cannot infer a row type
 * from it; every field is read off `Record<string, unknown>`.
 */
function toDiscoveredProduct(row: Record<string, unknown>): DiscoveredProduct {
  // shop_inventory is a LEFT join, so an unmatched row arrives as null (or as an
  // empty array on some PostgREST versions) rather than being absent from the
  // result. Both spellings fall through to the denormalised copy below.
  const rawInventory = row.shop_inventory;
  const inventory = (
    Array.isArray(rawInventory) ? rawInventory[0] : rawInventory
  ) as { quantity?: unknown; is_available?: unknown } | undefined;

  const price = Number(row.price_lkr ?? 0);

  return {
    id: String(row.id),
    shop_id: String(row.shop_id),
    shop_name: "",
    name: String(row.name ?? ""),
    unit: String(row.unit ?? ""),
    price,
    // Fall back to the selling price so "was" never reads as cheaper than "now"
    // on a row with no regular price recorded.
    regular_price: Number(row.regular_price_lkr ?? price),
    image_url: (row.image_url as string | null) ?? null,
    // Fall back to the denormalised copy on customer_products when the shop has
    // no inventory row, otherwise every product would read as sold out.
    stock_quantity: inventory
      ? Number(inventory.quantity ?? 0)
      : Number(row.stock_quantity ?? 0),
    is_available: inventory
      ? inventory.is_available !== false
      : row.available !== false,
    // A blank or whitespace-only label is no category, not a category called "".
    category: (row.category as string | null)?.trim() || null,
    discount_percent: (row.discount_percent as number | null) ?? null,
    discount_type: (row.discount_type as DiscoveredProduct["discount_type"]) ?? null,
    discount_amount_lkr: (row.discount_amount_lkr as number | null) ?? null,
  };
}

/** What a product list screen wants to ask for. */
export type DiscoveryFilters = {
  /** Free text over name, unit and category name. */
  query?: string;
  /** Restrict to one shop. Set by the shop-products screen. */
  shopId?: string;
  /**
   * Restrict to one category label. Set by the category screen.
   *
   * The stored text itself, not an id -- migration 024 removed the
   * product_categories table this used to point at.
   */
  category?: string;
  maxPrice?: number;
  inStockOnly?: boolean;
  /** Only rows actually running a discount. Drives the Offers filter. */
  offersOnly?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "name";
  limit?: number;
};

function applyFilters(
  builder: ReturnType<typeof supabase.from> | any,
  filters: DiscoveryFilters,
) {
  const term = filters.query?.trim();
  if (term) {
    // Commas, quotes and parentheses are filter syntax inside a PostgREST `ilike`
    // pattern, so a search like "milk, bread" would otherwise be parsed as extra
    // conditions and fail the whole query. Product names never need them, so they
    // are stripped rather than escaped.
    const pattern = term.replace(/[,"'()\\]/g, " ").trim();

    // category only joins the search once the confirmed shape carries it. Naming
    // a column PostgREST does not have fails the whole select, and the text search
    // is worth more than matching on category until migration 024 is applied.
    const columns = ["name", "unit"];
    if (shapeSupportsCategory()) columns.push("category");

    builder = builder.or(
      columns.map((column) => `${column}.ilike.%${pattern}%`).join(","),
    );
  }

  if (filters.shopId) {
    builder = builder.eq("shop_id", filters.shopId);
  }

  // ilike, not eq: the column is free text that nobody normalises on the way in,
  // so "Vegetables" and "vegetables" are both in the database and must both land
  // on the same product list. Without wildcards this is a case-insensitive
  // equality, which is the intended match.
  //
  // Gated on the same shape check as the search term above: before migration 024
  // is applied the column does not exist, and sending it fails the whole query
  // rather than returning nothing.
  const category = filters.category?.trim();
  if (category && shapeSupportsCategory()) {
    builder = builder.ilike("category", category);
  }

  if (typeof filters.maxPrice === "number") {
    builder = builder.lte("price_lkr", filters.maxPrice);
  }

  // offersOnly is deliberately NOT applied here. It is a client-side filter --
  // see the note on the pass in fetchDiscoveryProducts.

  switch (filters.sort) {
    case "price_asc":
      builder = builder.order("price_lkr", { ascending: true });
      break;
    case "price_desc":
      builder = builder.order("price_lkr", { ascending: false });
      break;
    case "name":
      builder = builder.order("name", { ascending: true });
      break;
    default:
      builder = builder.order("name", { ascending: true });
  }

  return builder;
}

/** Whether the confirmed select shape carries customer_products.category. */
function shapeSupportsCategory(): boolean {
  return Boolean(OPTIONAL_SHAPES[shapeIndex].category);
}

/**
 * Reads active customer listings with server-side filtering.
 *
 * Sold-out listings are included, and the card disables its own Add button for
 * them. See the note on BASE_COLUMNS before changing this.
 *
 * shop_name is resolved in a second query rather than embedded, because the
 * customer_shops relationship is not always present in PostgREST's schema cache
 * (the shop screens saw PGRST202 for it) and the catalogue must not be gated on a
 * nicety. When that lookup fails the list still renders, with a neutral label.
 */
export async function fetchDiscoveryProducts(
  filters: DiscoveryFilters = {},
): Promise<DiscoveredProduct[]> {
  let rows: Record<string, unknown>[] = [];

  for (let shape = shapeIndex; shape < OPTIONAL_SHAPES.length; shape++) {
    let builder = supabase
      .from("customer_products")
      .select(shapeSelect(OPTIONAL_SHAPES[shape]))
      .eq("active", true)
      // A substitute exists only to be swapped in for another product, so the RPC
      // rejects it as a cart line. loadCatalog filters these out the same way.
      .is("substitute_for", null);

    // Stock and availability are NOT filtered here. They used to be, on the
    // argument that a visible product must be an addable one -- but
    // BrowseProductCard disables its own Add button for a sold-out listing, so
    // that case is already handled where the button is drawn. Filtering here
    // would only hide those listings. See the note on BASE_COLUMNS.

    builder = applyFilters(builder, filters);

    // The limit is deliberately NOT sent to PostgREST when a client-side filter is
    // in play. SQL would cap the rows first and the filter would then throw most
    // of them away, so the Offers rail would take the first N rows alphabetically
    // and silently miss every discount after them. Those paths cap after
    // filtering instead, below.
    const filtersClientSide =
      Boolean(filters.offersOnly) || Boolean(filters.inStockOnly);

    if (filters.limit && !filtersClientSide) {
      builder = builder.limit(filters.limit);
    }

    const { data, error } = await builder;

    if (!error) {
      shapeIndex = shape;
      rows = (data ?? []) as unknown as Record<string, unknown>[];
      break;
    }

    if (!isMissingOptionalColumn(error)) throw error;

    if (__DEV__) {
      console.warn(
        "[discovery] customer_products is missing an optional column, narrowing the select",
        { shape, message: error.message },
      );
    }
  }

  let products = rows.map(toDiscoveredProduct);

  // inStockOnly is the one stock filter, and it is client-side because SQL no
  // longer filters stock at all (see BASE_COLUMNS). It has to check both halves
  // of what the old SQL filter checked: a listing with stock the shop has marked
  // unavailable still cannot be ordered, and letting it through would show it
  // under "In stock only" with an Add button the card then disables.
  if (filters.inStockOnly) {
    products = products.filter(
      (product) => product.stock_quantity > 0 && product.is_available,
    );
  }

  // Offers stay client-side: SQL cannot express "price is below regular price" in
  // a form that also covers a fixed discount whose percentage column is stored as
  // 0 by design. This list is small enough that the extra pass is cheaper than a
  // wrong answer.
  if (filters.offersOnly) {
    products = products.filter(hasDiscount);
    products.sort((a, b) => discountRank(b) - discountRank(a));
  }

  // Applied after the client-side filters, which is also why SQL was not asked to
  // limit in those cases.
  if (filters.limit) products = products.slice(0, filters.limit);

  return attachShopNames(products);
}

/** Biggest percentage first, so the sharpest offer leads the rail. */
function discountRank(product: DiscoveredProduct): number {
  const regular = Number(product.regular_price ?? 0);
  const price = Number(product.price ?? 0);
  if (regular <= 0 || regular <= price) return 0;
  return (regular - price) / regular;
}

/** Fills shop_name in one round trip. Failures degrade to a neutral label. */
async function attachShopNames(products: DiscoveredProduct[]): Promise<DiscoveredProduct[]> {
  const shopIds = Array.from(new Set(products.map((product) => product.shop_id)));
  if (!shopIds.length) return products;

  const { data, error } = await supabase
    .from("customer_shops")
    .select("id, name")
    .in("id", shopIds);

  if (error) return products;

  const names = new Map(
    ((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
  );

  return products.map((product) => ({
    ...product,
    shop_name: names.get(product.shop_id) ?? "Unknown shop",
  }));
}

/**
 * Only rows running a discount, largest cut first, for the home Offers rail.
 *
 * Ranks client-side over the capped fetch because SQL cannot order by a ratio it
 * does not have stored -- see `fetchDiscoveryProducts`.
 */
export async function listOffers(limit = 8): Promise<DiscoveredProduct[]> {
  return fetchDiscoveryProducts({ offersOnly: true, limit, inStockOnly: true });
}

/**
 * The categories actually in use, with how many live listings each one holds.
 *
 * Derived from customer_products.category rather than read from a table, because
 * migration 024 dropped product_categories: the label is now the only record of
 * what a category is. A rail built this way can only show categories a shop has
 * already used, which is the same guarantee the old version had by filtering to
 * a non-zero count -- a category with nothing behind it is not offered as a tap
 * leading to an empty screen.
 *
 * Public read, matching the grant in 011, so this works signed out. Busiest
 * first, ties broken alphabetically so the rail order is stable between loads.
 */
export async function listBrowseCategories(): Promise<BrowseCategory[]> {
  // One request for the whole rail. Counting per category would be one request
  // each; reading the single column the counts need and tallying it here is one.
  const { data, error } = await supabase
    .from("customer_products")
    .select("category")
    .eq("active", true);

  if (error) throw error;

  // Folded on the lower-cased label. Nothing normalises the text on write, so
  // "Vegetables" and "vegetables" are stored as two different values and would
  // otherwise render as two identical tiles that each open half the results.
  const counts = new Map<string, { label: string; count: number }>();

  for (const row of (data ?? []) as { category: string | null }[]) {
    const label = row.category?.trim();
    if (!label) continue;

    const key = label.toLowerCase();
    const existing = counts.get(key);

    // The first spelling seen wins as the display label, so whichever shop wrote
    // it first decides whether the rail reads "Vegetables" or "vegetables".
    if (existing) existing.count += 1;
    else counts.set(key, { label, count: 1 });
  }

  return [...counts.values()]
    .map(({ label, count }) => ({
      name: label,
      icon: categoryIcon(label),
      tint: categoryTint(label),
      productCount: count,
    }))
    .sort(
      (a, b) =>
        b.productCount - a.productCount || a.name.localeCompare(b.name),
    );
}

/**
 * Active shops with listing and offer counts, for the nearby list.
 *
 * Counts come from a second query over customer_products rather than an embed:
 * the customer_shops relationship is the one that intermittently fails with
 * PGRST202, and the list is far more useful with counts than without them.
 *
 * Shops in the customer's preferred hub sort first. "Nearby" here means "serves my
 * pickup hub", because there is no location data on customer_shops to sort by
 * distance -- inventing a distance would be worse than not claiming one.
 */
export async function listNearbyShops(
  preferredHubId?: string | null,
): Promise<NearbyShop[]> {
  const { data, error } = await supabase
    .from("customer_shops")
    .select(
      "id, name, address, phone, pickup_counter, preparation_minutes, is_open, hub_id",
    )
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  const shops = ((data ?? []) as {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    pickup_counter: string | null;
    preparation_minutes: number | null;
    is_open: boolean | null;
    hub_id: string | null;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    phone: row.phone ?? null,
    pickup_counter: row.pickup_counter ?? "Main",
    preparation_minutes: Number(row.preparation_minutes ?? 25),
    is_open: row.is_open !== false,
    productCount: 0,
    offerCount: 0,
    isPreferredHub: Boolean(preferredHubId) && row.hub_id === preferredHubId,
  }));

  if (!shops.length) return [];

  const { data: productRows, error: productError } = await supabase
    .from("customer_products")
    .select("shop_id, price_lkr, regular_price_lkr, discount_percent, stock_quantity")
    .eq("active", true);

  if (productError) return shops;

  const byShop = new Map(shops.map((shop) => [shop.id, shop]));

  for (const row of (productRows ?? []) as {
    shop_id: string;
    price_lkr: number | null;
    regular_price_lkr: number | null;
    discount_percent: number | null;
    stock_quantity: number | null;
  }[]) {
    const shop = byShop.get(row.shop_id);
    if (!shop) continue;

    // Sold-out listings are not something the nearby list should count as things
    // you can go and buy.
    if (Number(row.stock_quantity ?? 0) <= 0) continue;

    shop.productCount += 1;

    const price = Number(row.price_lkr ?? 0);
    const regular = Number(row.regular_price_lkr ?? price);
    const stored = Number(row.discount_percent ?? 0);

    if (stored > 0 || regular > price) shop.offerCount += 1;
  }

  return shops.sort((a, b) => {
    if (a.isPreferredHub !== b.isPreferredHub) return a.isPreferredHub ? -1 : 1;
    if (b.offerCount !== a.offerCount) return b.offerCount - a.offerCount;
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.name.localeCompare(b.name);
  });
}