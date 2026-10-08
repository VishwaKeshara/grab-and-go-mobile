-- =============================================================================
-- MEMBER 2 (Product & Shop Management) - single migration
-- Paste into Supabase -> SQL Editor -> New query -> Run. Safe to run twice.
--
-- Reuses existing tables. Creates NO duplicates of customer_shops,
-- customer_products, shop_inventory or customer_orders.
--
-- Existing tables referenced by the new ones (live schema):
--   profiles(id)              -> auth.users(id); role in customer|shop|admin
--   customer_shops(id)        -> owner is profile_id, NOT owner_id
--   customer_products(id)     -> shop_id, and the added category_id
--   customer_shops.profile_id -> profiles.id  (used for shop ownership)
--
-- Depends on public.is_admin() and public.set_updated_at(), both created by
-- the already-applied migrations 002 and 004.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Ownership helper for customer_shops. The repo's stale migration assumed an
-- owner_id column that does not exist; ownership is profile_id.
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


-- =============================================================================
-- 1. product_categories
-- =============================================================================

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default 'basket',
  tint text not null default '#171543',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_categories_listing_idx
  on public.product_categories (is_active, sort_order);

alter table public.product_categories enable row level security;

drop policy if exists "Product categories are readable when active"
  on public.product_categories;
create policy "Product categories are readable when active"
  on public.product_categories for select to authenticated
  using (is_active = true);

drop policy if exists "Admins can manage product categories"
  on public.product_categories;
create policy "Admins can manage product categories"
  on public.product_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.product_categories to authenticated;


-- =============================================================================
-- 2. customer_products.category_id  (additive, nullable, existing table)
-- =============================================================================

alter table public.customer_products
  add column if not exists category_id uuid
  references public.product_categories(id) on delete set null;

create index if not exists customer_products_category_idx
  on public.customer_products (category_id);


-- =============================================================================
-- 3. search_history
-- =============================================================================

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_idx
  on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;

drop policy if exists "Users can read their search history"
  on public.search_history;
create policy "Users can read their search history"
  on public.search_history for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can add search history" on public.search_history;
create policy "Users can add search history"
  on public.search_history for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their search history"
  on public.search_history;
create policy "Users can delete their search history"
  on public.search_history for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.search_history to authenticated;


-- =============================================================================
-- 4. favourites
-- =============================================================================

create table if not exists public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.customer_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favourites_user_idx
  on public.favourites (user_id, created_at desc);

create index if not exists favourites_product_idx
  on public.favourites (product_id);

alter table public.favourites enable row level security;

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

grant select, insert, delete on public.favourites to authenticated;


-- =============================================================================
-- 5. reviews
-- =============================================================================

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
  on public.reviews (product_id, created_at desc);

create index if not exists reviews_user_idx on public.reviews (user_id);

alter table public.reviews enable row level security;

drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable"
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

grant select, insert, update, delete on public.reviews to authenticated;


-- =============================================================================
-- 6. stock_adjustments
--    Audit trail for shop_inventory writes. customer_shop_staff grants shop
--    managers the same ownership scope as profile_id.
-- =============================================================================

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  product_id uuid not null references public.customer_products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  previous_quantity integer not null default 0,
  new_quantity integer not null default 0,
  delta integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists stock_adjustments_shop_idx
  on public.stock_adjustments (shop_id, created_at desc);

create index if not exists stock_adjustments_product_idx
  on public.stock_adjustments (product_id, created_at desc);

alter table public.stock_adjustments enable row level security;

drop policy if exists "Shop owners can read stock adjustments"
  on public.stock_adjustments;
create policy "Shop owners can read stock adjustments"
  on public.stock_adjustments for select to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()));

drop policy if exists "Shop owners can create stock adjustments"
  on public.stock_adjustments;
create policy "Shop owners can create stock adjustments"
  on public.stock_adjustments for insert to authenticated
  with check ((select public.owns_customer_shop(shop_id))
              or (select public.is_admin()));

grant select, insert, update, delete on public.stock_adjustments to authenticated;


-- =============================================================================
-- 7. reports
-- =============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  report_type text not null default 'sales'
    check (report_type in ('sales', 'stock', 'orders')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_revenue integer not null default 0 check (total_revenue >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists reports_shop_idx
  on public.reports (shop_id, created_at desc);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute procedure public.set_updated_at();

alter table public.reports enable row level security;

drop policy if exists "Shop owners can read reports" on public.reports;
create policy "Shop owners can read reports"
  on public.reports for select to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()));

drop policy if exists "Shop owners can create reports" on public.reports;
create policy "Shop owners can create reports"
  on public.reports for insert to authenticated
  with check ((select public.owns_customer_shop(shop_id))
              and created_by = (select auth.uid()));

drop policy if exists "Shop owners can delete reports" on public.reports;
create policy "Shop owners can delete reports"
  on public.reports for delete to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()));

grant select, insert, update, delete on public.reports to authenticated;


-- =============================================================================
-- 8. support_tickets
-- =============================================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid references public.customer_shops(id) on delete set null,
  subject text not null,
  category text not null default 'General'
    check (category in ('General', 'Orders', 'Payments', 'Stock', 'Account', 'Other')),
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  contact_email text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute procedure public.set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists "Users can read their own tickets" on public.support_tickets;
create policy "Users can read their own tickets"
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users can create their own tickets" on public.support_tickets;
create policy "Users can create their own tickets"
  on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own tickets" on public.support_tickets;
create policy "Users can update their own tickets"
  on public.support_tickets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own tickets" on public.support_tickets;
create policy "Users can delete their own tickets"
  on public.support_tickets for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.support_tickets to authenticated;


-- =============================================================================
-- 9. Ownership policies on EXISTING tables (additive only)
--    Only these named policies are replaced. Any other policy already on
--    customer_shops / shop_inventory is left untouched. Postgres policies are
--    permissive and OR together, so adding one can only widen access.
-- =============================================================================

drop policy if exists "Shop owners can update their own shop"
  on public.customer_shops;
create policy "Shop owners can update their own shop"
  on public.customer_shops for update to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()))
  with check (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Shop owners can manage their own inventory"
  on public.shop_inventory;
create policy "Shop owners can manage their own inventory"
  on public.shop_inventory for all to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()))
  with check ((select public.owns_customer_shop(shop_id))
              or (select public.is_admin()));

-- Product owners manage their own listings. Scoped by shop ownership, not by
-- a product column, because customer_products has no owner column.
drop policy if exists "Shop owners can manage their own products"
  on public.customer_products;
create policy "Shop owners can manage their own products"
  on public.customer_products for all to authenticated
  using ((select public.owns_customer_shop(shop_id))
         or (select public.is_admin()))
  with check ((select public.owns_customer_shop(shop_id))
              or (select public.is_admin()));

-- Support staff may read orders for a shop they belong to.
drop policy if exists "Shop owners can read their own orders"
  on public.customer_orders;
create policy "Shop owners can read their own orders"
  on public.customer_orders for select to authenticated
  using (customer_id = (select auth.uid())
         or (select public.owns_customer_shop(shop_id))
         or (select public.is_admin()));


-- =============================================================================
-- 10. Grants on EXISTING tables (additive and idempotent)
--     Grants only widen access; existing policies still decide which rows are
--     visible.
-- =============================================================================

grant usage on schema public to authenticated;

grant select on
  public.customer_shops,
  public.customer_products,
  public.shop_inventory,
  public.customer_orders,
  public.customer_order_items,
  public.customer_carts,
  public.customer_cart_items,
  public.customer_pickup_slots,
  public.customer_payments,
  public.customer_order_status_history,
  public.customer_shop_staff,
  public.shop_staff,
  public.pickup_verifications,
  public.security_events,
  public.pickup_hubs,
  public.profiles,
  public.notifications
  to authenticated;

grant insert, update, delete on
  public.customer_shops,
  public.customer_products,
  public.shop_inventory
  to authenticated;


-- =============================================================================
-- 11. Seed data for the Home screen categories
-- =============================================================================

insert into public.product_categories (name, slug, icon, tint, sort_order)
values
  ('Fruits', 'fruits', 'basket', '#EF7E69', 10),
  ('Vegetables', 'vegetables', 'basket', '#55E5BA', 20),
  ('Dairy & Chilled', 'dairy-chilled', 'basket', '#8B7BF0', 30),
  ('Pantry Staples', 'pantry-staples', 'basket', '#F6B84B', 40),
  ('Beverages', 'beverages', 'basket', '#5B7CFA', 50),
  ('Household', 'household', 'basket', '#171543', 60)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  tint = excluded.tint,
  sort_order = excluded.sort_order;


-- =============================================================================
-- 12. Reload the PostgREST schema cache
--     Without this, tables created here return
--     "Could not find the table in the database schema cache" (PGRST205).
-- =============================================================================

notify pgrst, 'reload schema';