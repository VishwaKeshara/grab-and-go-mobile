import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/services/productService";
import type {
    FeaturedProduct,
    StockAdjustment,
    SupportTicket,
    SupportTicketInput,
    SupportTicketUpdate,
} from "@/types/shopManagement";

/**
 * Featured items, the stock adjustment log and support tickets - the Member 2
 * tables created in migrations 008 and 009.
 */

const FEATURED_COLUMNS =
    "id, product_id, headline, sort_order, starts_at, ends_at, is_active, created_at";
const ADJUSTMENT_COLUMNS =
    "id, shop_id, product_id, user_id, previous_quantity, new_quantity, delta, reason, created_at";
const TICKET_COLUMNS =
    "id, user_id, shop_id, subject, category, message, status, priority, contact_email, resolution, resolved_at, created_at, updated_at";

// -------------------------------------------------------------- categories
//
// product_categories, and with it listCategories/getCategory, was dropped in
// migration 024. A product's category is now the free-text
// customer_products.category label the shop typed when adding the listing;
// discoveryService.listBrowseCategories and productService.listProductCategories
// both derive their lists from that column.

// --------------------------------------------------------- featured items

export async function listFeaturedProducts(
    limit = 8,
): Promise<FeaturedProduct[]> {
    const { data, error } = await supabase
        .from("featured_products")
        .select(FEATURED_COLUMNS)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as FeaturedProduct[];
}

// -------------------------------------------------- stock adjustment log

/** Appends the audit row for a quantity change made in Stock Update. */
export async function logStockAdjustment(input: {
    shopId: string;
    productId: string;
    previousQuantity: number;
    newQuantity: number;
    reason?: string;
}): Promise<void> {
    const userId = await currentUserId();

    const { error } = await supabase.from("stock_adjustments").insert({
        shop_id: input.shopId,
        product_id: input.productId,
        user_id: userId,
        previous_quantity: input.previousQuantity,
        new_quantity: input.newQuantity,
        delta: input.newQuantity - input.previousQuantity,
        reason: input.reason ?? "",
    });

    if (error) throw error;
}

export async function listStockAdjustments(
    shopId: string,
    limit = 50,
): Promise<StockAdjustment[]> {
    const { data, error } = await supabase
        .from("stock_adjustments")
        .select(ADJUSTMENT_COLUMNS)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => ({
        ...(row as unknown as StockAdjustment),
        previous_quantity: Number(row.previous_quantity ?? 0),
        new_quantity: Number(row.new_quantity ?? 0),
        delta: Number(row.delta ?? 0),
    }));
}

// --------------------------------------------------------- support tickets

export async function listTickets(
    status?: SupportTicket["status"],
): Promise<SupportTicket[]> {
    const userId = await currentUserId();

    let query = supabase
        .from("support_tickets")
        .select(TICKET_COLUMNS)
        .eq("user_id", userId);

    if (status) query = query.eq("status", status);

    const { data, error } = await query.order("created_at", {
        ascending: false,
    });

    if (error) throw error;
    return (data ?? []) as SupportTicket[];
}

export async function createTicket(
    input: SupportTicketInput,
): Promise<SupportTicket> {
    const userId = await currentUserId();

    const { data, error } = await supabase
        .from("support_tickets")
        .insert({
            user_id: userId,
            shop_id: input.shop_id ?? null,
            subject: input.subject.trim(),
            message: input.message.trim(),
            category: input.category ?? "General",
            priority: input.priority ?? "normal",
            contact_email: input.contact_email ?? null,
        })
        .select(TICKET_COLUMNS)
        .single();

    if (error) throw error;
    return data as SupportTicket;
}

export async function updateTicket(
    id: string,
    changes: SupportTicketUpdate,
): Promise<SupportTicket> {
    const userId = await currentUserId();

    const patch: Record<string, unknown> = { ...changes };
    // resolved_at is derived from status so the two cannot disagree.
    if (changes.status === "resolved") patch.resolved_at = new Date().toISOString();
    if (changes.status === "open") patch.resolved_at = null;

    const { data, error } = await supabase
        .from("support_tickets")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .select(TICKET_COLUMNS)
        .single();

    if (error) throw error;
    return data as SupportTicket;
}

export async function deleteTicket(id: string) {
    const userId = await currentUserId();
    const { error } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    if (error) throw error;
}