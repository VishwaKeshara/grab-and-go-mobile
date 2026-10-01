import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItem, CheckoutDraft, GroceryProduct } from "@/types/cart";
import { supabase } from "@/lib/supabase";
export { cartTotals, isValidPhone } from "@/utils/ordering";

export const SHOP = { name: "Pasar Groceries", distance: "0.8 km away", counter: "Pickup counter B", prepMinutes: 25, phone: "Not available in local demo", address: "Malabe Bazaar Hub, Kaduwela Road" };

export const products: GroceryProduct[] = [
  { id: "bananas", name: "Kolikuttu Bananas", unit: "500 g", price: 280, regularPrice: 320, image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=85" },
  { id: "bread", name: "Country Grain Loaf", unit: "400 g", price: 420, regularPrice: 450, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=85" },
  { id: "eggs", name: "Farm Fresh Eggs", unit: "pack of 6", price: 540, regularPrice: 600, image: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=85" },
  { id: "milk", name: "Fresh Cow Milk", unit: "1 L", price: 490, regularPrice: 520, image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=85" },
  { id: "apples", name: "Red Apples", unit: "500 g", price: 690, regularPrice: 750, image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&q=85" },
];

export const alternatives: Record<string, GroceryProduct[]> = {
  bananas: [products[4]],
  bread: [{ id: "white-bread", name: "Fresh White Loaf", unit: "400 g", price: 390, regularPrice: 420, image: products[1].image }],
  eggs: [{ id: "large-eggs", name: "Large Farm Eggs", unit: "pack of 6", price: 590, regularPrice: 620, image: products[2].image }],
  milk: [{ id: "milk-alt", name: "Highland Fresh Milk", unit: "1 L", price: 510, regularPrice: 540, image: products[3].image }],
  apples: [products[0]],
};

const CART_KEY = "grab-go-demo-cart-v1";
const DRAFT_KEY = "grab-go-checkout-draft-v1";
export async function scopedKey(key: string) {
  const { data } = await supabase.auth.getSession();
  return `${key}:${data.session?.user.id ?? "guest"}`;
}
export const newCheckoutId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export const initialDraft: CheckoutDraft = { checkoutId: newCheckoutId(), customerName: "", phone: "", packingInstructions: "", travelMethod: "walking", pickupSlot: null, paymentMethod: "pickup" };

const demoCart: CartItem[] = [products[0], products[1], products[2]].map(product => ({ product, quantity: 1, substitution: { type: "call" } }));

export async function loadCart(): Promise<CartItem[]> {
  const value = await AsyncStorage.getItem(await scopedKey(CART_KEY));
  return value === null ? demoCart : JSON.parse(value) as CartItem[];
}
export const saveCart = async (items: CartItem[]) => AsyncStorage.setItem(await scopedKey(CART_KEY), JSON.stringify(items));
export async function loadDraft(): Promise<CheckoutDraft> {
  const value = await AsyncStorage.getItem(await scopedKey(DRAFT_KEY));
  const stored = value ? JSON.parse(value) as Partial<CheckoutDraft> : null;
  return stored ? { ...initialDraft, ...stored, checkoutId: stored.checkoutId || newCheckoutId() } : { ...initialDraft, checkoutId: newCheckoutId() };
}
export const saveDraft = async (draft: CheckoutDraft) => AsyncStorage.setItem(await scopedKey(DRAFT_KEY), JSON.stringify(draft));
