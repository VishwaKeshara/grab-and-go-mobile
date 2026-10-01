export type SubstitutePreference = { type: "alternative"; productId: string } | { type: "call" } | { type: "none" };

export type GroceryProduct = {
  id: string;
  name: string;
  unit: string;
  price: number;
  regularPrice: number;
  image: string;
};

export type CartItem = {
  product: GroceryProduct;
  quantity: number;
  substitution: SubstitutePreference;
};

export type PickupSlot = { date: string; start: string; end: string; mode: "express" | "scheduled" };

export type TravelMethod = "walking" | "motorcycle" | "car";

export type PaymentMethod = "wallet" | "card" | "pickup";

export type CheckoutDraft = {
  checkoutId: string;
  customerName: string;
  phone: string;
  packingInstructions: string;
  travelMethod: TravelMethod;
  pickupSlot: PickupSlot | null;
  paymentMethod: PaymentMethod;
};
