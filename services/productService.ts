import { supabase } from "@/lib/supabase";
import type {
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
    .from("products")
    .select(`${PRODUCT_COLUMNS}, shops!inner(name)`)
    .eq("id", id)
    .single();

  if (error) throw error;
  return toProductWithShop(data);
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