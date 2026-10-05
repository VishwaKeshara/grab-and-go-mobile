import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/services/productService";
import { isValidPhone } from "@/services/cartService";
import type { CartItem, CheckoutDraft } from "@/types/cart";
import type { Order, OrderStatus } from "@/types/order";

export const SERVICE_FEE = 0;

export async function loadOrders(): Promise<Order[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];
  const userId = user.user.id;
  const { data, error } = await supabase
    .from("customer_orders")
    .select(`
      *,
      customer_order_items(*)
    `)
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row: any) => ({
    id: row.id,
    reference: row.reference,
    pin: row.pickup_pin,
    createdAt: row.created_at,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status === "pay_at_pickup" ? "pay_at_pickup" : "paid_demo",
    items: row.customer_order_items.map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.product_name,
        unit: item.product_unit,
        price: item.unit_price_lkr,
        image_url: item.image_url,
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
      pickupSlot: {
        start: row.pickup_start_at,
        end: row.pickup_end_at,
      },
      paymentMethod: row.payment_method,
    },
    subtotal: row.subtotal_lkr,
    savings: row.savings_lkr,
    serviceFee: row.service_fee_lkr,
    total: row.total_lkr,
  })) as Order[];
}

export async function createOrder(items: CartItem[], draft: CheckoutDraft): Promise<Order> {
  await currentUserId();
  if (!items.length || !draft.pickupSlot || !draft.customerName.trim() || !isValidPhone(draft.phone)) {
    throw new Error("Complete your contact details and pickup time before paying.");
  }

  // Ensure all products belong to the same shop
  const shopId = items[0].product.shopId || items[0].product.shop_id;
  for (const item of items) {
    const itemShopId = item.product.shopId || item.product.shop_id;
    if (itemShopId !== shopId) {
      throw new Error("Your cart contains items from multiple shops. Please order from one shop at a time.");
    }
  }

  const rpcItems = items.map(item => ({
    product_id: item.product.id,
    quantity: item.quantity,
    substitution: item.substitution,
  }));

  const { error } = await supabase.rpc("place_customer_order", {
    p_checkout_id: draft.checkoutId,
    p_payment_method: draft.paymentMethod,
    p_customer_name: draft.customerName,
    p_customer_phone: draft.phone,
    p_packing_instructions: draft.packingInstructions || "",
    p_travel_method: draft.travelMethod,
    p_pickup_start_at: draft.pickupSlot.start,
    p_pickup_end_at: draft.pickupSlot.end,
    p_items: rpcItems
  });

  if (error) {
    throw new Error(error.message || "Failed to create order");
  }

  const all = await loadOrders();
  return all.find(o => o.draft.checkoutId === draft.checkoutId)!;
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<Order[]> {
  // Only allow cancellation from customer side to prevent arbitrary status changes
  if (status !== 'cancelled') {
    throw new Error("Customers can only cancel orders, not change them to other statuses.");
  }
  
  const { error } = await supabase
    .from("customer_orders")
    .update({ status })
    .eq("id", id)
    .eq("status", "placed"); // Ensure only placed orders can be cancelled

  if (error) throw error;
  return await loadOrders();
}

