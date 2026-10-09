-- ============================================================================
--  RUN THIS WHOLE FILE IN SUPABASE -> SQL EDITOR -> New query -> Run
--
--  Contains migrations 003, 005_catalog and 007.
--  Safe to run more than once (all statements are IF NOT EXISTS / DROP IF EXISTS).
--
--  Skipped on purpose:
--    001_initial_schema.sql  - empty file
--    002 / 004               - already applied (profiles, pickup_hubs, notifications exist)
--    005_customer_ordering.sql - another member's tables; run separately if needed
-- ============================================================================

-- ======================== supabase\migrations\003_lock_profile_privileges.sql ========================
revoke update on public.profiles from authenticated;

grant update (full_name, phone, onboarding_seen, preferred_pickup_hub_id)
  on public.profiles to authenticated;

-- ======================== supabase\migrations\005_catalog_reviews_favourites_search_reports.sql ========================
-- Shops, products, reviews, favourites, search history and reports.
-- Follows the existing conventions in 002/004: lowercase sql, RLS enabled,
-- explicit policies, and trailing grants to authenticated.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- shops

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text not null default '',
  category text not null default 'Grocery',
  address text not null default '',
  phone text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops(owner_id);
create index if not exists shops_name_idx on public.shops using btree (lower(name));

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
  before update on public.shops
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------- products

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null default 'General',
  unit text not null default 'pc',
  price numeric(10, 2) not null default 0 check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_shop_idx on public.products(shop_id);
create index if not exists products_category_idx on public.products(lower(category));
create index if not exists products_price_idx on public.products(price);
create index if not exists products_name_idx on public.products using btree (lower(name));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------- reviews

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists reviews_product_idx
  on public.reviews(product_id, created_at desc);
create index if not exists reviews_user_idx on public.reviews(user_id);

-- ----------------------------------------------------------- favourites

create table if not exists public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
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

-- -------------------------------------------------------------- reports

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  report_type text not null default 'sales'
    check (report_type in ('sales', 'stock', 'orders')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_orders integer not null default 0,
  total_revenue numeric(12, 2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_shop_idx
  on public.reports(shop_id, created_at desc);

-- --------------------------------------------------- ownership helpers

create or replace function public.owns_shop(target_shop_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.shops
    where id = target_shop_id and owner_id = (select auth.uid())
  );
$$;

-- ------------------------------------------------------------------ RLS

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.favourites enable row level security;
alter table public.search_history enable row level security;
alter table public.reports enable row level security;

-- shops: everyone signed in can browse; owners manage their own.
drop policy if exists "Authenticated users can read active shops" on public.shops;
create policy "Authenticated users can read active shops"
  on public.shops for select
  to authenticated
  using (is_active = true or owner_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users can create their own shop" on public.shops;
create policy "Users can create their own shop"
  on public.shops for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their own shop" on public.shops;
create policy "Owners can update their own shop"
  on public.shops for update
  to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Owners can delete their own shop" on public.shops;
create policy "Owners can delete their own shop"
  on public.shops for delete
  to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- products: readable when the parent shop is active; owners write.
drop policy if exists "Authenticated users can read available products" on public.products;
create policy "Authenticated users can read available products"
  on public.products for select
  to authenticated
  using (
    is_available = true
    or public.owns_shop(shop_id)
    or public.is_admin()
  );

drop policy if exists "Shop owners can create products" on public.products;
create policy "Shop owners can create products"
  on public.products for insert
  to authenticated
  with check (public.owns_shop(shop_id));

drop policy if exists "Shop owners can update products" on public.products;
create policy "Shop owners can update products"
  on public.products for update
  to authenticated
  using (public.owns_shop(shop_id) or public.is_admin())
  with check (public.owns_shop(shop_id) or public.is_admin());

drop policy if exists "Shop owners can delete products" on public.products;
create policy "Shop owners can delete products"
  on public.products for delete
  to authenticated
  using (public.owns_shop(shop_id) or public.is_admin());

-- reviews: readable by all signed-in users, writable by the author.
drop policy if exists "Authenticated users can read reviews" on public.reviews;
create policy "Authenticated users can read reviews"
  on public.reviews for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own review" on public.reviews;
create policy "Users can create their own review"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own review" on public.reviews;
create policy "Users can update their own review"
  on public.reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own review" on public.reviews;
create policy "Users can delete their own review"
  on public.reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- favourites: strictly owner scoped.
drop policy if exists "Users can read their favourites" on public.favourites;
create policy "Users can read their favourites"
  on public.favourites for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add favourites" on public.favourites;
create policy "Users can add favourites"
  on public.favourites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their favourites" on public.favourites;
create policy "Users can delete their favourites"
  on public.favourites for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- search history: strictly owner scoped.
drop policy if exists "Users can read their search history" on public.search_history;
create policy "Users can read their search history"
  on public.search_history for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add search history" on public.search_history;
create policy "Users can add search history"
  on public.search_history for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their search history" on public.search_history;
create policy "Users can delete their search history"
  on public.search_history for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- reports: shop owners only.
drop policy if exists "Shop owners can read reports" on public.reports;
create policy "Shop owners can read reports"
  on public.reports for select
  to authenticated
  using (public.owns_shop(shop_id) or public.is_admin());

drop policy if exists "Shop owners can create reports" on public.reports;
create policy "Shop owners can create reports"
  on public.reports for insert
  to authenticated
  with check (
    public.owns_shop(shop_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Shop owners can delete reports" on public.reports;
create policy "Shop owners can delete reports"
  on public.reports for delete
  to authenticated
  using (public.owns_shop(shop_id) or public.is_admin());

grant execute on function public.owns_shop(uuid) to authenticated;

grant select, insert, update, delete on public.shops to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, delete on public.favourites to authenticated;
grant select, insert, delete on public.search_history to authenticated;
grant select, insert, delete on public.reports to authenticated;

-- ------------------------------------------------------------ seed data

with seeded_shops (id, name, description, category, address, phone) as (
  values
    ('11111111-1111-4111-8111-111111111111',
     'Malabe Bazaar Mart',
     'Everyday groceries and fresh produce from the Malabe Bazaar Hub.',
     'Grocery',
     'Kaduwela Road, Opposite SLIIT Junction',
     '0771234567'),
    ('22222222-2222-4222-8222-222222222222',
     'Lanka Fresh Farms',
     'Locally sourced vegetables, fruit and dairy delivery daily.',
     'Fresh Produce',
     'Pettah Market Complex, Colombo 10',
     '0772345678'),
    ('33333333-3333-4333-8333-333333333333',
     'Pittugala Super Mart',
     'Packaged goods, snacks, beverages and household essentials.',
     'Supermarket',
     'Chandrika Kumaratunga Mawatha, Pittugala',
     '0773456789')
)
insert into public.shops (id, name, description, category, address, phone)
select id, name, description, category, address, phone from seeded_shops
on conflict (id) do nothing;

with seeded_products (id, shop_id, name, description, category, unit, price, stock_quantity) as (
  values
    ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
     'Red Apples', 'Crisp Washington apples, imported weekly.', 'Fruits', 'kg', 890.00, 45),
    ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
     'Basmati Rice', 'Premium long grain basmati rice, 5kg pack.', 'Grocery', 'pack', 1450.00, 30),
    ('a3333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
     'Full Cream Milk', 'Fresh full cream milk, 1 litre pack.', 'Dairy', 'pack', 380.00, 60),
    ('a4444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222',
     'Tomatoes', 'Locally grown vine tomatoes.', 'Vegetables', 'kg', 320.00, 25),
    ('a5555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333',
     'Cola 1.5L', 'Chilled carbonated soft drink.', 'Beverages', 'bottle', 420.00, 80),
    ('a6666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333',
     'Detergent Powder', '2kg laundry detergent.', 'Household', 'pack', 1150.00, 18)
)
insert into public.products
  (id, shop_id, name, description, category, unit, price, stock_quantity)
select id, shop_id, name, description, category, unit, price, stock_quantity
from seeded_products
on conflict (id) do nothing;

-- ======================== supabase\migrations\007_reports_analytics.sql ========================
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
   'Reconciled â€¢ 0 Discrepancies detected', 'good', '',
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

