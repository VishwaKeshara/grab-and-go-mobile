export type SettlementBatch = {
  id: string;
  node_id: string;
  provider: string;
  batch_reference: string;
  total_amount: number;
  clearing_buffer: string;
  payout_ready_at: string | null;
  gateway_name: string;
  matched: boolean;
  generated_at: string;
  created_at: string;
};

export type NodeMetric = {
  id: string;
  node_id: string;
  service_level: string;
  route_label: string;
  detail: string;
  avg_handover_seconds: number;
  sla_hit_rate: number;
  sample_count: number;
  measured_on: string;
};

export type ManifestTone = "ink" | "amber" | "mint" | "coral" | "violet";

export type ManifestMetrics = {
  approved_substitutions?: number;
  phone_contact?: number;
  disputes?: number;
  ramis_compliant?: boolean;
  vat_rate?: number;
  actions?: string[];
};

export type ReportManifest = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  icon: string;
  tone: ManifestTone;
  file_formats: string[];
  size_label: string;
  status_label: string;
  status_tone: "good" | "warn" | "neutral";
  detail: string;
  metrics: ManifestMetrics;
  locked: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

export type DispatchSettings = {
  id: string;
  node_id: string;
  enabled: boolean;
  window_label: string;
  recipient_email: string;
  payload_label: string;
  updated_at: string;
};