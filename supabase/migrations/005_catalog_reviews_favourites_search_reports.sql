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