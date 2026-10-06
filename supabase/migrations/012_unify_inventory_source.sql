begin;

-- 1. BACKFILL ONLY MISSING shop_inventory ROWS
insert into public.shop_inventory (shop_id, product_id, quantity, is_available)
select shop_id, id, greatest(stock_quantity, 0), available
from public.customer_products p
where not exists (
  select 1 from public.shop_inventory inv 
  where inv.shop_id = p.shop_id and inv.product_id = p.id
);

create or replace function public.change_customer_cart(
  p_operation text, p_product_id uuid default null,
  p_quantity integer default null, p_substitution jsonb default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_cart public.customer_carts%rowtype;
  v_product public.customer_products%rowtype;
  v_inventory public.shop_inventory%rowtype;
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
  
  select * into v_inventory from public.shop_inventory
    where product_id = p_product_id and shop_id = v_product.shop_id for update;
  if not found then raise exception 'Product inventory unavailable'; end if;
  
  if p_operation in ('add', 'set') then
    if not v_product.active or not v_inventory.is_available or v_inventory.quantity < 1
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
    if v_quantity > 99 or v_quantity > v_inventory.quantity then
      raise exception 'Requested quantity unavailable';
    end if;
    if v_substitution->>'type' = 'alternative' then
      v_alternative := (v_substitution->>'productId')::uuid;
      if not exists (select 1 from public.customer_products alt
        join public.shop_inventory alt_inv on alt_inv.product_id = alt.id and alt_inv.shop_id = alt.shop_id
        where alt.id = v_alternative and alt.shop_id = v_product.shop_id
          and alt.substitute_for = p_product_id and alt.active and alt_inv.is_available
          and alt_inv.quantity >= v_quantity) then
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
        join public.shop_inventory alt_inv on alt_inv.product_id = alt.id and alt_inv.shop_id = alt.shop_id
        where alt.id = v_alternative and alt.shop_id = v_product.shop_id
          and alt.substitute_for = p_product_id and alt.active and alt_inv.is_available
          and alt_inv.quantity >= v_quantity) then
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

create or replace function public.place_customer_order(
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
      p.shop_id, p.active, inv.is_available, inv.quantity as stock_quantity,
      p.price_lkr, p.regular_price_lkr
    from public.customer_cart_items ci
    join public.customer_products p on p.id = ci.product_id
    join public.shop_inventory inv on inv.product_id = p.id and inv.shop_id = p.shop_id
    where ci.cart_id = v_cart.id order by ci.product_id
    for update of ci, p, inv
  loop
    if v_item.shop_id <> p_shop_id or not v_item.active or not v_item.is_available
      or v_item.stock_quantity < v_item.quantity then
      raise exception 'Cart product unavailable';
    end if;
    if v_item.substitution->>'type' not in ('call', 'none', 'alternative') then
      raise exception 'Invalid substitution';
    end if;
    if v_item.substitution->>'type' = 'alternative' then
      v_alternative := (v_item.substitution->>'productId')::uuid;
      if not exists (select 1 from public.customer_products alt
        join public.shop_inventory alt_inv on alt_inv.product_id = alt.id and alt_inv.shop_id = alt.shop_id
        where alt.id = v_alternative and alt.shop_id = p_shop_id
          and alt.substitute_for = v_item.product_id and alt.active
          and alt_inv.is_available and alt_inv.quantity >= v_item.quantity) then
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
    pickup_slot_id, pickup_mode, subtotal_lkr, savings_lkr, service_fee_lkr, total_lkr) values (
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
  
  -- Decrement shop_inventory instead of customer_products
  update public.shop_inventory inv 
    set quantity = inv.quantity - ci.quantity
    from public.customer_cart_items ci
    join public.customer_products p on p.id = ci.product_id
    where ci.cart_id = v_cart.id and inv.product_id = p.id
      and inv.shop_id = p.shop_id and inv.shop_id = p.shop_id;
    
  delete from public.customer_cart_items where cart_id = v_cart.id;
  update public.customer_carts set shop_id = null, updated_at = now()
    where id = v_cart.id;
  return v_order;
end;
$$;

create or replace function public.cancel_customer_order(p_order_id uuid)
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
  
  update public.shop_inventory inv set quantity = inv.quantity + oi.quantity
      from public.customer_order_items oi
      where oi.order_id = p_order_id and oi.product_id = inv.product_id
        and inv.shop_id = v_order.shop_id;
end;
$$;

create or replace function public.set_customer_order_status(p_order_id uuid, p_status text)
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
    update public.shop_inventory inv set quantity = inv.quantity + oi.quantity
      from public.customer_order_items oi
      where oi.order_id = p_order_id and oi.product_id = inv.product_id
        and inv.shop_id = v_order.shop_id;
  end if;
end;
$$;

REVOKE ALL ON FUNCTION public.change_customer_cart(text, uuid, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_customer_cart(text, uuid, integer, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.place_customer_order(text, uuid, uuid, integer, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_customer_order(text, uuid, uuid, integer, text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_customer_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_customer_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_customer_order_status(uuid, text) TO authenticated;

commit;
