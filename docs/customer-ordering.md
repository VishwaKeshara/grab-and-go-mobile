# Member 3: order and payment backend

## What is implemented

The customer screens read and write Supabase ordering data through
`services/cartService.ts`, `services/pickupService.ts`, and
`services/orderService.ts`. The cart popup, badge, and Cart screen use the
same provider state. The checkout draft stays in user-scoped AsyncStorage so
unfinished contact details and a checkout ID survive app restarts; cart and
orders are loaded from Supabase. Existing device-only demo carts are not
automatically imported.

Migration `005_customer_ordering.sql` already defines
`customer_shops`, `customer_products`, `customer_orders`, and
`customer_order_items`; migration `006_member3_order_payment.sql` extends
those tables. It creates `customer_carts`, `customer_cart_items`,
`customer_pickup_slots`, `customer_payments`,
`customer_order_status_history`, and `customer_shop_staff`. Substitution
choices remain JSON on cart and order items, as in migration 005. It reuses
Supabase Auth, `profiles`, `pickup_hubs`, and the 005 catalog rather than
creating parallel orders or products tables. The development-only catalog is
`supabase/seed.sql`.

The checkout RPC locks the shop, selected slot, cart, and products; checks
authenticated customer ownership, current stock and prices, valid
substitutes, slot capacity and expiry in the shop's IANA timezone; computes
totals; saves order and item price snapshots plus a payment record; and
clears the purchased cart in one database transaction. Repeating
`(customer_id, checkout_id)` returns the original order. Customer
cancellation and assigned shop staff status changes are separate RPCs.
Status history is written by a trigger.

## Deployment status and commands

The repository is linked to project `buazpscpiufcndssxgyi`. On 2026-10-04,
the owner's SQL Editor diagnostic confirmed versions 001-005 in history and
006 absent. All new 006 tables, functions, indexes, policies, trigger, and
columns were absent **except** `customer_shops.hub_id`, a UUID column with an
existing `pickup_hubs` foreign key using `ON DELETE SET NULL`. The payment
status constraint still had its 005 definition. This is a clean starting
point for corrected 006 while preserving the pre-existing hub relationship.
Migration 005 is already applied; do not rerun it. Neither 006 deployment nor
live app behavior has been verified yet.

The failed 006 attempt reported SQLSTATE 42702 in the product catalog policy.
The policy now uses `ci.product_id = customer_products.id`, and all other
correlated policy references were inspected. Migration 006 also uses
`ADD COLUMN IF NOT EXISTS` for the existing `hub_id`, preserving its data and
foreign key. The fallback SQL was generated from this corrected migration.

The CLI cannot currently read remote history: it reports
`DbConfigLoginRoleNetworkError` / `TransportError`, or the owner's
`cli_login_postgres` connection closes unexpectedly. If the CLI connection
recovers, run from the repository root:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
# Continue only if 001-005 are remote-applied and 006 is the sole pending file:
npx.cmd supabase db push
npx.cmd supabase migration list
```

If either CLI inspection command fails, or the dry run lists 005 or any
unexpected migration, do not run `db push`. These migrations use short
versions (`001`-`006`), which some CLI versions may reject. Do not rename an
already-applied migration or mark 006 applied to work around that failure.

For the SQL Editor fallback, open the **production** project with ref
`buazpscpiufcndssxgyi`, create a new query, paste the **entire** contents of
`supabase/deploy/006_member3_sql_editor.sql`, and run the whole query once.
It checks that 005 is recorded, 006 is absent, and no 006 tables already
exist. It runs corrected 006 inside `BEGIN`/`COMMIT` and inserts version 006
into `supabase_migrations.schema_migrations` only after all 006 statements
succeed. Do not paste 005, the development seed, or a standalone history
insert. If any statement fails, do not mark 006 applied; rerun the read-only
diagnostic before trying again.

After a successful SQL Editor run, rerun
`supabase/diagnostics/006_partial_objects.sql`. Expect history 001-006,
all 006 tables/functions/indexes/policies/trigger/columns present, and RLS
enabled on each new table. The 005 active-shop policy should remain;
the 005 active-product/own-order/own-item policies should be replaced by
the 006 policies. The `customer_shops_hub_id_fkey` should still show
`ON DELETE SET NULL`. Inspect table grants as described below: 006 revokes
direct anonymous access and direct authenticated writes to ordering tables.
If the diagnostic disagrees, stop and inspect before using the app.

Do not use `db reset --linked` or `--include-seed` on this project.

For a disposable local project with Docker available:

```powershell
npx supabase start
npx supabase db reset
```

The configured `supabase/seed.sql` runs after local migrations. The remote
`db push` command above deliberately omits `--include-seed`. On a
remote **development** project, execute the labelled seed SQL in the
Supabase SQL editor after 006 if test products are needed. Replace it with
real shop, product, image, and stock data before production. Set the shop's
`timezone`, `pickup_open`, `pickup_close`,
`pickup_interval_minutes`, `preparation_minutes`, and
`max_orders_per_slot`. Migration 006 initializes `stock_quantity` to zero
for existing products; backfill real stock for those products before placing
orders. The availability RPC creates database slot rows
for the next seven shop-local days on demand. Staff can close a slot in
the database by setting `is_available=false`.

The Expo app needs only these public values in `.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never place the service-role key in an `EXPO_PUBLIC_` variable. Restart
Expo with `npx expo start --clear` after changing environment values.

## Staff and other member dependencies

The shop module's `services/shopService.ts` and `types/shopOrder.ts`
are typed stubs for proposed `shops/products/orders` tables and use
`new/completed/rejected` status names. No such tables are present in the
checked-in migrations. Member 3 uses the actual 005
`customer_shops/customer_products/customer_orders` contract and
`placed/accepted/packing/ready/collected/cancelled` statuses. The shop
member must point their order queue, status actions, and QR/PIN verification
to these records and `set_customer_order_status`. Their UI and service
files were not changed. This dependency prevents end-to-end verification
of staff actions and QR collection in the current app.

The shared Home screen still displays its member-owned static product cards.
The ordering provider resolves a Home Add tap by product name against the
live catalog, so the development seed works without changing Home. That
member should eventually bind Home cards to catalog IDs; names or prices
that diverge from the live catalog can prevent an add or show stale
information. The order screens use server product and shop records.

To authorize an existing shop account, set its `profiles.role` to
`shop` through the team's administrator process, then assign its Auth
user ID to a shop in the SQL editor:

```sql
insert into public.customer_shop_staff (shop_id, user_id)
values ('SHOP_UUID', 'SHOP_USER_UUID');
```

The profile must also have `status='active'`. Never grant the mobile
client direct UPDATE access to orders or prices.

## Database and app verification

Create two dedicated active customer accounts in a disposable development
project with seed products. The integration script needs a service-role key
only in its local Node process to create temporary past/closed test slots;
it is never imported by the app. Optionally provide a third active assigned
shop account to test an authorized status update. Set the variables without
committing their values:

```powershell
$env:TEST_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co'
$env:TEST_SUPABASE_PUBLISHABLE_KEY = 'YOUR_PUBLISHABLE_KEY'
$env:TEST_SUPABASE_SERVICE_ROLE_KEY = 'DEVELOPMENT_SERVICE_ROLE_KEY'
$env:TEST_CUSTOMER_A_EMAIL = 'CUSTOMER_A_EMAIL'
$env:TEST_CUSTOMER_A_PASSWORD = 'CUSTOMER_A_PASSWORD'
$env:TEST_CUSTOMER_B_EMAIL = 'CUSTOMER_B_EMAIL'
$env:TEST_CUSTOMER_B_PASSWORD = 'CUSTOMER_B_PASSWORD'
$env:TEST_SHOP_EMAIL = 'SHOP_EMAIL'       # optional
$env:TEST_SHOP_PASSWORD = 'SHOP_PASSWORD' # optional
node tests/customer-ordering.integration.mjs
```

The script checks anonymous permissions, customer cart isolation, one-row
quantity increases, persistence in a fresh signed-in client, past and
unavailable slot rejection, stale subtotal rejection, retry idempotency,
saved item prices and totals, payment and status-history records, purchased
cart clearing, cross-customer order/payment/history isolation, and denied
direct or unauthorized status writes. It cancels its test order and
removes its temporary slots afterward. Run it only on a development
project with disposable stock.

For a real app restart check, add an item on device, fully close and reopen
the app, then compare the header badge, cart sheet, and Cart screen.
Check a second signed-in customer sees an empty or separate cart.
At checkout, leave the Pickup Schedule open until its selected slot
expires, then confirm the backend rejects placement and the cart remains.

After deployment, inspect the SQL grants and RLS policies:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'customer_%'
order by tablename;
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename like 'customer_%'
order by tablename, policyname;
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'customer_%'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Expected: RLS on each customer table; authenticated SELECT for the rows
permitted by policies; no direct authenticated INSERT/UPDATE/DELETE on
ordering tables; no anonymous access to ordering tables; customer writes
only through validated RPCs. Run `npm run test:ordering`,
`npx expo lint`, and `npx tsc --noEmit` locally.

## Payment boundary

`services/paymentService.ts` has only a demo delay and no provider
configuration or confirmation contract. Wallet/card orders are saved as
`demo_unpaid`; pay-at-pickup orders are saved as `pay_at_pickup`.
No code marks a demo charge as paid. A real provider requires a server-side
payment intent/confirmation contract and verified webhook before the
`paid` status is used. The existing QR image is visual only until the
shop module implements verification against saved orders.
