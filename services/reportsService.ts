import { supabase } from "@/lib/supabase";
import type {
  DispatchSettings,
  NodeMetric,
  ReportManifest,
  SettlementBatch,
} from "@/types/reports";

const BATCH_COLUMNS =
  "id, node_id, provider, batch_reference, total_amount, clearing_buffer, payout_ready_at, gateway_name, matched, generated_at, created_at";

const METRIC_COLUMNS =
  "id, node_id, service_level, route_label, detail, avg_handover_seconds, sla_hit_rate, sample_count, measured_on";

const MANIFEST_COLUMNS =
  "id, title, subtitle, tag, icon, tone, file_formats, size_label, status_label, status_tone, detail, metrics, locked, sort_order, is_published, created_at";

/** PostgREST returns `numeric` as a string, so normalise money and ratios. */
function toBatch(row: Record<string, unknown>): SettlementBatch {
  return {
    ...(row as unknown as SettlementBatch),
    total_amount: Number(row.total_amount ?? 0),
  };
}

function toMetric(row: Record<string, unknown>): NodeMetric {
  return {
    ...(row as unknown as NodeMetric),
    avg_handover_seconds: Number(row.avg_handover_seconds ?? 0),
    sla_hit_rate: Number(row.sla_hit_rate ?? 0),
    sample_count: Number(row.sample_count ?? 0),
  };
}

/** Latest settlement batch for the node, which drives the hero card. */
export async function getLatestSettlementBatch(
  nodeId = "Malabe Node",
): Promise<SettlementBatch | null> {
  const { data, error } = await supabase
    .from("settlement_batches")
    .select(BATCH_COLUMNS)
    .eq("node_id", nodeId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toBatch(data) : null;
}

/**
 * Telemetry history for the SLA sparkline, oldest first so the caller can
 * plot it left-to-right without reversing.
 */
export async function listNodeMetrics(
  nodeId = "Malabe Node",
  serviceLevel = "queue-bypass",
  limit = 7,
): Promise<NodeMetric[]> {
  const { data, error } = await supabase
    .from("node_metrics")
    .select(METRIC_COLUMNS)
    .eq("node_id", nodeId)
    .eq("service_level", serviceLevel)
    .order("measured_on", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(toMetric).reverse();
}

export async function listReportManifests(): Promise<ReportManifest[]> {
  const { data, error } = await supabase
    .from("report_manifests")
    .select(MANIFEST_COLUMNS)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReportManifest[];
}

export async function getDispatchSettings(
  nodeId = "Malabe Node",
): Promise<DispatchSettings | null> {
  const { data, error } = await supabase
    .from("dispatch_settings")
    .select("id, node_id, enabled, window_label, recipient_email, payload_label, updated_at")
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error) throw error;
  return data as DispatchSettings | null;
}

/**
 * Toggles the nightly dispatch email. Writes are admin-only under RLS, so this
 * rejects for non-admin sessions rather than silently failing.
 */
export async function setDispatchEnabled(
  nodeId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("dispatch_settings")
    .update({ enabled })
    .eq("node_id", nodeId);

  if (error) throw error;
}