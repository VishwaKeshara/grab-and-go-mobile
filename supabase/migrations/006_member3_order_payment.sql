-- Member 3 ordering backend. Apply after 005_customer_ordering.sql.
-- All customer mutations run through authenticated RPCs; the mobile app uses a publishable key.

alter table public.customer_shops
  -- Some projects already have this column and its ON DELETE SET NULL FK.
  -- Keep the existing column, data, and FK when present.
  add column if not exists hub_id uuid references public.pickup_hubs(id),
  add column timezone text not null default 'Asia/Colombo',
  add column pickup_open time not null default time '09:00',
  add column pickup_close time not null default time '19:30',
  add column pickup_interval_minutes integer not null default 30,
  add column max_orders_per_slot integer not null default 6;
alter table public.customer_shops
  add constraint customer_shops_pickup_settings_check
  check (pickup_open < pickup_close and pickup_interval_minutes between 5 and 120
    and max_orders_per_slot > 0);

alter table public.customer_products
  add column available boolean not null default true,
  add column stock_quantity integer not null default 0,
  add column substitute_for uuid references public.customer_products(id);
alter table public.customer_products
  add constraint customer_products_stock_check check (stock_quantity >= 0);
create index customer_products_substitute_idx
  on public.customer_products(substitute_for);

create table public.customer_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  shop_id uuid references public.customer_shops(id),
  updated_at timestamptz not null default now()
);
create table public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.customer_carts(id) on delete cascade,
  product_id uuid not null references public.customer_products(id),
  quantity integer not null check (quantity between 1 and 99),
  substitution jsonb not null default '{"type":"call"}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id),
  check (substitution->>'type' in ('call', 'none', 'alternative'))
);
create index customer_cart_items_product_idx on public.customer_cart_items(product_id);

-- Slots are materialized on demand from the shop schedule. Staff can close a slot
-- by setting is_available=false, or lower its capacity without changing app code.
create table public.customer_pickup_slots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  slot_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('scheduled', 'express')),
  capacity integer not null check (capacity > 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, starts_at, mode),
  check (ends_at > starts_at)
);
create index customer_pickup_slots_shop_date_idx
  on public.customer_pickup_slots(shop_id, slot_date, starts_at);

alter table public.customer_orders drop constraint customer_orders_payment_status_check;
alter table public.customer_orders
  add constraint customer_orders_payment_status_check
  check (payment_status in ('paid', 'pay_at_pickup', 'failed', 'demo_unpaid'));
alter table public.customer_orders
  add column pickup_slot_id uuid references public.customer_pickup_slots(id),
  add column pickup_mode text not null default 'scheduled';
alter table public.customer_orders
  add constraint customer_orders_pickup_mode_check
  check (pickup_mode in ('scheduled', 'express'));
create index customer_orders_shop_slot_idx
  on public.customer_orders(shop_id, pickup_start_at)
  where status <> 'cancelled';

alter table public.customer_order_items
  add column regular_price_lkr integer not null default 0;
alter table public.customer_order_items
  add constraint customer_order_items_regular_price_check
  check (regular_price_lkr >= 0);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.customer_orders(id) on delete cascade,
  method text not null check (method in ('wallet', 'card', 'pickup')),
  status text not null check (status in ('paid', 'pay_at_pickup', 'failed', 'demo_unpaid')),
  amount_lkr integer not null check (amount_lkr >= 0),
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  check (status <> 'paid' or (provider is not null and provider_reference is not null))
);

create table public.customer_order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  previous_status text check (previous_status in
    ('placed', 'accepted', 'packing', 'ready', 'collected', 'cancelled')),
  status text not null check (status in
    ('placed', 'accepted', 'packing', 'ready', 'collected', 'cancelled')),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index customer_order_status_history_order_idx
  on public.customer_order_status_history(order_id, changed_at);

-- The shop module has no live staff table yet; this assignment uses its existing
-- profiles.role='shop' authentication and can be reused by that module later.
create table public.customer_shop_staff (
  shop_id uuid not null references public.customer_shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (shop_id, user_id)
);
create index customer_shop_staff_user_idx on public.customer_shop_staff(user_id);

alter table public.customer_carts enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.customer_pickup_slots enable row level security;
alter table public.customer_payments enable row level security;
alter table public.customer_order_status_history enable row level security;
alter table public.customer_shop_staff enable row level security;

revoke all on public.customer_carts, public.customer_cart_items,
  public.customer_pickup_slots, public.customer_payments,
  public.customer_order_status_history, public.customer_shop_staff
  from public, anon, authenticated;
revoke all on public.customer_shops, public.customer_products,
  public.customer_orders, public.customer_order_items
  from public, anon, authenticated;
grant select on public.customer_shops, public.customer_products,
  public.customer_orders, public.customer_order_items to authenticated;
grant select on public.customer_carts, public.customer_cart_items,
  public.customer_pickup_slots, public.customer_payments,
  public.customer_order_status_history, public.customer_shop_staff to authenticated;
grant all on public.customer_carts, public.customer_cart_items,
  public.customer_pickup_slots, public.customer_payments,
  public.customer_order_status_history, public.customer_shop_staff to service_role;

create function public.is_active_customer() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'customer' and status = 'active'
  );
$$;
create function public.is_customer_shop_staff(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.customer_shop_staff staff
    join public.profiles profile on profile.id = staff.user_id
    where staff.shop_id = p_shop_id and staff.user_id = (select auth.uid())
      and profile.role = 'shop' and profile.status = 'active'
  );
$$;
revoke all on function public.is_active_customer() from public, anon;
revoke all on function public.is_customer_shop_staff(uuid) from public, anon;
grant execute on function public.is_active_customer() to authenticated;
grant execute on function public.is_customer_shop_staff(uuid) to authenticated;

create policy "Customer owns cart" on public.customer_carts
  for select to authenticated using (customer_carts.customer_id = (select auth.uid()));
create policy "Customer owns cart items" on public.customer_cart_items
  for select to authenticated using (
    exists (select 1 from public.customer_carts c
      where c.id = customer_cart_items.cart_id
        and c.customer_id = (select auth.uid()))
  );
create policy "Staff sees own assignment" on public.customer_shop_staff
  for select to authenticated using (customer_shop_staff.user_id = (select auth.uid()));
create policy "Available pickup slots" on public.customer_pickup_slots
  for select to authenticated using (
    public.is_active_customer()
      or public.is_customer_shop_staff(customer_pickup_slots.shop_id)
  );
create policy "Customer or staff sees payment" on public.customer_payments
  for select to authenticated using (
    exists (select 1 from public.customer_orders o
      where o.id = customer_payments.order_id
      and (o.customer_id = (select auth.uid())
        or public.is_customer_shop_staff(o.shop_id)))
  );
create policy "Customer or staff sees status history"
  on public.customer_order_status_history for select to authenticated using (
    exists (select 1 from public.customer_orders o
      where o.id = customer_order_status_history.order_id
      and (o.customer_id = (select auth.uid())
        or public.is_customer_shop_staff(o.shop_id)))
  );
create policy "Assigned staff sees shop" on public.customer_shops
  for select to authenticated using (public.is_customer_shop_staff(customer_shops.id));
create policy "Customer sees ordered shop" on public.customer_shops
  for select to authenticated using (
    exists (select 1 from public.customer_orders o
      where o.shop_id = customer_shops.id
        and o.customer_id = (select auth.uid()))
  );
drop policy "Customers can view active products" on public.customer_products;
create policy "Catalog and purchased products" on public.customer_products
  for select to authenticated using (
    customer_products.active
      or public.is_customer_shop_staff(customer_products.shop_id)
    or exists (select 1 from public.customer_cart_items ci
      join public.customer_carts c on c.id = ci.cart_id
      where ci.product_id = customer_products.id
        and c.customer_id = (select auth.uid()))
  );
drop policy "Customers can view their orders" on public.customer_orders;
create policy "Customer or assigned staff sees order" on public.customer_orders
  for select to authenticated using (
    customer_orders.customer_id = (select auth.uid())
      or public.is_customer_shop_staff(customer_orders.shop_id)
  );
drop policy "Customers can view their order items" on public.customer_order_items;
create policy "Customer or assigned staff sees order items"
  on public.customer_order_items for select to authenticated using (
    exists (select 1 from public.customer_orders o
      where o.id = customer_order_items.order_id
      and (o.customer_id = (select auth.uid())
        or public.is_customer_shop_staff(o.shop_id)))
  );

create function public.record_customer_order_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.customer_order_status_history
      (order_id, previous_status, status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.customer_order_status_history
      (order_id, previous_status, status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger customer_order_status_audit
  after insert or update of status on public.customer_orders
  for each row execute function public.record_customer_order_status();
revoke all on function public.record_customer_order_status() from public, anon, authenticated;

-- Only the trusted availability RPC calls this. Existing disabled slots stay disabled.
create function public.ensure_customer_pickup_slots(p_shop_id uuid, p_days integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_shop public.customer_shops%rowtype;
  v_today date;
  v_date date;
  v_local timestamp;
  v_start timestamptz;
  v_express timestamptz;
  v_offset integer;
begin
  select * into v_shop from public.customer_shops where id = p_shop_id and active;
  if not found then raise exception 'Shop unavailable'; end if;
  v_today := (now() at time zone v_shop.timezone)::date;
  for v_offset in 0..p_days - 1 loop
    v_date := v_today + v_offset;
    v_local := v_date + v_shop.pickup_open;
    while v_local + pg_catalog.make_interval(mins => v_shop.pickup_interval_minutes)
      <= v_date + v_shop.pickup_close loop
      v_start := v_local at time zone v_shop.timezone;
      insert into public.customer_pickup_slots
        (shop_id, slot_date, starts_at, ends_at, mode, capacity)
      values (p_shop_id, v_date, v_start,
        (v_local + pg_catalog.make_interval(mins => v_shop.pickup_interval_minutes))
          at time zone v_shop.timezone,
        'scheduled', v_shop.max_orders_per_slot)
      on conflict (shop_id, starts_at, mode) do nothing;
      v_local := v_local + pg_catalog.make_interval(mins => v_shop.pickup_interval_minutes);
    end loop;
  end loop;
  v_express := pg_catalog.to_timestamp((
    floor(extract(epoch from now() + pg_catalog.make_interval(mins => v_shop.preparation_minutes)) / 900)
      * 900 + 900)::double precision);
  v_local := v_express at time zone v_shop.timezone;
  if v_local::time >= v_shop.pickup_open
    and v_local + interval '20 minutes' <= v_local::date + v_shop.pickup_close then
    insert into public.customer_pickup_slots
      (shop_id, slot_date, starts_at, ends_at, mode, capacity)
    values (p_shop_id, v_local::date, v_express, v_express + interval '20 minutes',
      'express', v_shop.max_orders_per_slot)
    on conflict (shop_id, starts_at, mode) do nothing;
  end if;
end;
$$;
revoke all on function public.ensure_customer_pickup_slots(uuid, integer)
  from public, anon, authenticated;

create function public.get_customer_pickup_slots(p_shop_id uuid, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_shop public.customer_shops%rowtype;
  v_today date;
  v_slots jsonb;
begin
  if not public.is_active_customer() then raise exception 'Sign in as a customer'; end if;
  if p_days is null or p_days not between 1 and 14 then raise exception 'Invalid date range'; end if;
  select * into v_shop from public.customer_shops where id = p_shop_id and active;
  if not found then raise exception 'Shop unavailable'; end if;
  perform public.ensure_customer_pickup_slots(p_shop_id, p_days);
  v_today := (now() at time zone v_shop.timezone)::date;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'date', s.slot_date::text,
    'start', to_char(s.starts_at at time zone v_shop.timezone, 'HH24:MI'),
    'end', to_char(s.ends_at at time zone v_shop.timezone, 'HH24:MI'),
    'mode', s.mode) order by s.starts_at), '[]'::jsonb)
  into v_slots
  from public.customer_pickup_slots s
  where s.shop_id = p_shop_id and s.is_available
    and s.slot_date between v_today and v_today + p_days - 1
    and s.starts_at > now() + pg_catalog.make_interval(mins => v_shop.preparation_minutes)
    and (select count(*) from public.customer_orders o
      where o.shop_id = p_shop_id and o.status <> 'cancelled'
        and o.pickup_start_at < s.ends_at and o.pickup_end_at > s.starts_at) < s.capacity;
  return jsonb_build_object('today', v_today::text,
    'timezone', v_shop.timezone,
    'intervalMinutes', v_shop.pickup_interval_minutes, 'slots', v_slots);
end;
$$;

-- The cart belongs to auth.uid(); no caller can nominate another customer.
create function public.change_customer_cart(
  p_operation text, p_product_id uuid default null,
  p_quantity integer default null, p_substitution jsonb default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_cart public.customer_carts%rowtype;
  v_product public.customer_products%rowtype;
  v_quantity integer;
  v_substitution jsonb;
  v_alternative uuid;
begin
  if not public.is_active_customer() then raise exception 'Sign in as a customer'; end if;
  insert into public.customer_carts(customer_id) values (auth.uid())
    on conflict (customer_id) do nothing;
  select * into v_cart from public.customer_carts
    where customer_id = auth.uid() for update;
  if p_operation = 'clear' then
    delete from public.customer_cart_items where cart_id = v_cart.id;
    update public.customer_carts set shop_id = null, updated_at = now()
      where id = v_cart.id;
    return;
  end if;
  if p_product_id is null then raise exception 'Product required'; end if;
  if p_operation = 'remove' then
    delete from public.customer_cart_items
      where cart_id = v_cart.id and product_id = p_product_id;
    if not exists (select 1 from public.customer_cart_items where cart_id = v_cart.id) then
      update public.customer_carts set shop_id = null where id = v_cart.id;
    end if;
    return;
  end if;
  select * into v_product from public.customer_products
    where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p_operation in ('add', 'set') then
    if not v_product.active or not v_product.available or v_product.stock_quantity < 1
      or v_product.substitute_for is not null
      or not exists (select 1 from public.customer_shops
        where id = v_product.shop_id and active) then
      raise exception 'Product unavailable';
    end if;
    if v_cart.shop_id is not null and v_cart.shop_id <> v_product.shop_id then
      raise exception 'Cart contains products from another shop';
    end if;
    if p_quantity is null or p_quantity not between 1 and 99 then
      raise exception 'Quantity must be between 1 and 99';
    end if;
    update public.customer_carts set shop_id = v_product.shop_id,
      updated_at = now() where id = v_cart.id;
    insert into public.customer_cart_items(cart_id, product_id, quantity)
      values (v_cart.id, p_product_id, p_quantity)
      on conflict (cart_id, product_id) do update set
        quantity = case when p_operation = 'add'
          then public.customer_cart_items.quantity + excluded.quantity
          else excluded.quantity end,
        updated_at = now();
    select quantity, substitution into v_quantity, v_substitution
      from public.customer_cart_items
      where cart_id = v_cart.id and product_id = p_product_id;
    if v_quantity > 99 or v_quantity > v_product.stock_quantity then
      raise exception 'Requested quantity unavailable';
    end if;
    if v_substitution->>'type' = 'alternative' then
      v_alternative := (v_substitution->>'productId')::uuid;
      if not exists (select 1 from public.customer_products alt
        where alt.id = v_alternative and alt.shop_id = v_product.shop_id
          and alt.substitute_for = p_product_id and alt.active and alt.available
          and alt.stock_quantity >= v_quantity) then
        raise exception 'Alternative unavailable';
      end if;
    end if;
    return;
  end if;
  if p_operation = 'substitute' then
    if p_substitution is null
      or p_substitution->>'type' not in ('call', 'none', 'alternative') then
      raise exception 'Invalid substitution';
    end if;
    select quantity into v_quantity from public.customer_cart_items
      where cart_id = v_cart.id and product_id = p_product_id;
    if not found then raise exception 'Cart item not found'; end if;
    if p_substitution->>'type' = 'alternative' then
      v_alternative := (p_substitution->>'productId')::uuid;
      if not exists (select 1 from public.customer_products alt
        where alt.id = v_alternative and alt.shop_id = v_product.shop_id
          and alt.substitute_for = p_product_id and alt.active and alt.available
          and alt.stock_quantity >= v_quantity) then
        raise exception 'Alternative unavailable';
      end if;
    end if;
    update public.customer_cart_items set substitution = p_substitution,
      updated_at = now() where cart_id = v_cart.id and product_id = p_product_id;
    if not found then raise exception 'Cart item not found'; end if;
    return;
  end if;
  raise exception 'Unknown cart operation';
end;
$$;

create function public.place_customer_order(
  p_checkout_id text, p_shop_id uuid, p_slot_id uuid,
  p_expected_subtotal integer, p_payment_method text,
  p_customer_name text, p_customer_phone text,
  p_packing_instructions text, p_travel_method text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_shop public.customer_shops%rowtype;
  v_slot public.customer_pickup_slots%rowtype;
  v_cart public.customer_carts%rowtype;
  v_item record;
  v_existing uuid;
  v_order uuid;
  v_subtotal bigint := 0;
  v_savings bigint := 0;
  v_count integer := 0;
  v_alternative uuid;
begin
  if v_user is null or not public.is_active_customer() then
    raise exception 'Sign in as a customer';
  end if;
  if p_checkout_id is null or length(trim(p_checkout_id)) not between 1 and 100 then
    raise exception 'Invalid checkout ID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || p_checkout_id, 0));
  select id into v_existing from public.customer_orders
    where customer_id = v_user and checkout_id = p_checkout_id;
  if found then return v_existing; end if;
  select * into v_shop from public.customer_shops
    where id = p_shop_id and active for update;
  if not found then raise exception 'Shop unavailable'; end if;
  select * into v_slot from public.customer_pickup_slots
    where id = p_slot_id and shop_id = p_shop_id for update;
  if not found or not v_slot.is_available
    or v_slot.slot_date <> (v_slot.starts_at at time zone v_shop.timezone)::date
    or v_slot.slot_date < (now() at time zone v_shop.timezone)::date
    or v_slot.starts_at <= now() + pg_catalog.make_interval(mins => v_shop.preparation_minutes)
    or (select count(*) from public.customer_orders o
      where o.shop_id = p_shop_id and o.status <> 'cancelled'
        and o.pickup_start_at < v_slot.ends_at and o.pickup_end_at > v_slot.starts_at)
        >= v_slot.capacity then
    raise exception 'Pickup slot expired or unavailable';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 120
    or p_customer_phone is null
    or length(regexp_replace(p_customer_phone, '[^0-9]', '', 'g')) < 9
    or length(coalesce(p_packing_instructions, '')) > 500
    or p_travel_method not in ('walking', 'motorcycle', 'car')
    or p_payment_method not in ('pickup', 'wallet', 'card') then
    raise exception 'Complete valid checkout details';
  end if;
  select * into v_cart from public.customer_carts
    where customer_id = v_user for update;
  if not found or v_cart.shop_id <> p_shop_id then
    raise exception 'Cart is empty or belongs to another shop';
  end if;
  for v_item in
    select ci.product_id, ci.quantity, ci.substitution,
      p.shop_id, p.active, p.available, p.stock_quantity,
      p.price_lkr, p.regular_price_lkr
    from public.customer_cart_items ci
    join public.customer_products p on p.id = ci.product_id
    where ci.cart_id = v_cart.id order by ci.product_id
    for update of ci, p
  loop
    if v_item.shop_id <> p_shop_id or not v_item.active or not v_item.available
      or v_item.stock_quantity < v_item.quantity then
      raise exception 'Cart product unavailable';
    end if;
    if v_item.substitution->>'type' not in ('call', 'none', 'alternative') then
      raise exception 'Invalid substitution';
    end if;
    if v_item.substitution->>'type' = 'alternative' then
      v_alternative := (v_item.substitution->>'productId')::uuid;
      if not exists (select 1 from public.customer_products alt
        where alt.id = v_alternative and alt.shop_id = p_shop_id
          and alt.substitute_for = v_item.product_id and alt.active
          and alt.available and alt.stock_quantity >= v_item.quantity) then
        raise exception 'Alternative unavailable';
      end if;
    end if;
    v_count := v_count + 1;
    v_subtotal := v_subtotal + v_item.price_lkr::bigint * v_item.quantity;
    v_savings := v_savings
      + greatest(0, v_item.regular_price_lkr - v_item.price_lkr)::bigint * v_item.quantity;
  end loop;
  if v_count = 0 then raise exception 'Cart is empty'; end if;
  if v_subtotal > 2147483647 or v_savings > 2147483647 then
    raise exception 'Order total too large';
  end if;
  if p_expected_subtotal is null or p_expected_subtotal <> v_subtotal then
    raise exception 'Prices changed. Refresh your cart before checkout';
  end if;
  insert into public.customer_orders (
    customer_id, shop_id, checkout_id, reference, pickup_pin, status,
    payment_method, payment_status, customer_name, customer_phone,
    packing_instructions, travel_method, pickup_start_at, pickup_end_at,
    pickup_slot_id, pickup_mode, subtotal_lkr, savings_lkr, service_fee_lkr, total_lkr
  ) values (
    v_user, p_shop_id, p_checkout_id,
    'GG-' || to_char(now(), 'YYYY') || '-' ||
      upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)),
    lpad((floor(random() * 10000)::integer)::text, 4, '0'), 'placed',
    p_payment_method,
    case when p_payment_method = 'pickup' then 'pay_at_pickup' else 'demo_unpaid' end,
    trim(p_customer_name), trim(p_customer_phone),
    coalesce(p_packing_instructions, ''), p_travel_method,
    v_slot.starts_at, v_slot.ends_at, v_slot.id, v_slot.mode,
    v_subtotal::integer, v_savings::integer, 0, v_subtotal::integer
  ) returning id into v_order;
  insert into public.customer_order_items (
    order_id, product_id, product_name, product_unit, image_url,
    quantity, unit_price_lkr, regular_price_lkr, substitution
  )
  select v_order, p.id, p.name, p.unit, p.image_url,
    ci.quantity, p.price_lkr, p.regular_price_lkr, ci.substitution
  from public.customer_cart_items ci
  join public.customer_products p on p.id = ci.product_id
  where ci.cart_id = v_cart.id;
  insert into public.customer_payments(order_id, method, status, amount_lkr)
    values (v_order, p_payment_method,
      case when p_payment_method = 'pickup' then 'pay_at_pickup' else 'demo_unpaid' end,
      v_subtotal::integer);
  update public.customer_products p set stock_quantity = p.stock_quantity - ci.quantity
    from public.customer_cart_items ci
    where ci.cart_id = v_cart.id and ci.product_id = p.id;
  delete from public.customer_cart_items where cart_id = v_cart.id;
  update public.customer_carts set shop_id = null, updated_at = now()
    where id = v_cart.id;
  return v_order;
end;
$$;

create function public.cancel_customer_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders
    where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('placed', 'accepted') then
    raise exception 'Order can no longer be cancelled';
  end if;
  update public.customer_orders set status = 'cancelled' where id = p_order_id;
  update public.customer_products p set stock_quantity = p.stock_quantity + oi.quantity
    from public.customer_order_items oi
    where oi.order_id = p_order_id and oi.product_id = p.id;
end;
$$;

create function public.set_customer_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders
    where id = p_order_id for update;
  if not found or not public.is_customer_shop_staff(v_order.shop_id) then
    raise exception 'Order not found for this shop';
  end if;
  if not (
    (v_order.status = 'placed' and p_status in ('accepted', 'cancelled')) or
    (v_order.status = 'accepted' and p_status in ('packing', 'cancelled')) or
    (v_order.status = 'packing' and p_status = 'ready') or
    (v_order.status = 'ready' and p_status = 'collected')
  ) then raise exception 'Invalid status transition'; end if;
  update public.customer_orders set status = p_status where id = p_order_id;
  if p_status = 'cancelled' then
    update public.customer_products p set stock_quantity = p.stock_quantity + oi.quantity
      from public.customer_order_items oi
      where oi.order_id = p_order_id and oi.product_id = p.id;
  end if;
end;
$$;

revoke all on function public.get_customer_pickup_slots(uuid, integer) from public, anon;
revoke all on function public.change_customer_cart(text, uuid, integer, jsonb) from public, anon;
revoke all on function public.place_customer_order(text, uuid, uuid, integer, text, text, text, text, text) from public, anon;
revoke all on function public.cancel_customer_order(uuid) from public, anon;
revoke all on function public.set_customer_order_status(uuid, text) from public, anon;
grant execute on function public.get_customer_pickup_slots(uuid, integer) to authenticated;
grant execute on function public.change_customer_cart(text, uuid, integer, jsonb) to authenticated;
grant execute on function public.place_customer_order(text, uuid, uuid, integer, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_customer_order(uuid) to authenticated;
grant execute on function public.set_customer_order_status(uuid, text) to authenticated;
