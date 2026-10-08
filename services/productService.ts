import { supabase } from "@/lib/supabase";
import { fetchDiscoveryProducts } from "@/services/discoveryService";
import { getLocalStaffSession } from "@/services/shopService";
import type {
  DiscountType,
  InventoryProduct,
  Product,
  ProductFilters,
  ProductInput,
  ProductSort,
  ProductUpdate,
  ProductWithShop,
  Review,
  SearchHistoryEntry,
} from "@/types/product";

const PRODUCT_COLUMNS =
  "id, shop_id, name, description, category, unit, price, stock_quantity, image_url, is_available, created_at, updated_at";

/** PostgREST returns `numeric` as a string, so normalise money and counts. */
function toProduct(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    price: Number(row.price ?? 0),
    stock_quantity: Number(row.stock_quantity ?? 0),
  };
}

function extractShopName(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? "Unknown shop";
  }
  if (value && typeof value === "object") {
    return (value as { name?: string }).name ?? "Unknown shop";
  }
  return "Unknown shop";
}

function toProductWithShop(row: Record<string, unknown>): ProductWithShop {
  return {
    ...toProduct(row),
    shop_name: extractShopName(row.shops),
  };
}

export async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("You need to sign in to continue.");
  return data.user.id;
}

/**
 * How this caller is allowed to write: a shop staff PIN token, or the shop
 * owner's own Supabase session.
 *
 * A shop is run from two different screens in this app and both are legitimate,
 * so every write has to work either way. Discounts were staff-only because the
 * write helpers each demanded a token, which read as "discounts are staff
 * only" to an owner who was signed in with their account.
 *
 * The two paths are authorised differently, which is the whole reason the
 * branching exists:
 *
 *   staff  holds a token in AsyncStorage and has no Supabase session, so the
 *          request runs as `anon` and has to go through the SECURITY DEFINER
 *          functions in 018-021, which validate the token.
 *   owner  has a session, so the request runs as `authenticated` and the RLS
 *          policies from 022 scope the rows to shops they own.
 *
 * A staff token wins when both are present, so signing in to the app as a
 * customer never silently downgrades a clerk to the owner path.
 */
export type ProductWriteAccess =
  | { kind: "staff"; token: string }
  | { kind: "owner" };

/**
 * Resolves the write path for the current session.
 *
 * Throws with one message for both cases, because the two sign-in methods are
 * not meaningfully different to someone standing in front of the shop screen:
 * what matters is that they are signed in as somebody who runs this shop.
 */
export async function productWriteAccess(): Promise<ProductWriteAccess> {
  const token = await getLocalStaffSession();
  if (token) return { kind: "staff", token };

  const { data } = await supabase.auth.getSession();
  if (data.session) return { kind: "owner" };

  throw new Error(
    "Sign in as the shop owner or as shop staff before changing products.",
  );
}

/**
 * Read products with server-side filtering. PostgREST applies the filters,
 * so this stays fast as the catalogue grows instead of pulling everything
 * into the client.
 */
export async function searchProducts(
  filters: ProductFilters = {},
): Promise<ProductWithShop[]> {
  let query = supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, shops!inner(name)`)
    .eq("shops.is_active", true);

  const term = filters.query?.trim();
  if (term) {
    // Search across name, description and category in one round trip.
    const pattern = `%${term}%`;
    query = query.or(
      `name.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern}`,
    );
  }

  if (filters.category) {
    query = query.ilike("category", filters.category);
  }

  if (filters.shopId) {
    query = query.eq("shop_id", filters.shopId);
  }

  if (typeof filters.maxPrice === "number") {
    query = query.lte("price", filters.maxPrice);
  }

  if (filters.inStockOnly) {
    query = query.gt("stock_quantity", 0).eq("is_available", true);
  }

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => toProductWithShop(row));
}

export async function listCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("is_available", true);
  if (error) throw error;

  const categories = (data ?? []).map((row) => row.category as string);
  return Array.from(new Set(categories)).sort();
}

export async function getProduct(id: string): Promise<ProductWithShop> {
  const { data, error } = await supabase
    .from("customer_products")
    .select(`
      id, shop_id, name, unit, price_lkr, regular_price_lkr, image_url, active,
      available, stock_quantity,
      customer_shops!inner(name),
      shop_inventory(quantity, is_available)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  const row: any = data;

  // LEFT join: shop_inventory is the stock source of truth but only has rows
  // for products a shop has actually stocked. An inner join makes .single()
  // return no rows at all, so the product page would fail to load entirely.
  const inventory = Array.isArray(row.shop_inventory)
    ? row.shop_inventory[0]
    : row.shop_inventory;

  return {
    id: row.id,
    shop_id: row.shop_id,
    shop_name: row.customer_shops?.name || row.customer_shops?.[0]?.name || "Unknown Shop",
    name: row.name,
    unit: row.unit,
    price: Number(row.price_lkr ?? 0),
    regular_price: Number(row.regular_price_lkr ?? row.price_lkr ?? 0),
    stock_quantity: inventory?.quantity ?? Number(row.stock_quantity ?? 0),
    is_available: inventory?.is_available ?? row.available !== false,
    image_url: row.image_url,
    category: "Grocery", // stub for compatibility
  } as ProductWithShop;
}

export async function listProductsByShop(
  shopId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("shop_id", shopId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toProduct);
}

// --------------------------------------------------------------- reviews

export async function listProductReviews(productId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, user_id, rating, comment, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Create a review, replacing any existing review this user left on the product. */
export async function createProductReview(
  productId: string,
  rating: number,
  comment: string,
): Promise<Review> {
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        product_id: productId,
        user_id: userId,
        rating,
        comment: comment.trim(),
      },
      { onConflict: "product_id,user_id" },
    )
    .select("id, product_id, user_id, rating, comment, created_at")
    .single();

  if (error) throw error;
  return data as Review;
}

export async function deleteProductReview(id: string) {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------ favourites

export async function listFavouriteIds(): Promise<string[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("favourites")
    .select("product_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.product_id as string);
}

export async function listFavouriteProducts(): Promise<ProductWithShop[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("favourites")
    .select(
      `id, product_id, products!inner(${PRODUCT_COLUMNS}, shops!inner(name))`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    toProductWithShop(
      (row as unknown as { products: Record<string, unknown> }).products,
    ),
  );
}

export async function addFavourite(productId: string) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("favourites")
    .upsert(
      { user_id: userId, product_id: productId },
      { onConflict: "user_id,product_id" },
    );
  if (error) throw error;
}

export async function removeFavourite(productId: string) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) throw error;
}

// -------------------------------------------------------- search history

export async function listSearchHistory(
  limit = 10,
): Promise<SearchHistoryEntry[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("search_history")
    .select("id, user_id, query, result_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SearchHistoryEntry[];
}

/** Records a search, collapsing case-insensitive repeats onto the newest row. */
export async function recordSearch(
  query: string,
  resultCount: number,
): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;

  const userId = await currentUserId();

  const { data: existing } = await supabase
    .from("search_history")
    .select("id")
    .eq("user_id", userId)
    .ilike("query", trimmed)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("search_history")
      .update({ result_count: resultCount })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("search_history")
    .insert({ user_id: userId, query: trimmed, result_count: resultCount });
  if (error) throw error;
}

export async function deleteSearchHistory(id: string) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearSearchHistory() {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// -------------------------------------------------------- product writes

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      shop_id: input.shop_id,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category?.trim() || "General",
      unit: input.unit?.trim() || "pc",
      price: input.price,
      stock_quantity: input.stock_quantity ?? 0,
      image_url: input.image_url ?? null,
      is_available: input.is_available ?? true,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return toProduct(data);
}

export async function updateProduct(
  id: string,
  changes: ProductUpdate,
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(changes)
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return toProduct(data);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export type { ProductSort };

// --- CANONICAL FUNCTIONS ---

/** One selectable category for the product form. */
export type ProductCategoryOption = {
    id: string;
    name: string;
    slug: string;
    icon: string;
};

/**
 * Active categories for the Add Product dropdown.
 *
 * Public read, matching the grant in migrations/011_grant_anon_public_access.sql,
 * so this works from a shop screen running as `anon`. Sorted by the curated
 * sort_order rather than alphabetically.
 */
export async function listProductCategories(): Promise<ProductCategoryOption[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, slug, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProductCategoryOption[];
}

/**
 * Creates a product with its opening stock, for whoever runs the shop.
 *
 * Staff go through staff_create_product. The owner writes the two rows directly,
 * which is possible because 022 grants `authenticated` insert and backs it with
 * a row policy scoped to their own shop -- the same two facts the function
 * derives from a token. Both paths write customer_products.stock_quantity as
 * well as shop_inventory, because customer-facing search reads stock_quantity
 * and would otherwise show every new product as sold out.
 *
 * See migrations/018_staff_product_writes.sql and 022_owner_shop_writes.sql.
 */
export async function createShopProduct(
  shopId: string,
  input: Partial<InventoryProduct>,
  initialStock: number,
  categoryId?: string | null,
) {
  const quantity = Math.max(0, Math.trunc(Number(initialStock) || 0));
  const priceLkr = Math.max(0, Math.trunc(Number(input.priceLkr) || 0));
  const name = input.name ?? "Unnamed product";
  const unit = input.unit || "unit";
  const imageUrl = input.imageUrl || null;
  const category = categoryId || null;

  const access = await productWriteAccess();

  if (access.kind === "owner") {
    const { data: created, error } = await supabase
      .from("customer_products")
      .insert({
        shop_id: shopId,
        name: name.trim(),
        unit,
        price_lkr: priceLkr,
        regular_price_lkr: priceLkr,
        image_url: imageUrl,
        active: true,
        // `available` is this table's column; shop_inventory uses is_available.
        // 006_member3_order_payment.sql added available alongside
        // stock_quantity, and every customer-facing read filters on it.
        available: quantity > 0,
        stock_quantity: quantity,
        category_id: category,
      })
      .select("id")
      .single();

    if (error) throw error;

    const productId = created.id as string;

    const { error: inventoryError } = await supabase
      .from("shop_inventory")
      .insert({
        shop_id: shopId,
        product_id: productId,
        quantity,
        low_stock_threshold: 5,
        is_available: quantity > 0,
        updated_at: new Date().toISOString(),
      });

    if (inventoryError) throw inventoryError;

    return { id: productId, shop_id: shopId, name };
  }

  const { data: productId, error } = await supabase.rpc("staff_create_product", {
    p_token: access.token,
    p_name: name,
    p_unit: unit,
    p_price_lkr: priceLkr,
    p_image_url: imageUrl,
    p_initial_quantity: quantity,
    p_category_id: category,
  });

  if (error) throw error;

  return { id: productId as string, shop_id: shopId, name };
}

/**
 * Edits an existing listing.
 *
 * Staff go through staff_update_product; the owner writes the row directly,
 * which 022 grants and scopes to their own shop. Passing undefined for a field
 * leaves it unchanged on both paths.
 *
 * clearDiscount is how the Edit form says "this product no longer has a
 * discount". The form mirrors the selling price into regular_price_lkr, so an
 * existing discount stops being supported the moment anything is saved, and the
 * staff function zeroes it for exactly that reason. The owner path has to reach
 * the same state, or a card would keep advertising a discount that the prices
 * no longer show.
 */
export async function updateShopProduct(
  productId: string,
  changes: Partial<InventoryProduct> & {
    categoryId?: string | null;
    clearCategory?: boolean;
    clearDiscount?: boolean;
  },
) {
  const access = await productWriteAccess();

  if (access.kind === "owner") {
    const patch: Record<string, unknown> = {};

    if (changes.name !== undefined) patch.name = changes.name.trim();
    if (changes.unit !== undefined) patch.unit = changes.unit;
    if (changes.priceLkr !== undefined) {
      patch.price_lkr = Math.max(0, Math.trunc(changes.priceLkr));
    }
    if (changes.regularPriceLkr !== undefined) {
      patch.regular_price_lkr = Math.max(0, Math.trunc(changes.regularPriceLkr));
    }
    // An empty string is how the form says "remove the image", so it has to be
    // sent as an explicit null rather than omitted.
    if (changes.imageUrl !== undefined) {
      patch.image_url = changes.imageUrl || null;
    }
    if (changes.active !== undefined) patch.active = changes.active;
    if (changes.categoryId) {
      patch.category_id = changes.categoryId;
    } else if (changes.clearCategory) {
      patch.category_id = null;
    }
    if (changes.clearDiscount) {
      patch.discount_percent = 0;
      patch.discount_type = null;
      patch.discount_amount_lkr = null;
    }

    const { error } = await supabase
      .from("customer_products")
      .update(patch)
      .eq("id", productId);

    if (error) throw error;
    return { id: productId };
  }

  const token = access.token;

  const { error } = await supabase.rpc("staff_update_product", {
    p_token: token,
    p_product_id: productId,
    p_name: changes.name ?? null,
    p_unit: changes.unit ?? null,
    p_price_lkr:
      changes.priceLkr === undefined
        ? null
        : Math.max(0, Math.trunc(changes.priceLkr)),
    p_regular_price_lkr:
      changes.regularPriceLkr === undefined
        ? null
        : Math.max(0, Math.trunc(changes.regularPriceLkr)),
    p_image_url: changes.imageUrl ?? null,
    p_category_id: changes.categoryId ?? null,
    p_clear_category: changes.clearCategory ?? false,
    p_active: changes.active ?? null,
  });

  if (error) throw error;
  return { id: productId };
}

/**
 * Applies a discount to a product, in whichever of the two options the shop
 * picked: a percentage of the base price, or a fixed amount off it.
 *
 *   applyDiscount(id, "percent", 10)  → LKR 500 becomes LKR 450
 *   applyDiscount(id, "fixed", 58)    → LKR 500 becomes LKR 442
 *
 * The two are mutually exclusive, so the caller passes one or the other and
 * never both. `discount_type` records which was used, alongside the value in
 * `discount_percent` or `discount_amount_lkr`; staff_update_product then derives
 * price_lkr from the base price and keeps all of them consistent, so the
 * preview shown in the modal is exactly what gets saved.
 *
 * Discounts are a price concern, so they live on customer_products rather than
 * shop_inventory -- which holds stock, and is empty, so a discount stored there
 * would be invisible for every product today.
 *
 * See migrations/019_product_discount_percent.sql and
 * supabase/migrations/021_product_fixed_discount.sql.
 */
export async function applyDiscount(
  productId: string,
  type: DiscountType,
  value: number,
): Promise<{ regularPriceLkr: number; priceLkr: number; discountLkr: number }> {
  const access = await productWriteAccess();

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      type === "percent"
        ? "Enter a percentage greater than zero."
        : "Enter an amount greater than zero.",
    );
  }

  if (type === "percent" && amount > 100) {
    throw new Error("Enter a percentage between 1 and 100.");
  }

  // Reads the base price so the pre-discount value is preserved and the
  // returned numbers match what the function will store. The base is
  // regular_price_lkr, not price_lkr: once a discount is applied price_lkr is
  // already reduced, so a second discount taken off it would compound instead
  // of replacing.
  const { data, error } = await supabase
    .from("customer_products")
    .select("price_lkr, regular_price_lkr")
    .eq("id", productId)
    .single();

  if (error) throw error;

  const row = (data ?? {}) as { price_lkr: number; regular_price_lkr: number | null };
  const current = Number(row.price_lkr ?? 0);
  const base = Number(row.regular_price_lkr ?? current ?? 0);

  if (type === "fixed" && amount > base) {
    throw new Error(
      `A fixed discount cannot be more than the regular price of ${base.toLocaleString("en-LK")}.`,
    );
  }

  // Same rounding as the staff function, so a discount entered by the owner and
  // the same discount entered by staff produce byte-identical rows.
  const discountLkr =
    type === "percent"
      ? Math.round(base * (amount / 100))
      : Math.trunc(amount);
  const discounted = Math.max(0, base - discountLkr);

  if (access.kind === "owner") {
    // 021's CHECK constraint makes the two options mutually exclusive in the
    // schema: a percentage must not carry an amount and a fixed amount must.
    // Both columns are therefore written on every discount, with the unused one
    // nulled rather than left at whatever the previous discount stored.
    //
    // A percentage is still recorded for a fixed discount, matching what
    // staff_update_product does, so reporting can ask "which products are 20%
    // off?" without dividing in every query.
    const { error } = await supabase
      .from("customer_products")
      .update({
        price_lkr: discounted,
        regular_price_lkr: base,
        discount_type: type,
        // Fixed discounts store percentage 0, not the equivalent percentage.
        // customer_products_discount_check rejects a row that is
        // discount_type = 'fixed' together with a non-zero discount_percent,
        // which is the whole reason the column is left at 0: the percentage is
        // derived from the price pair by discountPercentOf() instead, so a fixed
        // LKR 58 off LKR 500 still shows and previews as 12% off.
        discount_percent: type === "percent" ? Math.trunc(amount) : 0,
        discount_amount_lkr:
          type === "fixed" ? Math.trunc(amount) : null,
      })
      .eq("id", productId);

    if (error) throw error;

    return {
      regularPriceLkr: base,
      priceLkr: discounted,
      discountLkr,
    };
  }

  // Only the chosen option is sent to the function, so a row can never carry a
  // percentage and an amount at once. Note these are the function's parameter
  // names, which are not the column names -- the two differ deliberately, and
  // spreading them into a table update instead is what produced PGRST204.
  const { error: updateError } = await supabase.rpc("staff_update_product", {
    p_token: access.token,
    p_product_id: productId,
    p_discount_type: type,
    ...(type === "percent"
      ? { p_discount_percent: Math.trunc(amount) }
      : { p_discount_amount_lkr: Math.trunc(amount) }),
  });

  if (updateError) throw updateError;

  return {
    regularPriceLkr: base,
    priceLkr: discounted,
    discountLkr,
  };
}

/**
 * Removes a discount by making the selling price the regular price again.
 *
 * Mirrors what the staff function does with p_clear_discount: price_lkr is set
 * back to regular_price_lkr and the discount columns are emptied, rather than
 * left describing a promotion that is no longer running.
 */
export async function clearDiscount(productId: string): Promise<void> {
  const access = await productWriteAccess();

  if (access.kind === "owner") {
    const { data, error } = await supabase
      .from("customer_products")
      .select("regular_price_lkr, price_lkr")
      .eq("id", productId)
      .single();

    if (error) throw error;

    const row = (data ?? {}) as { regular_price_lkr: number | null; price_lkr: number };
    const base = Number(row.regular_price_lkr ?? row.price_lkr ?? 0);

    const { error: updateError } = await supabase
      .from("customer_products")
      .update({
        price_lkr: base,
        discount_percent: 0,
        discount_type: null,
        discount_amount_lkr: null,
      })
      .eq("id", productId);

    if (updateError) throw updateError;
    return;
  }

  const { error } = await supabase.rpc("staff_update_product", {
    p_token: access.token,
    p_product_id: productId,
    p_clear_discount: true,
  });

  if (error) throw error;
}

/**
 * Pauses or resumes a listing.
 *
 * Staff go through staff_update_product. The owner writes active directly, which
 * 022 grants and scopes to their own shop.
 */
export async function setProductActive(productId: string, active: boolean) {
  const access = await productWriteAccess();

  if (access.kind === "owner") {
    const { error } = await supabase
      .from("customer_products")
      .update({ active })
      .eq("id", productId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.rpc("staff_update_product", {
    p_token: access.token,
    p_product_id: productId,
    p_active: active,
  });

  if (error) throw error;
}

/**
 * Customer-facing search.
 *
 * Delegates to discoveryService so Search, the home rails, Nearby Shops and a
 * shop's own product page all read the catalogue through one query. The name is
 * kept because Shop Management and several screens import it, and
 * `ProductFilters` stays the public signature so none of them have to change.
 *
 * The returned rows are `DiscoveredProduct`, which is structurally narrower than
 * `ProductWithShop` on the columns customer_products does not have. Cast through
 * unknown rather than widening `Product`, which the legacy products table
 * screens depend on.
 */
export async function searchCanonicalProducts(
  filters: ProductFilters = {},
): Promise<ProductWithShop[]> {
  const products = await fetchDiscoveryProducts({
    query: filters.query,
    shopId: filters.shopId,
    categoryId: filters.categoryId,
    maxPrice: filters.maxPrice,
    inStockOnly: filters.inStockOnly,
    offersOnly: filters.offersOnly,
    sort: filters.sort,
  });

  return products as unknown as ProductWithShop[];
}

/**
 * Archives a listing rather than deleting the row.
 *
 * customer_order_items.product_id references customer_products(id), so a hard
 * DELETE would fail on any product that appears in a historical order and would
 * destroy the name and price recorded at the time of sale. Archiving sets
 * active = false, which also takes the product out of customer search.
 *
 * Staff go through staff_archive_product. The owner writes the same two columns
 * directly, which 022 grants and scopes to their own shop.
 */
export async function deleteCanonicalProduct(id: string) {
  const access = await productWriteAccess();

  if (access.kind === "owner") {
    const { error } = await supabase
      .from("customer_products")
      .update({ active: false, available: false })
      .eq("id", id);

    if (error) throw error;

    // Left in place rather than removed, matching staff_archive_product, so an
    // un-archive or a later restock still has the quantity history.
    const { error: inventoryError } = await supabase
      .from("shop_inventory")
      .update({ is_available: false, updated_at: new Date().toISOString() })
      .eq("product_id", id);

    if (inventoryError) throw inventoryError;
    return;
  }

  const { error } = await supabase.rpc("staff_archive_product", {
    p_token: access.token,
    p_product_id: id,
  });

  if (error) throw error;
}

/** Everything a listing needs to render, and which every project has. */
const LISTING_COLUMNS = `
  id, shop_id, name, unit, price_lkr, regular_price_lkr,
  image_url, active, available, stock_quantity, category_id,
  shop_inventory(quantity, is_available)
`;

/**
 * The discount columns, in the order the migrations add them: 019 adds
 * discount_percent, 021 adds discount_type and discount_amount_lkr.
 */
const DISCOUNT_COLUMNS = [
  "discount_percent",
  "discount_type",
  "discount_amount_lkr",
] as const;

/**
 * Select shapes to try, widest first: all three columns, then only the 019 one,
 * then none. A project can be sitting on any step of that ladder.
 *
 * This is not defensive padding, it is the fix. PostgREST rejects the WHOLE
 * select when any named column is missing (42703 undefined_column), so naming
 * discount_percent on a database without it returned no products at all, and
 * Shop Management reported "We could not load your listings." for a catalogue
 * that had saved perfectly well. Dropping to a narrower shape costs one extra
 * round trip, once, and the caller still gets every product.
 */
const DISCOUNT_COLUMN_SHAPES = [
  DISCOUNT_COLUMNS.join(", "),
  DISCOUNT_COLUMNS.slice(0, 1).join(", "),
  "",
];

/**
 * Which shape last worked, so the missing-column retry happens once per app run
 * rather than on every load. Starts at the widest: on a fully migrated database
 * the first query succeeds and this is never consulted.
 *
 * Only ever moves down. It is deliberately not reset, because re-probing on
 * every screen load would trade a fixed second request for nothing. A fresh app
 * start probes again, which is when newly applied migrations get picked up.
 */
let listingShape = 0;

/**
 * Whether PostgREST refused a select because an optional discount column is not
 * in the database yet.
 *
 * 42703 is undefined_column and PGRST204 is the schema-cache form of it. Any
 * other code -- 42501 permission denied, PGRST202 missing function, a network
 * failure -- is a different problem and must surface its own message instead of
 * being retried around and then reported as something generic.
 */
function isMissingDiscountColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code !== "42703" && error.code !== "PGRST204") return false;
  return DISCOUNT_COLUMNS.some((column) =>
    (error.message ?? "").includes(column),
  );
}

/** Reads one shop's catalogue, narrowing the select only if the schema demands it. */
async function fetchShopListings(
  shopId: string,
): Promise<Record<string, unknown>[]> {
  for (let shape = listingShape; shape < DISCOUNT_COLUMN_SHAPES.length; shape++) {
    const columns = [LISTING_COLUMNS, DISCOUNT_COLUMN_SHAPES[shape]]
      .filter(Boolean)
      .join(", ");

    const { data, error } = await supabase
      .from("customer_products")
      .select(columns)
      .eq("shop_id", shopId)
      .order("name", { ascending: true });

    if (!error) {
      listingShape = shape;
      // The select string is built at runtime, so supabase-js cannot infer a row
      // type from it. Cast through unknown for the same reason the other mappers
      // in this file do.
      return ((data ?? []) as unknown as Record<string, unknown>[]);
    }

    if (!isMissingDiscountColumn(error)) throw error;

    // Loud on purpose: the products are readable, but discounts cannot be shown
    // or applied until the migration that adds those columns has been applied.
    console.warn(
      `[productService] customer_products is missing a discount column, so ` +
        `discounts cannot be read: ${error.message}. Falling back to ` +
        `${DISCOUNT_COLUMN_SHAPES[shape] || "no discount columns"}. Apply ` +
        `supabase/migrations/019_product_discount_percent.sql and ` +
        `021_product_fixed_discount.sql to restore them.`,
    );
  }

  // Unreachable: the last shape names no optional columns, so nothing can fail
  // it in a way the retry logic above is willing to swallow.
  throw new Error("We could not read this shop's products.");
}

export async function listCanonicalProductsByShop(shopId: string) {
  const rows = await fetchShopListings(shopId);

  return rows.map((row) => {
    // LEFT join: shop_inventory is empty for most products, and an inner join
    // would hide the entire catalogue.
    const raw = row.shop_inventory;
    const inventory = Array.isArray(raw) ? raw[0] : raw;

    return {
      id: row.id,
      shop_id: row.shop_id,
      name: row.name,
      unit: row.unit,
      price: Number(row.price_lkr ?? 0),
      regular_price: Number(row.regular_price_lkr ?? row.price_lkr ?? 0),
      discount_percent: row.discount_percent ?? null,
      discount_type: row.discount_type ?? null,
      discount_amount_lkr: row.discount_amount_lkr ?? null,
      stock_quantity: inventory
        ? Number(inventory.quantity ?? 0)
        : Number(row.stock_quantity ?? 0),
      is_available: inventory
        ? inventory.is_available !== false
        : row.available !== false,
      image_url: row.image_url,
      active: row.active,
      category_id: row.category_id ?? null,
      category: "Grocery", // stub for UI compatibility
    };
  }) as Product[];
}

