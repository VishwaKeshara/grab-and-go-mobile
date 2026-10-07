-- Member 3: fix the live Add More Items and cancellation inventory source.
-- Requires 012_unify_inventory_source.sql and the Add More Items migration.
begin;

do $$
begin
  if to_regclass('public.shop_inventory') is null
    or to_regclass('public.customer_order_additions') is null
    or to_regprocedure(
      'public.add_items_to_customer_order(uuid,text,jsonb,integer,integer)'
    ) is null then
    raise exception 'Inventory or Add More Items prerequisites are missing';
  end if;
  if exists (
    select 1
    from public.shop_inventory
    group by shop_id, product_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate shop inventory rows must be resolved before deployment';
  end if;
  if exists (select 1 from public.customer_order_additions) then
    raise exception 'Legacy order additions must be reconciled before deployment';
  end if;
end;
$$;

create or replace function public.add_items_to_customer_order(
  p_order_id uuid,
  p_request_id text,
  p_items jsonb,
  p_expected_additional_subtotal integer,
  p_expected_order_total integer
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.customer_orders%rowtype;
  v_shop public.customer_shops%rowtype;
  v_slot public.customer_pickup_slots%rowtype;
  v_payment public.customer_payments%rowtype;
  v_previous public.customer_order_additions%rowtype;
  v_input jsonb;
  v_items jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}'::uuid[];
  v_product_id uuid;
  v_quantity integer;
  v_product public.customer_products%rowtype;
  v_inventory public.shop_inventory%rowtype;
  v_subtotal bigint := 0;
  v_savings bigint := 0;
  v_new_total bigint;
begin
  if not public.is_active_customer() then
    raise exception 'Sign in as a customer';
  end if;
  if p_request_id is null or length(trim(p_request_id)) not between 1 and 100 then
    raise exception 'Invalid addition request';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Choose valid products to add';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Choose between 1 and 50 products';
  end if;

  for v_input in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_input) <> 'object'
      or jsonb_typeof(v_input->'productId') <> 'string'
      or coalesce(v_input->>'productId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_input->'quantity') <> 'number'
      or coalesce(v_input->>'quantity', '') !~ '^[1-9][0-9]?$' then
      raise exception 'Choose valid products and quantities';
    end if;
    v_product_id := (v_input->>'productId')::uuid;
    v_quantity := (v_input->>'quantity')::integer;
    if v_product_id = any(v_seen) then
      raise exception 'Each product may be selected only once';
    end if;
    v_seen := array_append(v_seen, v_product_id);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product_id, 'quantity', v_quantity));
  end loop;
  select jsonb_agg(value order by value->>'productId') into v_items
    from jsonb_array_elements(v_items);

  select * into v_order from public.customer_orders
    where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;

  select * into v_previous from public.customer_order_additions
    where order_id = p_order_id and request_id = p_request_id;
  if found then
    if v_previous.items is distinct from v_items
      or p_expected_additional_subtotal is distinct from v_previous.additional_subtotal_lkr then
      raise exception 'Addition request was already used for different items';
    end if;
    return jsonb_build_object(
      'orderId', p_order_id,
      'additionalSubtotal', v_previous.additional_subtotal_lkr,
      'newTotal', v_previous.new_total_lkr);
  end if;

  if v_order.status <> 'placed'
    or v_order.payment_method <> 'pickup'
    or v_order.payment_status <> 'pay_at_pickup' then
    raise exception 'Order can no longer accept items';
  end if;
  if p_expected_order_total is distinct from v_order.total_lkr then
    raise exception 'Order total changed; review the new total';
  end if;

  select * into v_shop from public.customer_shops
    where id = v_order.shop_id and active for update;
  if not found then raise exception 'Shop unavailable'; end if;

  select * into v_slot from public.customer_pickup_slots
    where id = v_order.pickup_slot_id and shop_id = v_order.shop_id for update;
  if not found then
    raise exception 'Pickup time is too close or unavailable';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'Pickup time has passed';
  end if;
  if not v_slot.is_available
    or v_slot.starts_at <> v_order.pickup_start_at
    or v_slot.ends_at <> v_order.pickup_end_at
    or v_slot.slot_date <> (v_slot.starts_at at time zone v_shop.timezone)::date
    or v_slot.slot_date < (now() at time zone v_shop.timezone)::date
    or v_slot.starts_at <= now()
      + pg_catalog.make_interval(mins => v_shop.preparation_minutes)
    or (select count(*) from public.customer_orders o
      where o.shop_id = v_order.shop_id and o.status <> 'cancelled'
        and o.pickup_start_at < v_slot.ends_at
        and o.pickup_end_at > v_slot.starts_at) > v_slot.capacity then
    raise exception 'Pickup time is too close or unavailable';
  end if;

  select * into v_payment from public.customer_payments
    where order_id = p_order_id for update;
  if not found or v_payment.method <> 'pickup'
    or v_payment.status <> 'pay_at_pickup'
    or v_payment.amount_lkr <> v_order.total_lkr then
    raise exception 'Unpaid pickup payment unavailable';
  end if;

  -- The normalized product order gives concurrent requests a stable lock order.
  for v_input in select value from jsonb_array_elements(v_items) loop
    v_product_id := (v_input->>'productId')::uuid;
    v_quantity := (v_input->>'quantity')::integer;

    select * into v_product from public.customer_products
      where id = v_product_id for update;
    if not found or v_product.shop_id <> v_order.shop_id
      or not v_product.active or v_product.substitute_for is not null then
      raise exception 'A selected product is unavailable in that quantity';
    end if;

    select * into v_inventory from public.shop_inventory
      where shop_id = v_order.shop_id and product_id = v_product_id for update;
    if not found or not v_inventory.is_available
      or v_inventory.quantity < v_quantity then
      raise exception 'A selected product is unavailable in that quantity';
    end if;

    v_subtotal := v_subtotal + v_product.price_lkr::bigint * v_quantity;
    v_savings := v_savings
      + greatest(
        0::bigint,
        v_product.regular_price_lkr::bigint - v_product.price_lkr::bigint
      ) * v_quantity;
  end loop;

  v_new_total := v_order.total_lkr::bigint + v_subtotal;
  if p_expected_additional_subtotal is null
    or p_expected_additional_subtotal <> v_subtotal then
    raise exception 'Prices changed; review the additional cost';
  end if;
  if v_new_total > 2147483647
    or v_order.subtotal_lkr::bigint + v_subtotal > 2147483647
    or v_order.savings_lkr::bigint + v_savings > 2147483647 then
    raise exception 'Order total too large';
  end if;

  for v_input in select value from jsonb_array_elements(v_items) loop
    v_product_id := (v_input->>'productId')::uuid;
    v_quantity := (v_input->>'quantity')::integer;
    select * into v_product from public.customer_products
      where id = v_product_id;
    insert into public.customer_order_items (
      order_id, product_id, product_name, product_unit, image_url,
      quantity, unit_price_lkr, regular_price_lkr, substitution
    ) values (
      p_order_id, v_product.id, v_product.name, v_product.unit,
      v_product.image_url, v_quantity, v_product.price_lkr,
      v_product.regular_price_lkr, '{"type":"call"}'::jsonb
    );
    update public.shop_inventory set
      quantity = quantity - v_quantity,
      updated_at = now()
      where shop_id = v_order.shop_id and product_id = v_product_id;
  end loop;

  update public.customer_orders set
    subtotal_lkr = subtotal_lkr + v_subtotal::integer,
    savings_lkr = savings_lkr + v_savings::integer,
    total_lkr = v_new_total::integer
    where id = p_order_id;
  update public.customer_payments set amount_lkr = v_new_total::integer
    where order_id = p_order_id;
  insert into public.customer_order_additions (
    order_id, request_id, items, additional_subtotal_lkr,
    additional_savings_lkr, new_total_lkr
  ) values (
    p_order_id, p_request_id, v_items, v_subtotal::integer,
    v_savings::integer, v_new_total::integer
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'additionalSubtotal', v_subtotal::integer,
    'newTotal', v_new_total::integer);
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
  if exists (
    select 1 from public.customer_order_items oi
    left join public.shop_inventory inv
      on inv.shop_id = v_order.shop_id and inv.product_id = oi.product_id
    where oi.order_id = p_order_id and oi.product_id is not null and inv.id is null
  ) then
    raise exception 'Product inventory unavailable';
  end if;
  update public.customer_orders set status = 'cancelled' where id = p_order_id;
  update public.shop_inventory inv set
    quantity = inv.quantity + sold.quantity,
    updated_at = now()
    from (
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.customer_order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
    ) sold
    where inv.shop_id = v_order.shop_id and inv.product_id = sold.product_id;
end;
$$;

revoke all on function public.add_items_to_customer_order(
  uuid, text, jsonb, integer, integer
) from public, anon, authenticated;
grant execute on function public.add_items_to_customer_order(
  uuid, text, jsonb, integer, integer
) to authenticated;
revoke all on function public.cancel_customer_order(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
