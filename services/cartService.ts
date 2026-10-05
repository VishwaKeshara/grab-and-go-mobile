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
  CustomerProductRow,
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
  row: CustomerProductRow,
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
  const {
    data: existingCart,
    error: existingCartError,
  } = await supabase
    .from("customer_carts")
    .select("shop_id")
    .limit(1)
    .maybeSingle();

  if (existingCartError) {
    throw existingCartError;
  }

  const shopQuery = () =>
    supabase
      .from("customer_shops")
      .select(
        "id,name,address,phone,pickup_counter,preparation_minutes,timezone,active",
      )
      .eq("active", true);

  let {
    data: shopData,
    error: shopError,
  } = existingCart?.shop_id
    ? await shopQuery()
        .eq("id", existingCart.shop_id)
        .maybeSingle()
    : await shopQuery()
        .eq("name", HOME_SHOP_NAME)
        .limit(1)
        .maybeSingle();

  if (shopError) {
    throw shopError;
  }

  if (!shopData && !existingCart?.shop_id) {
    ({
      data: shopData,
      error: shopError,
    } = await shopQuery()
      .order("name")
      .limit(1)
      .maybeSingle());

    if (shopError) {
      throw shopError;
    }
  }

  if (!shopData) {
    throw new Error("No ordering shop is available.");
  }

  const shop = mapShop(shopData as CustomerShopRow);

  const { data, error } = await supabase
    .from("customer_products")
    .select(
      "id,shop_id,name,unit,price_lkr,regular_price_lkr,image_url,active,available,stock_quantity,substitute_for",
    )
    .eq("shop_id", shop.id)
    .eq("active", true)
    .order("name");

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as CustomerProductRow[]).filter(
    (row) => row.available && row.stock_quantity > 0,
  );

  const catalog = rows
    .filter((row) => !row.substitute_for)
    .map(mapProduct);

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

export async function loadCart(): Promise<CartItem[]> {
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Sign in to load your cart.");
  }

  const {
    data: cartData,
    error: cartError,
  } = await supabase
    .from("customer_carts")
    .select("id,customer_id,shop_id")
    .eq("customer_id", userData.user.id)
    .maybeSingle();

  if (cartError) {
    throw cartError;
  }

  const cart = cartData as CustomerCartRow | null;

  if (!cart) {
    return [];
  }

  const { data, error } = await supabase
    .from("customer_cart_items")
    .select("product_id,quantity,substitution")
    .eq("cart_id", cart.id)
    .order("updated_at");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CustomerCartItemRow[];

  if (!rows.length) {
    return [];
  }

  const {
    data: productData,
    error: productError,
  } = await supabase
    .from("customer_products")
    .select(
      "id,shop_id,name,unit,price_lkr,regular_price_lkr,image_url,active,available,stock_quantity,substitute_for",
    )
    .in(
      "id",
      rows.map((row) => row.product_id),
    );

  if (productError) {
    throw productError;
  }

  const byId = new Map(
    ((productData ?? []) as CustomerProductRow[]).map(
      (row) => [row.id, mapProduct(row)],
    ),
  );

  return rows.map((row) => {
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

export const saveDraft = async (
  draft: CheckoutDraft,
) =>
  AsyncStorage.setItem(
    await scopedKey(DRAFT_KEY),
    JSON.stringify(draft),
  );
