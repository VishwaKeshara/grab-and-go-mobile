import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHOP, cartTotals, isValidPhone, scopedKey } from "@/services/cartService";
import { canTransition, isPickupSlotAvailable } from "@/utils/ordering";
import type { CartItem, CheckoutDraft } from "@/types/cart";
import type { Order, OrderStatus } from "@/types/order";

const KEY = "grab-go-demo-orders-v1";
export const SERVICE_FEE = 0;

export async function loadOrders(): Promise<Order[]> {
  const value = await AsyncStorage.getItem(await scopedKey(KEY));
  return value ? JSON.parse(value) as Order[] : [];
}

export async function createOrder(items: CartItem[], draft: CheckoutDraft): Promise<Order> {
  const orders = await loadOrders();
  const existing = orders.find(order => order.draft.checkoutId === draft.checkoutId);
  if (existing) return existing;
  if (!items.length || !draft.pickupSlot || !draft.customerName.trim() || !isValidPhone(draft.phone)) throw new Error("Complete your contact details and pickup time before paying.");
  if (!isPickupSlotAvailable(draft.pickupSlot, SHOP.prepMinutes)) throw new Error("That pickup slot is too soon. Choose another time.");
  const totals = cartTotals(items);
  const now = new Date();
  const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const order: Order = { id, reference: `GG-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`, pin: String(Math.floor(1000 + Math.random() * 9000)), createdAt: now.toISOString(), status: "placed", paymentStatus: draft.paymentMethod === "pickup" ? "pay_at_pickup" : "paid_demo", items: JSON.parse(JSON.stringify(items)) as CartItem[], draft: JSON.parse(JSON.stringify(draft)) as CheckoutDraft, subtotal: totals.subtotal, savings: totals.savings, serviceFee: SERVICE_FEE, total: totals.subtotal + SERVICE_FEE };
  await AsyncStorage.setItem(await scopedKey(KEY), JSON.stringify([order, ...orders]));
  return order;
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<Order[]> {
  const orders = await loadOrders();
  const current = orders.find(order => order.id === id);
  if (!current) throw new Error("This order could not be found.");
  if (!canTransition(current.status, status)) throw new Error("This status change is not available.");
  const updated = orders.map(order => order.id === id ? { ...order, status } : order);
  await AsyncStorage.setItem(await scopedKey(KEY), JSON.stringify(updated));
  return updated;
}
