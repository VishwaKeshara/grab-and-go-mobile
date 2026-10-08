-- Member 2 additions: categories, featured items, stock adjustment log and
-- support tickets.
--
-- Numbered 009 so it runs after 005_customer_ordering.sql (which creates
-- customer_shops / customer_products) and 008_member2_..._reports.sql.
--
-- The only change to another member's table is the additive
-- category_id column below. It is nullable with no default, so existing rows
-- are untouched and any team query that ignores it keeps working.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------- categories

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
  on public.product_categories(is_active, sort_order);

-- Additive, nullable, no default: safe for existing rows and for team code.
alter table public.customer_products
  add column if not exists category_id uuid
  references public.product_categories(id) on delete set null;

create index if not exists customer_products_category_idx
  on public.customer_products(category_id);

-- ---------------------------------------------------------- featured items

-- The Home screen's featured rail. Held here rather than as a boolean on
-- customer_products so that table stays untouched beyond category_id.
create table if not exists public.featured_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.customer_products(id) on delete cascade,
  headline text not null default '',
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists featured_products_listing_idx
  on public.featured_products(is_active, sort_order);

-- -------------------------------------------------- stock adjustment log

-- One row per quantity change made in Stock Update, so a shop can see who
-- changed what and why rather than only the current number.
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  product_id uuid not null references public.customer_products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  previous_quantity integer not null,
  new_quantity integer not null,
  delta integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists stock_adjustments_shop_idx
  on public.stock_adjustments(shop_id, created_at desc);
create index if not exists stock_adjustments_product_idx
  on public.stock_adjustments(product_id, created_at desc);

-- ---------------------------------------------------------- support tickets

-- Help & Support ticket CRUD. status and category are free text rather than
-- enums so the team can add values without another migration.
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
  on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets(status, created_at desc);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------------- RLS

alter table public.product_categories enable row level security;
alter table public.featured_products enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.support_tickets enable row level security;

-- Categories and featured items are read-only catalogue data for the client.
drop policy if exists "Authenticated users can read product categories"
  on public.product_categories;
create policy "Authenticated users can read product categories"
  on public.product_categories for select to authenticated
  using (is_active = true);

drop policy if exists "Admins can write product categories"
  on public.product_categories;
create policy "Admins can write product categories"
  on public.product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read featured products"
  on public.featured_products;
create policy "Authenticated users can read featured products"
  on public.featured_products for select to authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "Admins can write featured products"
  on public.featured_products;
create policy "Admins can write featured products"
  on public.featured_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Stock adjustments: a shop sees its own history, admins see everything.
drop policy if exists "Shop owners can read stock adjustments"
  on public.stock_adjustments;
create policy "Shop owners can read stock adjustments"
  on public.stock_adjustments for select to authenticated
  using (public.owns_customer_shop(shop_id) or public.is_admin());

drop policy if exists "Shop owners can create stock adjustments"
  on public.stock_adjustments;
create policy "Shop owners can create stock adjustments"
  on public.stock_adjustments for insert to authenticated
  with check (public.owns_customer_shop(shop_id) or public.is_admin());

-- Tickets are private to the person who raised them.
drop policy if exists "Users can read their tickets" on public.support_tickets;
create policy "Users can read their tickets"
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users can create their tickets" on public.support_tickets;
create policy "Users can create their tickets"
  on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their tickets" on public.support_tickets;
create policy "Users can update their tickets"
  on public.support_tickets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their tickets" on public.support_tickets;
create policy "Users can delete their tickets"
  on public.support_tickets for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.featured_products to authenticated;
grant select, insert, update, delete on public.stock_adjustments to authenticated;
grant select, insert, update, delete on public.support_tickets to authenticated;

-- ------------------------------------------------------------------ seeds

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

-- Point any pre-existing products at a category where the unit makes it
-- unambiguous, and feature the first four. No-ops on an empty catalogue.
insert into public.featured_products (product_id, headline, sort_order)
select id, name, 10
from public.customer_products
where lower(unit) = 'kg'
order by name
limit 4
on conflict (product_id) do update set
  headline = excluded.headline,
  sort_order = excluded.sort_order;

-- Tables created through the SQL Editor stay invisible to PostgREST until the
-- schema cache is reloaded (otherwise queries fail with PGRST205).
notify pgrst, 'reload schema';