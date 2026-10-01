import type { CartItem, PickupSlot } from "../types/cart";
import type { OrderStatus } from "../types/order";

export function cartTotals(items: CartItem[]) {
  return items.reduce((sum, item) => ({ count: sum.count + 1, units: sum.units + item.quantity, subtotal: sum.subtotal + item.product.price * item.quantity, savings: sum.savings + Math.max(0, item.product.regularPrice - item.product.price) * item.quantity }), { count: 0, units: 0, subtotal: 0, savings: 0 });
}

export const isValidPhone = (phone: string) => /^\+?[\d\s()-]+$/.test(phone.trim()) && phone.replace(/\D/g, "").length >= 9;

export function isPickupSlotAvailable(slot: PickupSlot, prepMinutes: number, now = Date.now()) {
  const start = new Date(`${slot.date}T${slot.start}:00`).getTime();
  return Number.isFinite(start) && start > now + prepMinutes * 60000;
}

export function canTransition(current: OrderStatus, next: OrderStatus) {
  if (current === "cancelled") return false;
  if (next === "cancelled") return current === "placed" || current === "accepted";
  const steps: OrderStatus[] = ["placed", "accepted", "packing", "ready", "collected"];
  return steps.indexOf(next) === steps.indexOf(current) + 1;
}
