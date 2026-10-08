import { supabase } from "@/lib/supabase";
import { mapProduct, mapShop } from "@/services/cartService";

import type {
  CartItem,
  CheckoutDraft,
  GroceryShop,
  PickupSlot,
} from "@/types/cart";

import type {
  CustomerOrderItemRow,
  CustomerOrderRow,
  CustomerInventoryProductRow,
  CustomerShopRow,
} from "@/types/database";

import type {
  AddableOrderProduct,
  Order,
  OrderAdditionItem,
  OrderStatus,
} from "@/types/order";

import { cartTotals, isValidPhone } from "@/utils/ordering";

export const SERVICE_FEE = 0;

function localParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function mapOrder(
  row: CustomerOrderRow,
  items: CustomerOrderItemRow[],
  shop: GroceryShop,
): Order {
  const start = localParts(row.pickup_start_at, shop.timezone);
  const end = localParts(row.pickup_end_at, shop.timezone);

  const pickupSlot: PickupSlot = {
    id: row.pickup_slot_id ?? undefined,
    date: start.date,
    start: start.time,
    end: end.time,
    mode: row.pickup_mode,
  };

  return {
    id: row.id,
    reference: row.reference,
    pin: row.pickup_pin,
    createdAt: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    shop,

    items: items.map((item) => ({
      id: item.id,
      product: {
        id: item.product_id ?? item.id,
        shopId: row.shop_id,
        name: item.product_name,
        unit: item.product_unit,
        price: item.unit_price_lkr,
        regularPrice: item.regular_price_lkr,
        image: item.image_url ?? "",
      },
      quantity: item.quantity,
      substitution: item.substitution,
    })),

    draft: {
      checkoutId: row.checkout_id,
      customerName: row.customer_name,
      phone: row.customer_phone,
      packingInstructions: row.packing_instructions,
      travelMethod: row.travel_method,
      pickupSlot,
      paymentMethod: row.payment_method,
    },

    subtotal: row.subtotal_lkr,
    savings: row.savings_lkr,
    serviceFee: row.service_fee_lkr,
    total: row.total_lkr,
  };
}

export async function loadOrders(): Promise<Order[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Sign in to load your orders.");
  }

  const { data, error } = await supabase
    .from("customer_orders")
    .select(
      "id,customer_id,shop_id,checkout_id,reference,pickup_pin,status,payment_method,payment_status,customer_name,customer_phone,packing_instructions,travel_method,pickup_start_at,pickup_end_at,pickup_mode,pickup_slot_id,subtotal_lkr,savings_lkr,service_fee_lkr,total_lkr,created_at",
    )
    .eq("customer_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as CustomerOrderRow[];

  if (!rows.length) return [];

  const [itemResult, shopResult] = await Promise.all([
    supabase
      .from("customer_order_items")
      .select(
        "id,order_id,product_id,product_name,product_unit,image_url,quantity,unit_price_lkr,regular_price_lkr,substitution",
      )
      .in(
        "order_id",
        rows.map((row) => row.id),
      ),

    supabase
      .from("customer_shops")
      .select(
        "id,name,address,phone,pickup_counter,preparation_minutes,timezone,active",
      )
      .in("id", [...new Set(rows.map((row) => row.shop_id))]),
  ]);

  if (itemResult.error) throw itemResult.error;
  if (shopResult.error) throw shopResult.error;

  const items = (itemResult.data ?? []) as CustomerOrderItemRow[];

  const shops = new Map(
    ((shopResult.data ?? []) as CustomerShopRow[]).map(
      (row) => [row.id, mapShop(row)] as const,
    ),
  );

  return rows.map((row) => {
    const shop = shops.get(row.shop_id);

    if (!shop) {
      throw new Error("An order shop could not be loaded.");
    }

    return mapOrder(
      row,
      items.filter((item) => item.order_id === row.id),
      shop,
    );
  });
}

export async function createOrder(
  items: CartItem[],
  draft: CheckoutDraft,
  shop: GroceryShop,
  expectedSubtotal = cartTotals(items).subtotal,
): Promise<Order> {
  if (
    !draft.pickupSlot?.id ||
    !draft.customerName.trim() ||
    !isValidPhone(draft.phone)
  ) {
    throw new Error(
      "Complete your contact details and pickup time before paying.",
    );
  }

  const { data, error } = await supabase.rpc("place_customer_order", {
    p_checkout_id: draft.checkoutId,
    p_shop_id: shop.id,
    p_slot_id: draft.pickupSlot.id,
    p_expected_subtotal: expectedSubtotal,
    p_payment_method: draft.paymentMethod,
    p_customer_name: draft.customerName,
    p_customer_phone: draft.phone,
    p_packing_instructions: draft.packingInstructions,
    p_travel_method: draft.travelMethod,
  });

  if (error) throw error;

  const orders = await loadOrders();
  const order = orders.find((value) => value.id === data);

  if (!order) {
    throw new Error(
      "Order was placed, but its confirmation could not be loaded. Check My Orders or retry with the same checkout.",
    );
  }

  return order;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order[]> {
  if (status !== "cancelled") {
    throw new Error("Only assigned shop staff can update order status.");
  }

  const { error } = await supabase.rpc("cancel_customer_order", {
    p_order_id: id,
  });

  if (error) throw error;

  return loadOrders();
}

export async function loadAddableOrderProducts(
  orderId: string,
): Promise<AddableOrderProduct[]> {
  // loadOrders returns orders owned by the signed-in customer.
  const orders = await loadOrders();
  const order = orders.find((value) => value.id === orderId);

  if (!order) {
    throw new Error("Order not found for your account.");
  }

  if (
    order.status !== "placed" ||
    order.draft.paymentMethod !== "pickup" ||
    order.paymentStatus !== "pay_at_pickup"
  ) {
    throw new Error("Order can no longer accept items.");
  }

  const { data, error } = await supabase
    .from("customer_products")
    .select(
      "id,shop_id,name,unit,price_lkr,regular_price_lkr,image_url,active,substitute_for,shop_inventory!inner(quantity,is_available)",
    )
    .eq("shop_id", order.shop.id)
    .eq("active", true)
    .eq("shop_inventory.shop_id", order.shop.id)
    .eq("shop_inventory.is_available", true)
    .gt("shop_inventory.quantity", 0)
    .is("substitute_for", null)
    .order("name");

  if (error) throw error;

  const rows = (data ?? []) as CustomerInventoryProductRow[];

  return rows.flatMap((row) => {
    const inventory = row.shop_inventory[0];
    return inventory
      ? [{ product: mapProduct(row), stock: inventory.quantity }]
      : [];
  });
}

export async function addItemsToOrder(
  orderId: string,
  requestId: string,
  items: OrderAdditionItem[],
  expectedAdditionalSubtotal: number,
  expectedOrderTotal: number,
): Promise<Order> {
  if (!orderId || !requestId || items.length === 0) {
    throw new Error("Choose products to add to your order.");
  }

  // The RPC rechecks ownership, eligibility, prices, stock,
  // pickup availability, and duplicate requests atomically.
  const { error } = await supabase.rpc("add_items_to_customer_order", {
    p_order_id: orderId,
    p_request_id: requestId,
    p_items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    p_expected_additional_subtotal: expectedAdditionalSubtotal,
    p_expected_order_total: expectedOrderTotal,
  });

  // Keep the original Supabase error for the screen's friendly error mapping.
  // Development diagnostics intentionally omit request data and credentials.
  if (error) {
    if (__DEV__) {
      console.warn("[Add More Items] Supabase RPC failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }
    throw error;
  }

  let orders: Order[];

  try {
    orders = await loadOrders();
  } catch {
    throw new Error(
      "The additional items may have saved, but the order could not be refreshed. Retry with the same request.",
    );
  }

  const updatedOrder = orders.find((order) => order.id === orderId);

  if (!updatedOrder) {
    throw new Error(
      "The additional items may have saved, but the order could not be refreshed. Check My Orders.",
    );
  }

  return updatedOrder;
}

