-- Member 2 (Product & Shop Management) tables that are uniquely ours.
--
-- Shops and products are NOT created here: the team already owns
-- customer_shops / customer_products / shop_inventory, so this migration
-- reuses them instead of duplicating them. Numbered 008 because these tables
-- have foreign keys into customer_products, and the team's
-- 005_customer_ordering.sql must be applied first (Supabase orders migrations
-- by filename, so 005_catalog... would otherwise run too early and fail).
--
-- This supersedes the earlier 005_catalog_reviews_favourites_search_reports.sql
-- and 007_reports_analytics.sql, which are removed because they defined
-- duplicate shops/products tables.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- reviews

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.customer_products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists reviews_product_idx
  on public.reviews(product_id, created_at desc);
create index if not exists reviews_user_idx on public.reviews(user_id);

-- ------------------------------------------------------------ favourites

create table if not exists public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.customer_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favourites_user_idx
  on public.favourites(user_id, created_at desc);

-- ------------------------------------------------------- search history

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_idx
  on public.search_history(user_id, created_at desc);

-- --------------------------------------------------------------- reports

-- Saved report snapshots for a shop. Figures are copied at generation time
-- so the report reads back exactly as it was generated.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  report_type text not null default 'sales'
    check (report_type in ('sales', 'stock', 'orders')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_orders integer not null default 0,
  total_revenue integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_shop_idx
  on public.reports(shop_id, created_at desc);

-- ------------------------------------------------------- settlement batch

create table if not exists public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  node_id text not null default 'Malabe Node',
  provider text not null default 'LankaPay',
  batch_reference text not null unique,
  total_amount integer not null default 0 check (total_amount >= 0),
  clearing_buffer text not null default '',
  payout_ready_at timestamptz,
  gateway_name text not null default '',
  matched boolean not null default false,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists settlement_batches_generated_idx
  on public.settlement_batches(generated_at desc);

-- ---------------------------------------------------------- node metrics

-- One row per node per day so the SLA sparkline has a history to read.
create table if not exists public.node_metrics (
  id uuid primary key default gen_random_uuid(),
  node_id text not null default 'Malabe Node',
  service_level text not null default 'queue-bypass',
  route_label text not null default '',
  detail text not null default '',
  avg_handover_seconds numeric(8, 2) not null default 0,
  sla_hit_rate numeric(5, 2) not null default 0,
  sample_count integer not null default 0,
  measured_on date not null default current_date
);

create index if not exists node_metrics_node_day_idx
  on public.node_metrics(node_id, service_level, measured_on desc);

-- ------------------------------------------------------- report manifests

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

-- ------------------------------------------------------- dispatch config

create table if not exists public.dispatch_settings (
  id uuid primary key default gen_random_uuid(),
  node_id text not null unique,
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

-- ------------------------------------------------------------------- RLS

-- Ownership helper for the team's customer_shops table. Defined before the
-- policies because PostgreSQL resolves the function reference when the policy
-- is created. customer_shops.profile_id is what ties a shop to its owner.
create or replace function public.owns_customer_shop(target_shop_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.customer_shops
    where id = target_shop_id and profile_id = (select auth.uid())
  );
$$;

grant execute on function public.owns_customer_shop(uuid) to authenticated;

alter table public.reviews enable row level security;
alter table public.favourites enable row level security;
alter table public.search_history enable row level security;
alter table public.reports enable row level security;
alter table public.settlement_batches enable row level security;
alter table public.node_metrics enable row level security;
alter table public.report_manifests enable row level security;
alter table public.dispatch_settings enable row level security;

-- Reviews are readable by any signed-in user; writable only by the author.
drop policy if exists "Authenticated users can read reviews" on public.reviews;
create policy "Authenticated users can read reviews"
  on public.reviews for select to authenticated using (true);

drop policy if exists "Users can create their own review" on public.reviews;
create policy "Users can create their own review"
  on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own review" on public.reviews;
create policy "Users can update their own review"
  on public.reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own review" on public.reviews;
create policy "Users can delete their own review"
  on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()));

-- Favourites and search history are strictly owner scoped.
drop policy if exists "Users can read their favourites" on public.favourites;
create policy "Users can read their favourites"
  on public.favourites for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add favourites" on public.favourites;
create policy "Users can add favourites"
  on public.favourites for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their favourites" on public.favourites;
create policy "Users can delete their favourites"
  on public.favourites for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their search history" on public.search_history;
create policy "Users can read their search history"
  on public.search_history for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add search history" on public.search_history;
create policy "Users can add search history"
  on public.search_history for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their search history" on public.search_history;
create policy "Users can delete their search history"
  on public.search_history for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reports belong to the shop that owns them.
drop policy if exists "Shop owners can read reports" on public.reports;
create policy "Shop owners can read reports"
  on public.reports for select to authenticated
  using (public.owns_customer_shop(shop_id) or public.is_admin());

drop policy if exists "Shop owners can create reports" on public.reports;
create policy "Shop owners can create reports"
  on public.reports for insert to authenticated
  with check (
    public.owns_customer_shop(shop_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Shop owners can delete reports" on public.reports;
create policy "Shop owners can delete reports"
  on public.reports for delete to authenticated
  using (public.owns_customer_shop(shop_id) or public.is_admin());

-- Operations aggregates: readable by any signed-in user, writable by admins.
drop policy if exists "Authenticated users can read settlement batches"
  on public.settlement_batches;
create policy "Authenticated users can read settlement batches"
  on public.settlement_batches for select to authenticated using (true);

drop policy if exists "Admins can write settlement batches"
  on public.settlement_batches;
create policy "Admins can write settlement batches"
  on public.settlement_batches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read node metrics" on public.node_metrics;
create policy "Authenticated users can read node metrics"
  on public.node_metrics for select to authenticated using (true);

drop policy if exists "Admins can write node metrics" on public.node_metrics;
create policy "Admins can write node metrics"
  on public.node_metrics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read report manifests"
  on public.report_manifests;
create policy "Authenticated users can read report manifests"
  on public.report_manifests for select to authenticated
  using (is_published = true);

drop policy if exists "Admins can write report manifests" on public.report_manifests;
create policy "Admins can write report manifests"
  on public.report_manifests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read dispatch settings"
  on public.dispatch_settings;
create policy "Authenticated users can read dispatch settings"
  on public.dispatch_settings for select to authenticated using (true);

drop policy if exists "Admins can write dispatch settings" on public.dispatch_settings;
create policy "Admins can write dispatch settings"
  on public.dispatch_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, delete on public.favourites to authenticated;
grant select, insert, delete on public.search_history to authenticated;
grant select, insert, delete on public.reports to authenticated;
grant select, insert, update, delete on public.settlement_batches to authenticated;
grant select, insert, update, delete on public.node_metrics to authenticated;
grant select, insert, update, delete on public.report_manifests to authenticated;
grant select, insert, update, delete on public.dispatch_settings to authenticated;

-- ------------------------------------------------------------------ seeds

-- Seeded from the figures on the Reports and Analytics screen so the cards
-- are populated on first run. Ids are fixed so re-running is a no-op.
insert into public.settlement_batches
  (node_id, provider, batch_reference, total_amount, clearing_buffer,
   payout_ready_at, gateway_name, matched, generated_at)
values
  ('Malabe Node', 'LankaPay', 'Batch #992-BOC', 384200,
   '23:59 Payout Ready', '2026-10-24T23:59:00Z', 'Bank of Ceylon Gateway',
   true, now() - interval '2 minutes')
on conflict (batch_reference) do update set
  total_amount = excluded.total_amount,
  clearing_buffer = excluded.clearing_buffer,
  payout_ready_at = excluded.payout_ready_at,
  gateway_name = excluded.gateway_name,
  matched = excluded.matched,
  generated_at = excluded.generated_at;

insert into public.node_metrics
  (node_id, service_level, route_label, detail, avg_handover_seconds,
   sla_hit_rate, sample_count, measured_on)
values
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 36.20, 98.20, 412, current_date - 6),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 34.80, 97.60, 388, current_date - 5),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 35.40, 98.90, 401, current_date - 4),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 33.10, 96.80, 356, current_date - 3),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 37.60, 99.10, 430, current_date - 2),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 35.90, 98.00, 397, current_date - 1),
  ('Malabe Node', 'queue-bypass', 'Malabe Junction to SLITI Arc',
   'Rush hour peak: 29m handover', 36.20, 98.20, 412, current_date);

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

-- Tables created through the SQL Editor are invisible to PostgREST until the
-- schema cache is reloaded. Without this, queries return
-- "Could not find the table in the schema cache" (PGRST205).
notify pgrst, 'reload schema';