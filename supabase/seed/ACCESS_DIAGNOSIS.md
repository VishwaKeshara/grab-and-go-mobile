# 401 Diagnosis — customer_* tables

**Nothing was created, altered or dropped in Supabase. This is read-only analysis plus proposed SQL that you must review and run yourself.**

---

## 1. What I can prove

### The tables exist

| Result | Tables | Meaning |
|---|---|---|
| `200` | `pickup_hubs`, `profiles`, `notifications`, `shop_inventory`, `pickup_verifications`, `security_events` | reachable |
| `401` | `customer_shops`, `customer_products`, `customer_orders`, `customer_order_items`, `shop_staff`, `customer_carts`, `customer_cart_items`, `customer_pickup_slots`, `customer_payments`, `customer_order_status_history`, `customer_shop_staff` | denied |
| `404` | a deliberately fake table | control |

The fake table proves `401` is a real access denial, not a missing table.

### My probes were anonymous — this matters

Every probe used the project's **publishable** key with no user session. That
maps to the `anon` role, **not** `authenticated`.

```
/auth/v1/settings → disable_signup: false
                  → mailer_autoconfirm: false
                  → external.google: true, external.email: true
                  → anonymous_users: false
```

`mailer_autoconfirm: false` means a new signup is unconfirmed, so I **cannot
obtain an `authenticated` JWT** to test the real user path. Phone auth is off.

**Therefore I cannot yet prove the signed-in app is blocked.** The `401`s I
observed prove that `anon` is denied. That is correct and expected — anonymous
users should not read your catalogue.

---

## 2. The critical discovery: this repo is out of sync with your database

`supabase/migrations/005_customer_ordering.sql` describes **4 tables**. Your
live database has **17**.

| | Repo 005 | Live schema |
|---|---|---|
| `customer_shops` columns | 7 | **12** — adds `profile_id`, `hub_id`, `is_open`, `opened_at`, `timezone`, `pickup_open`, `pickup_close`, `pickup_interval_minutes`, `max_orders_per_slot` |
| `customer_products` columns | 8 | **10** — adds `available`, `stock_quantity`, `substitute_for` |
| `customer_orders` columns | ~24 | adds `pickup_slot_id`, `pickup_mode`, `accepted_at`, `packing_started_at`, `ready_at` |
| `customer_order_items` | 10 | adds `is_packed`, `packed_at`, `regular_price_lkr` |
| Tables | 4 | **17** — adds `shop_staff`, `shop_inventory`, `pickup_verifications`, `security_events`, `customer_carts`, `customer_cart_items`, `customer_pickup_slots`, `customer_payments`, `customer_order_status_history`, `customer_shop_staff` |

The live database was built from a **different, later migration** that is not
in this repository — probably another member's branch or direct dashboard work.

**Consequence: the repo's grants and policies do not describe your database.**
Repo 005 contains only:

```sql
grant select on public.customer_shops, public.customer_products,
  public.customer_orders, public.customer_order_items to authenticated;
```

and four `create policy` statements. Nothing about `shop_inventory`,
`customer_carts`, `customer_pickup_slots` or the other 10 tables.

I therefore **cannot tell you the live policies from source** — they are not in
this repo.

---

## 3. Two competing explanations for the 401

Both fit the evidence. They need different fixes.

### Hypothesis A — PostgREST schema cache is stale (most likely)

The split is telling:

```
reachable: shop_inventory, pickup_verifications, security_events
denied:    all customer_* plus shop_staff
```

That looks like a **time boundary**. Tables that existed at the last cache
reload are visible; tables created after it are not. The last reload happened
somewhere after `security_events` and before `customer_shops`.

Supporting evidence: if a broad `grant ... to anon, authenticated` was applied
when the live DB was built, then `anon` **would** have SELECT on
`customer_shops` too — and the only remaining reason for a denial would be
cache invisibility.

Fix is one line, no DDL, no policy change:

```sql
notify pgrst, 'reload schema';
```

### Hypothesis B — missing GRANT for `authenticated`

`shop_inventory` returns `200` while `customer_shops` returns `401`. If both
have identical grants and RLS, they should behave the same. Something
distinguishes them.

Note this nuance: `shop_inventory` returns `200` **to anon**, which means anon
holds a grant on it. A catalogue table holding a grant for anon but not for
`authenticated` would be a misconfiguration — anon able to read, signed-in
users blocked.

Fix is explicit grants:

```sql
grant select on public.customer_shops, public.customer_products,
  public.customer_orders, public.customer_order_items,
  public.shop_inventory, public.customer_carts, public.customer_cart_items,
  public.customer_pickup_slots, public.customer_payments,
  public.customer_order_status_history, public.customer_shop_staff,
  public.shop_staff, public.pickup_verifications, public.security_events
  to authenticated;
```

---

## 4. The one query that settles it

Run this in **SQL Editor** and paste me the output. It reads
`information_schema` directly, bypassing PostgREST entirely.

```sql
select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_enabled,
  has_table_privilege('authenticated', c.oid, 'select') as auth_can_select,
  has_table_privilege('anon',         c.oid, 'select') as anon_can_select,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

Interpretation:

| Reading | Cause | Fix |
|---|---|---|
| `rls_enabled = true`, `auth_can_select = true`, tables present | policies are blocking rows | check the policies listed below |
| `auth_can_select = false` | Hypothesis B | run the GRANT |
| every table present with correct grants | Hypothesis A | `notify pgrst, 'reload schema';` |

If the tables are **absent** from this output, they are not in `public` — send
me the result and I will adapt.

To see the live policies, run:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'customer_shops','customer_products','customer_orders',
    'customer_carts','customer_pickup_slots','customer_payments',
    'shop_inventory','shop_staff','customer_order_items',
    'customer_cart_items','customer_order_status_history','customer_shop_staff',
    'pickup_verifications','security_events'
  )
order by tablename, policyname;
```

---

## 5. Ownership model — stated before I change anything

You asked me not to alter ownership logic without explaining it. The live
schema uses:

```
customer_shops.profile_id → profiles.id
customer_shop_staff (shop_id, user_id) → many-to-many staff assignment
profiles.role ∈ ('customer','shop','admin')
```

So a **shop** is identified by `customer_shops.profile_id = auth.uid()`.
There is no `owner_id` column. Any shop-scoped policy must use `profile_id`.

The repo's stale migration ignores this — its `customer_shops` has no
`profile_id` at all, so its policies could never scope by owner. That is a
second reason the repo cannot be trusted for policy authoring.

---

## 6. Can I execute the fix?

**No. It must be run manually in the Supabase SQL Editor.**

| Route | Result |
|---|---|
| Publishable key over PostgREST | cannot run `GRANT`, `CREATE POLICY` or `NOTIFY` |
| `sb_secret_` key over PostgREST | same — PostgREST exposes CRUD only, and Supabase blocks secret keys from non-server clients |
| `api.supabase.com` Management API | needs an `sbp_` **personal access token**; the earlier `sb_secret_` value returns `401 JWT could not be decoded` |
| Direct Postgres `:5432` / `:6543` | both unreachable from this network |

So: **you run the SQL, I write it.**

If you would rather I apply it, generate a personal access token at
**Account Preferences → API Tokens** (the `sbp_` type, not the secret key) and
`scripts/apply-migrations.ps1` will run it for you.

---

## 7. Stock synchronisation, explained not changed

You asked how `shop_inventory.quantity` and `customer_products.stock_quantity`
stay consistent.

**Proposal: `shop_inventory` is authoritative.**

- It is the only table with `low_stock_threshold`, which the Low Stock tab needs.
- It carries `updated_at` per change; `customer_products` has no timestamps.

`customer_products.stock_quantity` then acts as a **denormalised read
projection** for the customer catalogue, where a join to `shop_inventory` on
every product list would be wasteful.

**Every write must therefore update both in one operation.** My
`saveStock()` already does exactly this:

```ts
if (inventoryRowExists) update shop_inventory set quantity, is_available
always                update customer_products set stock_quantity, available
```

There is no database trigger, so nothing enforces this if another client
writes directly. Options, none of which I will implement without your approval:

1. **Application-level only** — current behaviour. Simplest, but a direct SQL
   write or another member's code can desynchronise the two.
2. **Database trigger** on `shop_inventory` that mirrors into
   `customer_products`. Guarantees consistency for every writer. This is the
   option I would recommend if other members also write stock.
3. **Drop `customer_products.stock_quantity`** and have reads join. Cleanest
   model, but changes another member's table and their queries.

I have implemented option 1 only. Tell me which you want before I touch it.

---

## 8. Proposed fix, pending your approval

**Step 1 — settle the cause.** Run the two queries in section 4 and send me
the output.

**Step 2 — most likely fix, if Hypothesis A:**

```sql
notify pgrst, 'reload schema';
```

**Step 3 — only if the diagnostic shows `auth_can_select = false`:**

```sql
grant usage on schema public to authenticated;

grant select on public.customer_shops, public.customer_products,
  public.customer_orders, public.customer_order_items,
  public.shop_inventory, public.customer_carts, public.customer_cart_items,
  public.customer_pickup_slots, public.customer_payments,
  public.customer_order_status_history, public.customer_shop_staff,
  public.shop_staff, public.pickup_verifications, public.security_events
  to authenticated;

grant insert, update, delete on public.customer_shops,
  public.customer_products, public.shop_inventory to authenticated;
```

No table is created, dropped or altered. RLS is never disabled.

**Step 4 — shop-owner policies, only if step 3 is not enough.** These scope by
`profile_id`, which is why I am not writing them blind:

```sql
drop policy if exists "Shop owners can manage their shop" on public.customer_shops;
create policy "Shop owners can manage their shop" on public.customer_shops
  for all to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()))
  with check (profile_id = (select auth.uid()) or (select public.is_admin()));
```

Send me the section 4 output and I will confirm the cause rather than guess.