import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type {
  CartItem,
  CheckoutDraft,
  GroceryProduct,
  GroceryShop,
  SubstitutePreference,
} from "@/types/cart";
import type {
  CustomerCartItemRow,
  CustomerCartRow,
  CustomerInventoryProductRow,
  CustomerProductDetailsRow,
  CustomerShopRow,
} from "@/types/database";

export { cartTotals, isValidPhone } from "@/utils/ordering";

export const HOME_SHOP_NAME = "Pasar Groceries";

// Display-only home cards.
// These do NOT contain canonical product IDs and must never be sent
// directly to the cart RPC.
export const homeFeaturedProducts: readonly Pick<
  GroceryProduct,
  "name" | "unit" | "price" | "regularPrice" | "image"
>[] = [
  {
    name: "Kolikuttu Bananas",
    unit: "500 g",
    price: 280,
    regularPrice: 320,
    image:
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=85",
  },
  {
    name: "Country Grain Loaf",
    unit: "400 g",
    price: 420,
    regularPrice: 450,
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=85",
  },
  {
    name: "Farm Fresh Eggs",
    unit: "pack of 6",
    price: 540,
    regularPrice: 600,
    image:
      "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=85",
  },
];

const DRAFT_KEY = "grab-go-checkout-draft-v1";

function throwOrderingRequestError(stage: string, cause: unknown): never {
  if (__DEV__) {
    const error = cause as {
      code?: unknown; message?: unknown; details?: unknown; hint?: unknown;
    } | null;
    console.warn("[Ordering load] Supabase request failed", {
      stage,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  }
  throw cause;
}

export async function scopedKey(key: string) {
  const { data } = await supabase.auth.getSession();

  return `${key}:${data.session?.user.id ?? "guest"}`;
}

export const newCheckoutId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const initialDraft: CheckoutDraft = {
  checkoutId: newCheckoutId(),
  customerName: "",
  phone: "",
  packingInstructions: "",
  travelMethod: "walking",
  pickupSlot: null,
  paymentMethod: "pickup",
};

export function mapShop(row: CustomerShopRow): GroceryShop {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    counter: row.pickup_counter,
    prepMinutes: row.preparation_minutes,
    timezone: row.timezone,
    phone: row.phone,
  };
}

export function mapProduct(
  row: CustomerProductDetailsRow,
): GroceryProduct {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    unit: row.unit,
    price: row.price_lkr,
    regularPrice: row.regular_price_lkr,
    image: row.image_url ?? "",
  };
}

export async function loadCatalog(): Promise<{
  shop: GroceryShop;
  products: GroceryProduct[];
  alternatives: Record<string, GroceryProduct[]>;
}> {
  const { data: existingCart, error: existingCartError } = await supabase
    .from("customer_carts").select("shop_id").limit(1).maybeSingle();
  if (existingCartError) throwOrderingRequestError("catalog.cart", existingCartError);
  const shopQuery = () => supabase.from("customer_shops")
    .select("id,name,address,phone,pickup_counter,preparation_minutes,timezone,active")
    .eq("active", true);
  let { data: shopData, error: shopError } = existingCart?.shop_id
    ? await shopQuery().eq("id", existingCart.shop_id).maybeSingle()
    : await shopQuery().eq("name", HOME_SHOP_NAME).limit(1).maybeSingle();
  if (shopError) throwOrderingRequestError("catalog.shop", shopError);
  if (!shopData && !existingCart?.shop_id) {
    ({ data: shopData, error: shopError } = await shopQuery().order("name").limit(1).maybeSingle());
    if (shopError) throwOrderingRequestError("catalog.shop-fallback", shopError);
  }

  if (!shopData) {
    throw new Error("No ordering shop is available.");
  }

  const shop = mapShop(shopData as CustomerShopRow);
  const { data, error } = await supabase.from("customer_products")
    .select("id,shop_id,name,unit,price_lkr,regular_price_lkr,image_url,active,substitute_for,shop_inventory!inner(quantity,is_available)")
    .eq("shop_id", shop.id)
    .eq("active", true)
    .eq("shop_inventory.shop_id", shop.id)
    .eq("shop_inventory.is_available", true)
    .gt("shop_inventory.quantity", 0)
    .order("name");
  if (error) throwOrderingRequestError("catalog.products", error);
  const rows = (data ?? []) as CustomerInventoryProductRow[];
  const catalog = rows.filter(row => !row.substitute_for).map(mapProduct);
  const choices: Record<string, GroceryProduct[]> = {};

  for (const row of rows) {
    if (row.substitute_for) {
      (choices[row.substitute_for] ??= []).push(
        mapProduct(row),
      );
    }
  }

  return {
    shop,
    products: catalog,
    alternatives: choices,
  };
}

/**
 * The server's cart, plus the shop it is scoped to.
 *
 * `shopId` is deliberately not derived from the items. customer_carts.shop_id is
 * its own column and it outlives the last item -- change_customer_cart only
 * resets it on 'clear' or on removing the final line -- so a cart can be empty
 * and still scoped to a shop. The RPC then rejects any add from a different shop
 * with 'Cart contains products from another shop', so the client has to see this
 * value to know it must clear before adding. See the shop-switch branch in
 * useCart.addItem.
 */
export type LoadedCart = {
  items: CartItem[];
  shopId: string | null;
};

export async function loadCart(): Promise<LoadedCart> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throwOrderingRequestError("cart.auth", userError);
  if (!userData.user) throw new Error("Sign in to load your cart.");
  const { data: cartData, error: cartError } = await supabase.from("customer_carts")
    .select("id,customer_id,shop_id").eq("customer_id", userData.user.id).maybeSingle();
  if (cartError) throwOrderingRequestError("cart.record", cartError);
  const cart = cartData as CustomerCartRow | null;

  if (!cart) {
    return { items: [], shopId: null };
  }

  const shopId = cart.shop_id ?? null;

  const { data, error } = await supabase
    .from("customer_cart_items")
    .select("product_id,quantity,substitution")
    .eq("cart_id", cart.id)
    .order("updated_at");
  if (error) throwOrderingRequestError("cart.items", error);
  const rows = (data ?? []) as CustomerCartItemRow[];

  if (!rows.length) {
    return { items: [], shopId };
  }

  const {
    data: productData,
    error: productError,
  } = await supabase
    .from("customer_products")
    .select("id,shop_id,name,unit,price_lkr,regular_price_lkr,image_url")
    .in("id", rows.map(row => row.product_id));
  if (productError) throwOrderingRequestError("cart.products", productError);
  const byId = new Map(((productData ?? []) as CustomerProductDetailsRow[])
    .map(row => [row.id, mapProduct(row)]));
  const items = rows.map(row => {
    const product = byId.get(row.product_id);

    if (!product) {
      throw new Error(
        "A cart product could not be loaded.",
      );
    }

    return {
      product,
      quantity: row.quantity,
      substitution: row.substitution,
    };
  });

  return { items, shopId };
}

export async function changeCart(
  operation:
    | "add"
    | "set"
    | "remove"
    | "substitute"
    | "clear",
  productId?: string,
  quantity?: number,
  substitution?: SubstitutePreference,
): Promise<void> {
  const controller = new AbortController();

  let timer:
    | ReturnType<typeof setTimeout>
    | undefined;

  try {
    const { error } = await Promise.race([
      supabase
        .rpc("change_customer_cart", {
          p_operation: operation,
          p_product_id: productId ?? null,
          p_quantity: quantity ?? null,
          p_substitution: substitution ?? null,
        })
        .abortSignal(controller.signal),

      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();

          reject(
            new Error(
              "Cart update timed out. Check your cart before trying again.",
            ),
          );
        }, 20000);
      }),
    ]);

    if (error) {
      throw error;
    }
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error(
        "Cart update timed out. Check your cart before trying again.",
      );
    }

    throw cause;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function loadDraft(): Promise<CheckoutDraft> {
  const value = await AsyncStorage.getItem(
    await scopedKey(DRAFT_KEY),
  );

  const stored = value
    ? (JSON.parse(value) as Partial<CheckoutDraft>)
    : null;

  return stored
    ? {
        ...initialDraft,
        ...stored,
        checkoutId:
          stored.checkoutId || newCheckoutId(),
      }
    : {
        ...initialDraft,
        checkoutId: newCheckoutId(),
      };
}
let draftWriteQueue: Promise<void> = Promise.resolve();
export function saveDraft(draft: CheckoutDraft): Promise<void> {
  const key = scopedKey(DRAFT_KEY);
  const value = JSON.stringify(draft);
  const write = draftWriteQueue.then(async () => {
    await AsyncStorage.setItem(await key, value);
  });
  draftWriteQueue = write.catch(() => undefined);
  return write;
}
