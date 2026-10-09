// ProductCategory was the row shape of the product_categories table and is
// deliberately absent. Migration 024 dropped that table; a product's category is
// now the free-text customer_products.category label, typed as
// `string | null` on Product and DiscoverCategory carries the browse-rail shape.
// See services/productService.ts listProductCategories and
// services/discoveryService.ts listBrowseCategories.

export type FeaturedProduct = {
  id: string;
  product_id: string;
  headline: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type StockAdjustment = {
  id: string;
  shop_id: string;
  product_id: string;
  user_id: string | null;
  previous_quantity: number;
  new_quantity: number;
  delta: number;
  reason: string;
  created_at: string;
};

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory =
  | "General"
  | "Orders"
  | "Payments"
  | "Stock"
  | "Account"
  | "Other";

export type SupportTicket = {
  id: string;
  user_id: string;
  shop_id: string | null;
  subject: string;
  category: TicketCategory;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  contact_email: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketInput = {
  subject: string;
  message: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  shop_id?: string | null;
  contact_email?: string | null;
};

export type SupportTicketUpdate = Partial<
  Pick<
    SupportTicket,
    "subject" | "message" | "category" | "priority" | "status" | "resolution"
  >
>;