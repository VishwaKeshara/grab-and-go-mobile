-- ============================================================
-- Migration 008: Customer Checkout Transaction
-- Ensures atomic order placement and inventory updates.
-- ============================================================

begin;

create or replace function public.place_customer_order(
  p_checkout_id text,
  p_payment_method text,
  p_customer_name text,
  p_customer_phone text,
  p_packing_instructions text,
  p_travel_method text,
  p_pickup_start_at timestamptz,
  p_pickup_end_at timestamptz,
  p_items jsonb -- array of { product_id: uuid, quantity: int, substitution: jsonb }
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_shop_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
  v_substitution jsonb;
  v_product_record record;
  v_inventory_record record;
  v_order_id uuid;
  v_reference text;
  v_pin text;
  v_subtotal_lkr int := 0;
  v_service_fee_lkr int := 0;
  v_total_lkr int := 0;
  v_now timestamptz := now();
begin
  -- 1. Authenticate user
  v_customer_id := auth.uid();
  if v_customer_id is null then
    raise exception 'Unauthorized';
  end if;

  -- 2. Validate input
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cart cannot be empty';
  end if;

  -- 3. Process items and validate inventory
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    
    if v_qty <= 0 then
      raise exception 'Quantity must be > 0 for product %', v_product_id;
    end if;

    -- Get product
    select * into v_product_record
    from public.customer_products
    where id = v_product_id
      and active = true;

    if not found then
      raise exception 'Product % not found or not active', v_product_id;
    end if;

    -- Validate single shop
    if v_shop_id is null then
      v_shop_id := v_product_record.shop_id;
    elsif v_shop_id != v_product_record.shop_id then
      raise exception 'All products must belong to one shop';
    end if;

    -- Lock inventory
    select * into v_inventory_record
    from public.shop_inventory
    where product_id = v_product_id
      and shop_id = v_shop_id
    for update;

    if not found then
      raise exception 'Inventory record not found for product %', v_product_id;
    end if;

    if not v_inventory_record.is_available then
      raise exception 'Product % is not available', v_product_record.name;
    end if;

    if v_qty > v_inventory_record.quantity then
      raise exception 'Requested quantity % exceeds available % for product %', v_qty, v_inventory_record.quantity, v_product_record.name;
    end if;

    -- Decrement inventory
    update public.shop_inventory
    set quantity = quantity - v_qty,
        is_available = case when quantity - v_qty = 0 then false else is_available end,
        updated_at = v_now
    where product_id = v_product_id
      and shop_id = v_shop_id;

    -- Add to subtotal
    v_subtotal_lkr := v_subtotal_lkr + (v_product_record.price_lkr * v_qty);
  end loop;

  -- 4. Calculate totals
  v_total_lkr := v_subtotal_lkr + v_service_fee_lkr;

  -- Generate reference and pin
  v_reference := 'GG-' || to_char(v_now, 'YYYY') || '-' || lpad((extract(epoch from v_now)::bigint % 1000000)::text, 6, '0');
  v_pin := lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  -- 5. Create Order
  insert into public.customer_orders (
    customer_id, shop_id, checkout_id, reference, pickup_pin, status,
    payment_method, payment_status, customer_name, customer_phone,
    packing_instructions, travel_method, pickup_start_at, pickup_end_at,
    subtotal_lkr, savings_lkr, service_fee_lkr, total_lkr
  ) values (
    v_customer_id, v_shop_id, p_checkout_id, v_reference, v_pin, 'placed',
    p_payment_method, case when p_payment_method = 'pickup' then 'pay_at_pickup' else 'paid' end,
    p_customer_name, p_customer_phone, p_packing_instructions, p_travel_method,
    p_pickup_start_at, p_pickup_end_at, v_subtotal_lkr, 0, v_service_fee_lkr, v_total_lkr
  ) returning id into v_order_id;

  -- 6. Create Order Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_substitution := coalesce(v_item->'substitution', '{"type":"call"}'::jsonb);

    select * into v_product_record
    from public.customer_products
    where id = v_product_id;

    insert into public.customer_order_items (
      order_id, product_id, product_name, product_unit, image_url,
      quantity, unit_price_lkr, substitution
    ) values (
      v_order_id, v_product_id, v_product_record.name, v_product_record.unit,
      v_product_record.image_url, v_qty, v_product_record.price_lkr, v_substitution
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'reference', v_reference,
    'pickup_pin', v_pin
  );
exception
  when unique_violation then
    select id, reference, pickup_pin into v_order_id, v_reference, v_pin
    from public.customer_orders
    where customer_id = auth.uid() and checkout_id = p_checkout_id;
    
    if found then
      return jsonb_build_object(
        'order_id', v_order_id,
        'reference', v_reference,
        'pickup_pin', v_pin,
        'duplicate', true
      );
    end if;
    raise;
end;
$$;

revoke all on function public.place_customer_order(
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) from public;
grant execute on function public.place_customer_order(
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) to authenticated;

create or replace function public.create_shop_product_with_inventory(
  p_shop_id uuid,
  p_name text,
  p_unit text,
  p_price_lkr int,
  p_regular_price_lkr int,
  p_image_url text,
  p_initial_quantity int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if not public.is_shop_owner(p_shop_id) and not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  insert into public.customer_products (
    shop_id, name, unit, price_lkr, regular_price_lkr, image_url, active
  ) values (
    p_shop_id, p_name, p_unit, p_price_lkr, p_regular_price_lkr, p_image_url, true
  ) returning id into v_product_id;

  insert into public.shop_inventory (
    shop_id, product_id, quantity, low_stock_threshold, is_available
  ) values (
    p_shop_id, v_product_id, p_initial_quantity, 5, p_initial_quantity > 0
  );

  return v_product_id;
end;
$$;

revoke all on function public.create_shop_product_with_inventory(
  uuid,
  text,
  text,
  integer,
  integer,
  text,
  integer
) from public;
grant execute on function public.create_shop_product_with_inventory(
  uuid,
  text,
  text,
  integer,
  integer,
  text,
  integer
) to authenticated;

commit;
