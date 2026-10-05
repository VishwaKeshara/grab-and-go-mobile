-- DEVELOPMENT ONLY. Local Supabase db reset loads this after migrations.
-- Do not use db push --include-seed on production.
insert into public.customer_shops (
  id, hub_id, name, address, phone, pickup_counter, preparation_minutes,
  timezone, pickup_open, pickup_close, pickup_interval_minutes, max_orders_per_slot
) values (
  '11111111-1111-4111-8111-111111111111',
  (select id from public.pickup_hubs where name = 'Malabe Bazaar Hub' limit 1),
  'Pasar Groceries', 'Malabe Bazaar Hub, Kaduwela Road', null,
  'Pickup counter B', 25, 'Asia/Colombo', '09:00', '19:30', 30, 6
) on conflict (id) do nothing;

insert into public.customer_products (
  id, shop_id, name, unit, price_lkr, regular_price_lkr,
  image_url, active, available, stock_quantity, substitute_for
) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-111111111111',
   'Kolikuttu Bananas', '500 g', 280, 320,
   'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=85', true, true, 100, null),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-111111111111',
   'Country Grain Loaf', '400 g', 420, 450,
   'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=85', true, true, 100, null),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-111111111111',
   'Farm Fresh Eggs', 'pack of 6', 540, 600,
   'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=85', true, true, 100, null),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-111111111111',
   'Fresh Cow Milk', '1 L', 490, 520,
   'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=85', true, true, 100, null),
  ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-111111111111',
   'Red Apples', '500 g', 690, 750,
   'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&q=85', true, true, 100, null),
  ('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-111111111111',
   'Fresh White Loaf', '400 g', 390, 420,
   'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=85', true, true, 100,
   '22222222-2222-4222-8222-000000000002'),
  ('22222222-2222-4222-8222-000000000007', '11111111-1111-4111-8111-111111111111',
   'Large Farm Eggs', 'pack of 6', 590, 620,
   'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=500&q=85', true, true, 100,
   '22222222-2222-4222-8222-000000000003'),
  ('22222222-2222-4222-8222-000000000008', '11111111-1111-4111-8111-111111111111',
   'Highland Fresh Milk', '1 L', 510, 540,
   'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=85', true, true, 100,
   '22222222-2222-4222-8222-000000000004')
on conflict (id) do nothing;
