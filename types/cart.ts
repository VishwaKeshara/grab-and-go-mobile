export type SubstitutePreference = { type: "alternative"; productId: string } | { type: "call" } | { type: "none" };

export type GroceryProduct = {
  id: string;
  shopId?: string;
  name: string;
  unit: string;
  price: number;
  regularPrice: number;
  image: string;
};

export type GroceryShop = {
  id: string;
  name: string;
  address: string;
  counter: string;
  prepMinutes: number;
  timezone: string;
  phone: string | null;
};

export type CartItem = {
  product: GroceryProduct;
  quantity: number;
  substitution: SubstitutePreference;
};

export type PickupSlot = { id?: string; date: string; start: string; end: string; mode: "express" | "scheduled" };
export type PickupAvailability = {
  today: string; timezone: string; intervalMinutes: number; slots: PickupSlot[];
};

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
