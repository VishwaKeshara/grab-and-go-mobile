export type ShopOrderStatus =
  | "new"
  | "accepted"
  | "packing"
  | "ready"
  | "completed"
  | "rejected";

export type PackingStatus =
  | "unpacked"
  | "partial"
  | "fully_packed";

export type PickupStatus =
  | "pending"
  | "verified"
  | "collected";

export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitLabel: string;
  isPacked: boolean;
  substituteProductId: string | null;
}

export interface ShopOrder {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: ShopOrderStatus;
  packingStatus: PackingStatus;
  pickupStatus: PickupStatus;
  totalAmount: number;
  itemCount: number;
  items?: ShopOrderItem[];
  pickupScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
