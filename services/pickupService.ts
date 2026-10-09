import { supabase } from "@/lib/supabase";
import type { PickupAvailability, PickupSlot } from "@/types/cart";

export async function loadPickupSlots(shopId: string): Promise<PickupAvailability> {
  const { data, error } = await supabase.rpc("get_customer_pickup_slots", {
    p_shop_id: shopId, p_days: 7,
  });
  if (error) throw error;
  const result = data as PickupAvailability | null;
  if (!result || !result.today || !result.timezone || !Array.isArray(result.slots)) {
    throw new Error("Pickup availability could not be loaded.");
  }
  return result;
}

export function hasPickupSlot(availability: PickupAvailability, slot: PickupSlot) {
  return availability.slots.some(value => value.id === slot.id
    && value.date === slot.date && value.start === slot.start
    && value.end === slot.end && value.mode === slot.mode);
}
