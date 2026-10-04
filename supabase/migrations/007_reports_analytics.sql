-- Reports and Analytics: node metrics, settlement batches and export manifests.
--
-- Replaces the earlier shop-scoped reporting tables. Numbered 007 because two
-- migrations already share the 005 prefix and 006 was reverted.
--
-- Every figure on the screen is a column here rather than hardcoded UI text,
-- so operations can correct a settlement total without a code deploy.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------- settlement batches

create table if not exists public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  node_id text not null default 'Malabe Node',
  provider text not null default 'LankaPay',
  batch_reference text not null unique,
  total_amount numeric(14, 2) not null default 0,
  clearing_buffer text not null default '',
  payout_ready_at timestamptz,
  gateway_name text not null default '',
  matched boolean not null default false,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists settlement_batches_generated_idx
  on public.settlement_batches(generated_at desc);

-- ------------------------------------------------------------ node metrics

-- One row per node per day so the SLA sparkline has a history to read.
create table if not exists public.node_metrics (
  id uuid primary key default gen_random_uuid(),
  node_id text not null default 'Malabe Node',
  service_level text not null,
  route_label text not null default '',
  detail text not null default '',
  avg_handover_seconds numeric(8, 2) not null default 0,
  sla_hit_rate numeric(5, 2) not null default 0,
  sample_count integer not null default 0,
  measured_on date not null default current_date
);

create index if not exists node_metrics_node_day_idx
  on public.node_metrics(node_id, service_level, measured_on desc);

-- --------------------------------------------------------------- manifests

create table if not exists public.report_manifests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  tag text not null default '',
  icon text not null default 'doc',
  tone text not null default 'ink'
    check (tone in ('ink', 'amber', 'mint', 'coral', 'violet')),
  file_formats text[] not null default '{}',
  size_label text not null default '',
  status_label text not null default '',
  status_tone text not null default 'good'
    check (status_tone in ('good', 'warn', 'neutral')),
  detail text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  locked boolean not null default false,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists report_manifests_listing_idx
  on public.report_manifests(is_published, sort_order);

-- --------------------------------------------------------- dispatch config

create table if not exists public.dispatch_settings (
  id uuid primary key default gen_random_uuid(),
  node_id text primary key,
  enabled boolean not null default true,
  window_label text not null default '',
  recipient_email text not null default '',
  payload_label text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists dispatch_settings_set_updated_at
  on public.dispatch_settings;
create trigger dispatch_settings_set_updated_at
  before update on public.dispatch_settings
  for each row execute procedure public.set_updated_at();

-- --------------------------------------------------------------------- RLS

alter table public.settlement_batches enable row level security;
alter table public.node_metrics enable row level security;
alter table public.report_manifests enable row level security;
alter table public.dispatch_settings enable row level security;

-- Reads are open to any signed-in user so the reports screen loads; the
-- underlying figures are operational aggregates, not customer PII. Writes are
-- reserved for admins.
drop policy if exists "Authenticated users can read settlement batches"
  on public.settlement_batches;
create policy "Authenticated users can read settlement batches"
  on public.settlement_batches for select
  to authenticated
  using (true);

drop policy if exists "Admins can write settlement batches"
  on public.settlement_batches;
create policy "Admins can write settlement batches"
  on public.settlement_batches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read node metrics"
  on public.node_metrics;
create policy "Authenticated users can read node metrics"
  on public.node_metrics for select
  to authenticated
  using (true);

drop policy if exists "Admins can write node metrics" on public.node_metrics;
create policy "Admins can write node metrics"
  on public.node_metrics for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read report manifests"
  on public.report_manifests;
create policy "Authenticated users can read report manifests"
  on public.report_manifests for select
  to authenticated
  using (is_published = true);

drop policy if exists "Admins can write report manifests" on public.report_manifests;
create policy "Admins can write report manifests"
  on public.report_manifests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated users can read dispatch settings"
  on public.dispatch_settings;
create policy "Authenticated users can read dispatch settings"
  on public.dispatch_settings for select
  to authenticated
  using (true);

drop policy if exists "Admins can write dispatch settings"
  on public.dispatch_settings;
create policy "Admins can write dispatch settings"
  on public.dispatch_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.settlement_batches to authenticated;
grant select, insert, update, delete on public.node_metrics to authenticated;
grant select, insert, update, delete on public.report_manifests to authenticated;
grant select, insert, update, delete on public.dispatch_settings to authenticated;

-- ------------------------------------------------------------------- seeds

insert into public.settlement_batches
  (node_id, provider, batch_reference, total_amount, clearing_buffer,
   payout_ready_at, gateway_name, matched, generated_at)
values
  ('Malabe Node', 'LankaPay', 'Batch #992-BOC', 384200.00,
   '23:59 Payout Ready', '2026-10-24T23:59:00Z', 'Bank of Ceylon Gateway',
   true, now() - interval '2 minutes')
on conflict (batch_reference) do update set
  total_amount = excluded.total_amount,
  clearing_buffer = excluded.clearing_buffer,
  payout_ready_at = excluded.payout_ready_at,
  gateway_name = excluded.gateway_name,
  matched = excluded.matched;

-- Seven days of commuter handover telemetry so the sparkline has a trend.
insert into public.node_metrics
  (node_id, service_level, route_label, detail, avg_handover_seconds,
   sla_hit_rate, sample_count, measured_on)
values
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 36.20, 98.20, 412,
   current_date - 6),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 34.80, 97.60, 388,
   current_date - 5),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 35.40, 98.90, 401,
   current_date - 4),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 33.10, 96.80, 356,
   current_date - 3),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 37.60, 99.10, 430,
   current_date - 2),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 35.90, 98.00, 397,
   current_date - 1),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 36.20, 98.20, 412,
   current_date);

insert into public.report_manifests
  (title, subtitle, tag, icon, tone, file_formats, size_label, status_label,
   status_tone, detail, metrics, locked, sort_order)
values
  ('Merchant Payout & Settlement', 'LankaPay Clearing', 'LankaPay Clearing',
   'payout', 'ink', array['CSV', 'PDF'], '2.4MB',
   'Reconciled • 0 Discrepancies detected', 'good', '',
   '{"actions": ["download-pdf", "share-boc"]}'::jsonb, false, 10),
  ('Stock Discrepancy & Substitution', 'Inventory Quality',
   'Inventory Quality', 'stock', 'amber', array['PDF'], '1.1MB', '',
   'neutral', '',
   '{"approved_substitutions": 12, "phone_contact": 1, "disputes": 0,
     "actions": ["download-log"]}'::jsonb, false, 20),
  ('Malabe Commuter Transit & SLA', 'Ops & Telemetry', 'Ops & Telemetry',
   'transit', 'mint', array['XLSX'], '3.8MB', '',
   'neutral',
   'Rush hour pickup distribution along Kaduwela',
   '{"actions": ["download-xlsx"]}'::jsonb, false, 30),
  ('Monthly Tax & IRD VAT Compliance', 'Sri Lanka IRD', 'Sri Lanka IRD',
   'tax', 'coral', array['Encrypted PDF'], '4.2 MB', '',
   'neutral', '',
   '{"ramis_compliant": true, "vat_rate": 18, "actions": ["export-ird"]}'::jsonb,
   true, 40);

insert into public.dispatch_settings
  (node_id, enabled, window_label, recipient_email, payload_label)
values
  ('Malabe Node', true, 'Negrey 23:59 EOD Email to Operator',
   'ops-lead@malabe.platform.lk', 'Consolidated XLSX & IRD Digest')
on conflict (node_id) do update set
  enabled = excluded.enabled,
  window_label = excluded.window_label,
  recipient_email = excluded.recipient_email,
  payload_label = excluded.payload_label;