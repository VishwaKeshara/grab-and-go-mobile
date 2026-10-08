# Database analysis — Member 2 (Product & Shop Management)

**Read-only. No tables were created, altered or dropped.**

Verified against the live project `buazpscpiufcndssxgyi` on 2026-10-06 by
probing each table over PostgREST.

---

## 1. The headline finding: 401 is not 404

I probed all 17 tables with the project's publishable key.

| Result | Meaning |
|---|---|
| `200 OK`, 0 rows | Table exists, is queryable, RLS hides the rows from anon |
| `404` | Table genuinely does not exist |
| `401` | **Table exists but access is denied** |

| Table | Result | Interpretation |
|---|---|---|
| `pickup_hubs` | 200 | exists, RLS active |
| `profiles` | 200 | exists, RLS active |
| `notifications` | 200 | exists, RLS active |
| `shop_inventory` | 200 | exists, queryable |
| `pickup_verifications` | 200 | exists, queryable |
| `security_events` | 200 | exists, queryable |
| `customer_shops` | **401** | exists, denied |
| `customer_products` | **401** | exists, denied |
| `customer_orders` | **401** | exists, denied |
| `customer_order_items` | **401** | exists, denied |
| `shop_staff` | **401** | exists, denied |
| `customer_carts` | **401** | exists, denied |
| `customer_cart_items` | **401** | exists, denied |
| `customer_pickup_slots` | **401** | exists, denied |
| `customer_payments` | **401** | exists, denied |
| `customer_order_status_history` | **401** | exists, denied |
| `customer_shop_staff` | **401** | exists, denied |

Control: a deliberately fake table returns `404`, proving the `401`s are real
denials and not a missing-table artefact.

**Conclusion:** every table in the team schema already exists. Nothing needs
creating. The `401`s are a PostgREST schema-cache and GRANT issue, fixed with
`notify pgrst, 'reload schema';` — not DDL.

---

## 2. Overlap resolution

### shops vs customer_shops — no overlap, only one shop table exists

There is no `shops` table in the database. `customer_shops` is the only one.

```
customer_shops
  id, name, address, phone, pickup_counter, preparation_minutes,
  active, profile_id → profiles.id, hub_id → pickup_hubs.id,
  is_open, opened_at, timezone, pickup_open, pickup_close,
  pickup_interval_minutes, max_orders_per_slot
```

Ownership is `profile_id`, **not** `owner_id`. Note there is no `description`,
`category` or `image_url` column.

### products vs customer_products — no overlap

There is no `products` table. `customer_products` is the only one.

```
customer_products
  id, shop_id → customer_shops.id, name, unit,
  price_lkr (integer), regular_price_lkr (integer), image_url,
  active, available, stock_quantity, substitute_for → self
```

No `description`, no `category`, no `created_at`/`updated_at`.

### products.stock_quantity vs shop_inventory.quantity — this one is a genuine design decision

Both exist and they can disagree:

| | `customer_products.stock_quantity` | `shop_inventory.quantity` |
|---|---|---|
| Purpose | customer-facing availability | shop's own stock record |
| `low_stock_threshold` | ✗ absent | ✓ **present** |
| `is_available` / `available` | `available` | `is_available` |
| Row per product | no, inline | yes, own row |

**Recommendation: `shop_inventory` is the source of truth for stock**, because
only it has a per-product threshold, which the Stock Update screen needs
("Low Stock" tab). `customer_products.stock_quantity` is a denormalised
customer-facing copy. Writes must update both, or the two drift.

This is the same conclusion I reached earlier, and it is now backed by the
verified schema rather than assumption.

---

## 3. Per-feature recommendation

### Home — read products, categories, featured
- **Table:** `customer_products` for products. **No category table exists.**
- **Columns:** `id, name, unit, price_lkr, regular_price_lkr, image_url, available, stock_quantity, shop_id`
- **Relationships:** `customer_products.shop_id → customer_shops.id`
- **Column to add:** `category_id uuid` → `product_categories.id`, nullable. **A `product_categories` table must also exist** — there is none today.
- **Modify existing table:** yes, `customer_products` needs the additive nullable column.
- **RLS available:** yes, once the cache is reloaded.
- **Cache reload:** yes.

### Search — filtered results + history
- **Table:** `customer_products`. History has **no table**.
- **Columns:** filter on `name`, `unit`, `price_lkr`, `available`, `stock_quantity`, `shop_id`
- **Relationships:** `shop_id → customer_shops.id`
- **To add:** `search_history` table (user-scoped CRUD). Does not exist.
- **Modify existing:** no.
- **RLS:** new table needs policies; catalogue read policies already exist.
- **Cache reload:** yes.

### Product Details — product, favourite, review
- **Table:** `customer_products`. Favourites and reviews have **no tables**.
- **Columns:** all above.
- **To add:** `favourites` and `reviews` tables. Neither exists.
- **Modify existing:** no.
- **RLS:** user-scoped policies needed on both new tables.
- **Cache reload:** yes.

### Shop Management — CRUD shops and listings
- **Table:** `customer_shops` + `customer_products`. **Nothing to create.**
- **Columns:** as listed above.
- **Relationships:** `profile_id → profiles.id`, `hub_id → pickup_hubs.id`, `shop_id → customer_shops.id`
- **To add:** nothing.
- **Modify existing:** no.
- **RLS:** needs a policy allowing a user to manage rows where
  `profile_id = auth.uid()`. Confirm one exists.
- **Cache reload:** yes.

### Stock Update — read, update, adjustment log
- **Table:** `shop_inventory` + `customer_products`. Log has **no table**.
- **Columns:** `quantity`, `low_stock_threshold`, `is_available`, `shop_id`, `product_id`
- **To add:** `stock_adjustments` table for the audit trail.
- **Modify existing:** no.
- **RLS:** shop-scoped policy needed.
- **Cache reload:** yes.

### Shop Dashboard — sales and stock stats, open/closed
- **Table:** `customer_orders` (sales), `shop_inventory` (stock), `customer_shops` (open status).
- **Columns:** `status`, `total_lkr`, `created_at`, `collected_at`-equivalent (`ready_at`/`updated_at`); `is_open`, `opened_at`
- **To add:** nothing.
- **Modify existing:** no.
- **RLS:** shop must be able to read its own orders — confirm.
- **Cache reload:** yes.
- **Note:** currently the dashboard renders hardcoded `LKR 68,400`.

### Reports — generate, read, delete
- **Table:** no report table exists. Sales source is `customer_orders`.
- **To add:** `reports` table to persist generated snapshots.
- **Modify existing:** no.
- **RLS:** shop-scoped.
- **Cache reload:** yes.

### Help & Support — ticket CRUD
- **Table:** no support table exists at all.
- **To add:** `support_tickets` table. FAQ content can stay in the screen.
- **Modify existing:** no.
- **RLS:** user-scoped.
- **Cache reload:** yes.

---

## 4. Recommended final structure

**Reuse, never duplicate.** No `shops`, no `products`.

```
EXISTING — use as-is
  customer_shops          shop records, ownership via profile_id
  customer_products       product catalogue, shop_id FK
  shop_inventory          stock source of truth + low_stock_threshold
  customer_orders         sales figures for dashboard and reports

EXISTING — one additive change
  customer_products.category_id uuid → product_categories.id  (nullable)

MISSING — required by Member 2 scope
  product_categories      Home category browsing
  search_history          Search history CRUD
  favourites              Product Details favourites
  reviews                 Product Details reviews
  stock_adjustments       Stock Update audit log
  reports                 Reports CRUD
  support_tickets         Help & Support ticket CRUD

NOT RECOMMENDED
  shops, products         duplicates of customer_shops / customer_products
```

Seven new tables, all Member 2 specific. Zero duplicates of team tables.

---

## 5. Fix the 401s before writing any code

The `401`s are the more urgent problem. They are not DDL, so no migration is
needed:

```sql
notify pgrst, 'reload schema';
```

Then confirm the `authenticated` role has grants. A `401` that survives the
reload means the GRANT is missing, e.g.:

```sql
grant select on public.customer_shops, public.customer_products,
  public.customer_orders, public.shop_inventory to authenticated;
```

Verify by signing in and reading one row from `customer_shops`. Until this is
resolved, every screen that reads the catalogue will fail regardless of which
tables exist.

## 6. RLS status

Policies are defined in migrations 002 and 004 for `pickup_hubs`, `profiles`
and `notifications`. The team schema's policies are **not visible in this
repository** — `005_customer_ordering.sql` is present on disk but I could not
confirm it has been applied. The `401`s suggest either no grant or no
permissive policy for the `authenticated` role on the `customer_*` tables.

This needs confirming in the Supabase dashboard under **Authentication →
Policies** before assuming the screens will work.