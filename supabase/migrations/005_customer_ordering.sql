-- Proposed backend schema for the local customer-ordering demo.
-- This migration is not applied by the mobile app. Order creation, pricing,
-- payment updates, and shop status changes should run through a trusted backend.

create table if not exists public.customer_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  pickup_counter text not null,
  preparation_minutes integer not null default 25 check (preparation_minutes > 0),
  active boolean not null default true
);

create table if not exists public.customer_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id),
  name text not null,
  unit text not null,
  price_lkr integer not null check (price_lkr >= 0),
  regular_price_lkr integer not null check (regular_price_lkr >= 0),
  image_url text,
  active boolean not null default true
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  shop_id uuid not null references public.customer_shops(id),
  checkout_id text not null,
  reference text not null unique,
  pickup_pin text not null,
  status text not null default 'placed' check (status in ('placed', 'accepted', 'packing', 'ready', 'collected', 'cancelled')),
  payment_method text not null check (payment_method in ('wallet', 'card', 'pickup')),
  payment_status text not null check (payment_status in ('paid', 'pay_at_pickup', 'failed')),
  customer_name text not null,
  customer_phone text not null,
  packing_instructions text not null default '',
  travel_method text not null check (travel_method in ('walking', 'motorcycle', 'car')),
  pickup_start_at timestamptz not null,
  pickup_end_at timestamptz not null,
  subtotal_lkr integer not null check (subtotal_lkr >= 0),
  savings_lkr integer not null default 0 check (savings_lkr >= 0),
  service_fee_lkr integer not null default 0 check (service_fee_lkr >= 0),
  total_lkr integer not null check (total_lkr >= 0),
  created_at timestamptz not null default now(),
  unique (customer_id, checkout_id),
  check (pickup_end_at > pickup_start_at)
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.customer_products(id),
  product_name text not null,
  product_unit text not null,
  image_url text,
  quantity integer not null check (quantity > 0),
  unit_price_lkr integer not null check (unit_price_lkr >= 0),
  substitution jsonb not null default '{"type":"call"}'::jsonb
);

create index if not exists customer_products_shop_idx on public.customer_products(shop_id);
create index if not exists customer_orders_customer_created_idx on public.customer_orders(customer_id, created_at desc);
create index if not exists customer_order_items_order_idx on public.customer_order_items(order_id);

alter table public.customer_shops enable row level security;
alter table public.customer_products enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;

create policy "Customers can view active shops" on public.customer_shops
  for select to authenticated using (active);
create policy "Customers can view active products" on public.customer_products
  for select to authenticated using (active);
create policy "Customers can view their orders" on public.customer_orders
  for select to authenticated using (customer_id = (select auth.uid()));
create policy "Customers can view their order items" on public.customer_order_items
  for select to authenticated using (
    exists (select 1 from public.customer_orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );

grant select on public.customer_shops, public.customer_products, public.customer_orders, public.customer_order_items to authenticated;
