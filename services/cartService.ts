import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItem, CheckoutDraft, GroceryProduct } from "@/types/cart";
import { supabase } from "@/lib/supabase";
export { cartTotals, isValidPhone } from "@/utils/ordering";

export const SHOP = { name: "Pasar Groceries", distance: "0.8 km away", counter: "Pickup counter B", prepMinutes: 25, phone: "Not available in local demo", address: "Malabe Bazaar Hub, Kaduwela Road" };

export const products: GroceryProduct[] = [];

export const alternatives: Record<string, GroceryProduct[]> = {};


const CART_KEY = "grab-go-demo-cart-v1";
const DRAFT_KEY = "grab-go-checkout-draft-v1";
export async function scopedKey(key: string) {
  const { data } = await supabase.auth.getSession();
  return `${key}:${data.session?.user.id ?? "guest"}`;
}
export const newCheckoutId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const initialDraft: CheckoutDraft = { checkoutId: newCheckoutId(), customerName: "", phone: "", packingInstructions: "", travelMethod: "walking", pickupSlot: null, paymentMethod: "pickup" };



export async function loadCart(): Promise<CartItem[]> {
  const value = await AsyncStorage.getItem(await scopedKey(CART_KEY));
  return value === null ? [] : JSON.parse(value) as CartItem[];
}
export const saveCart = async (items: CartItem[]) => AsyncStorage.setItem(await scopedKey(CART_KEY), JSON.stringify(items));
export async function loadDraft(): Promise<CheckoutDraft> {
  const value = await AsyncStorage.getItem(await scopedKey(DRAFT_KEY));
  const stored = value ? JSON.parse(value) as Partial<CheckoutDraft> : null;
  return stored ? { ...initialDraft, ...stored, checkoutId: stored.checkoutId || newCheckoutId() } : { ...initialDraft, checkoutId: newCheckoutId() };
}
export const saveDraft = async (draft: CheckoutDraft) => AsyncStorage.setItem(await scopedKey(DRAFT_KEY), JSON.stringify(draft));
