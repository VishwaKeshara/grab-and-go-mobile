import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/services/productService";

export type ReportType = "sales" | "stock" | "orders";

export type Report = {
  id: string;
  shop_id: string;
  created_by: string;
  title: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  total_orders: number;
  total_revenue: number;
  payload: Record<string, unknown>;
  created_at: string;
};

const REPORT_COLUMNS =
  "id, shop_id, created_by, title, report_type, period_start, period_end, total_orders, total_revenue, payload, created_at";

/** PostgREST returns `numeric` as a string. */
function toReport(row: Record<string, unknown>): Report {
  return {
    ...(row as unknown as Report),
    total_orders: Number(row.total_orders ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

export async function listReports(shopId: string): Promise<Report[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toReport);
}

/**
 * Generates a report by aggregating the shop's own product rows over the
 * window, then persisting the snapshot so it can be read back later.
 */
export async function generateReport(input: {
  shopId: string;
  title: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
}): Promise<Report> {
  const userId = await currentUserId();

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, price, stock_quantity, is_available, category")
    .eq("shop_id", input.shopId);

  if (productError) throw productError;

  const rows = products ?? [];
  const inventoryValue = rows.reduce(
    (sum, row) => sum + Number(row.price) * Number(row.stock_quantity),
    0,
  );
  const lowStock = rows
    .filter((row) => Number(row.stock_quantity) <= 5)
    .map((row) => ({
      name: row.name as string,
      stock_quantity: Number(row.stock_quantity),
    }));
  const byCategory = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.category as string;
    acc[key] = (acc[key] ?? 0) + Number(row.stock_quantity);
    return acc;
  }, {});

  const { data, error } = await supabase
    .from("reports")
    .insert({
      shop_id: input.shopId,
      created_by: userId,
      title: input.title.trim(),
      report_type: input.reportType,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      total_orders: rows.length,
      total_revenue: inventoryValue,
      payload: {
        product_count: rows.length,
        inventory_value: inventoryValue,
        low_stock: lowStock,
        units_by_category: byCategory,
      },
    })
    .select(REPORT_COLUMNS)
    .single();

  if (error) throw error;
  return toReport(data);
}

export async function deleteReport(id: string) {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw error;
}