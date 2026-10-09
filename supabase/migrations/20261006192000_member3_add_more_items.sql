
begin;

do $$
begin
  if to_regclass('public.customer_orders') is null
    or to_regclass('public.customer_order_items') is null
    or to_regclass('public.customer_products') is null
    or to_regclass('public.customer_shops') is null
    or to_regclass('public.customer_pickup_slots') is null
    or to_regclass('public.customer_payments') is null
    or to_regprocedure('public.is_active_customer()') is null then
    raise exception 'Member 3 ordering prerequisites are missing';
  end if;
  if to_regclass('public.customer_order_additions') is not null
    or to_regprocedure(
      'public.add_items_to_customer_order(uuid,text,jsonb,integer,integer)'
    ) is not null then
    raise exception 'Add More Items objects already exist; inspect them before deploying';
  end if;
end;
$$;

create table public.customer_order_additions (
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  request_id text not null check (length(request_id) between 1 and 100),
  items jsonb not null,
  additional_subtotal_lkr integer not null check (additional_subtotal_lkr > 0),
  additional_savings_lkr integer not null check (additional_savings_lkr >= 0),
  new_total_lkr integer not null check (new_total_lkr >= 0),
  created_at timestamptz not null default now(),
  primary key (order_id, request_id),
  check (jsonb_typeof(items) = 'array')
);

alter table public.customer_order_additions enable row level security;
revoke all on public.customer_order_additions from public, anon, authenticated;
grant select on public.customer_order_additions to authenticated;
grant all on public.customer_order_additions to service_role;

create policy "Customer sees own order additions"
  on public.customer_order_additions for select to authenticated using (
    exists (select 1 from public.customer_orders o
      where o.id = customer_order_additions.order_id
        and o.customer_id = (select auth.uid()))
  );

create function public.add_items_to_customer_order(
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

  -- Normalize the payload before checking idempotency so item order is irrelevant.
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
  if not found or not v_slot.is_available
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

  -- The normalized order provides a stable lock order across concurrent requests.
  for v_input in select value from jsonb_array_elements(v_items) loop
    v_product_id := (v_input->>'productId')::uuid;
    v_quantity := (v_input->>'quantity')::integer;
    select * into v_product from public.customer_products
      where id = v_product_id for update;
    if not found or v_product.shop_id <> v_order.shop_id
      or not v_product.active or not v_product.available
      or v_product.substitute_for is not null
      or v_product.stock_quantity < v_quantity then
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
    update public.customer_products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product_id;
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

revoke all on function public.add_items_to_customer_order(
  uuid, text, jsonb, integer, integer
) from public, anon, authenticated;
grant execute on function public.add_items_to_customer_order(
  uuid, text, jsonb, integer, integer
) to authenticated;

notify pgrst, 'reload schema';

commit;
