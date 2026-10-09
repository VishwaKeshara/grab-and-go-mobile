-- =============================================================================
-- 011 - Public read access for product search
--
-- /search must work before a customer signs in, so the catalogue tables are
-- granted to the `anon` role and given read-only RLS policies.
--
-- WHY THIS FILE IS WRITTEN WITH to_regclass() GUARDS
-- A previous version of this file touched public.featured_products directly.
-- That table is only created by migration 009, which was never applied, so the
-- script aborted on that line -- BEFORE reaching the `grant` statements at the
-- bottom. Nothing was granted, which is why /search kept failing with
--   permission denied for table customer_products  (42501)
-- Every table below is now guarded, so a missing table is skipped with a notice
-- instead of killing the whole script. Re-running this file is safe.
--
-- Read-only: anon gets SELECT and nothing else, so the catalogue is browsable
-- publicly but cannot be modified without an account.
-- =============================================================================


-- 1. customer_shops -------------------------------------------------------------
do $$
begin
  if to_regclass('public.customer_shops') is not null then
    execute 'alter table public.customer_shops enable row level security';
    execute 'grant select on public.customer_shops to anon, authenticated';

    execute 'drop policy if exists "Public can view active shops" on public.customer_shops';
    execute 'create policy "Public can view active shops"
               on public.customer_shops for select to anon
               using (active = true)';

    -- A policy `to anon` does not apply to signed-in users, so they need their
    -- own or RLS would return zero rows once you sign in.
    execute 'drop policy if exists "Members can view shops" on public.customer_shops';
    execute 'create policy "Members can view shops"
               on public.customer_shops for select to authenticated
               using (true)';
  else
    raise notice 'customer_shops: table missing, skipped';
  end if;
end $$;


-- 2. customer_products ---------------------------------------------------------
do $$
begin
  if to_regclass('public.customer_products') is not null then
    execute 'alter table public.customer_products enable row level security';
    execute 'grant select on public.customer_products to anon, authenticated';

    execute 'drop policy if exists "Public can view active products" on public.customer_products';
    execute 'create policy "Public can view active products"
               on public.customer_products for select to anon
               using (active = true)';

    execute 'drop policy if exists "Members can view products" on public.customer_products';
    execute 'create policy "Members can view products"
               on public.customer_products for select to authenticated
               using (true)';
  else
    raise notice 'customer_products: table missing, skipped';
  end if;
end $$;


-- 3. product_categories (Home screen category rail) ----------------------------
do $$
begin
  if to_regclass('public.product_categories') is not null then
    execute 'alter table public.product_categories enable row level security';
    execute 'grant select on public.product_categories to anon, authenticated';

    execute 'drop policy if exists "Public can view active categories" on public.product_categories';
    execute 'create policy "Public can view active categories"
               on public.product_categories for select to anon
               using (is_active = true)';

    execute 'drop policy if exists "Members can view categories" on public.product_categories';
    execute 'create policy "Members can view categories"
               on public.product_categories for select to authenticated
               using (true)';
  else
    raise notice 'product_categories: table missing, skipped';
  end if;
end $$;


-- 4. reviews -------------------------------------------------------------------
do $$
begin
  if to_regclass('public.reviews') is not null then
    execute 'alter table public.reviews enable row level security';
    execute 'grant select on public.reviews to anon, authenticated';

    execute 'drop policy if exists "Public can view reviews" on public.reviews';
    execute 'create policy "Public can view reviews"
               on public.reviews for select to anon
               using (true)';

    execute 'drop policy if exists "Members can view reviews" on public.reviews';
    execute 'create policy "Members can view reviews"
               on public.reviews for select to authenticated
               using (true)';
  else
    raise notice 'reviews: table missing, skipped';
  end if;
end $$;


-- 5. featured_products ---------------------------------------------------------
-- Only exists once migration 009 has been applied. Skipped until then.
do $$
begin
  if to_regclass('public.featured_products') is not null then
    execute 'alter table public.featured_products enable row level security';
    execute 'grant select on public.featured_products to anon, authenticated';

    execute 'drop policy if exists "Public can view active featured products" on public.featured_products';
    execute 'create policy "Public can view active featured products"
               on public.featured_products for select to anon
               using (
                 is_active = true
                 and (starts_at is null or starts_at <= now())
                 and (ends_at is null or ends_at >= now())
               )';

    execute 'drop policy if exists "Members can view featured products" on public.featured_products';
    execute 'create policy "Members can view featured products"
               on public.featured_products for select to authenticated
               using (true)';
  else
    raise notice 'featured_products: table missing (run migration 009), skipped';
  end if;
end $$;


-- PostgREST caches the schema and privileges, so the API keeps serving the old
-- 42501 until it is told to reload.
notify pgrst, 'reload schema';


-- =============================================================================
-- VERIFY - every table used by /search should show anon_ok = t and auth_ok = t
-- =============================================================================
select c.relname                                        as table_name,
       has_table_privilege('anon',         c.oid, 'select') as anon_ok,
       has_table_privilege('authenticated', c.oid, 'select') as auth_ok,
       c.relrowsecurity                                  as rls_on
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('customer_shops', 'customer_products', 'product_categories', 'reviews')
order by c.relname;
