# Member 2 — Manual Table Creation (Supabase Table Editor)

12 tables. Follow **Part A** (tables) then **Part B** (RLS policies).
Creating the table alone is not enough — see Part B.

## Type mapping for the Type dropdown

| SQL | Pick in the dropdown |
|---|---|
| `uuid` | uuid |
| `text` | text |
| `integer` | int4 |
| `numeric` | numeric |
| `boolean` | bool |
| `timestamptz` | timestamptz |
| `date` | date |
| `jsonb` | jsonb |
| `text[]` | text, then toggle the array switch |

Default-value box: type it **without** SQL keywords where noted. Use the exact
string given in each row.

## Part A — create the 12 tables

### 1. product_categories
Name: `product_categories` · RLS **on** · Realtime **off** · Data API **on**

| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| name | text | — | |
| slug | text | — | |
| icon | text | `'basket'` | |
| tint | text | `'#171543'` | |
| sort_order | int4 | `0` | |
| is_active | bool | `true` | |
| created_at | timestamptz | `now()` | |

No foreign keys.

### 2. reviews
Name: `reviews` · RLS **on** · Realtime **off** · Data API **on**

| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| product_id | uuid | — | |
| user_id | uuid | — | |
| rating | int4 | — | |
| comment | text | `''` | |
| created_at | timestamptz | `now()` | |

Foreign keys — **Add foreign key relation**:
- `product_id` → table `customer_products`, column `id`, on delete **Cascade**
- `user_id` → schema `auth`, table `users`, column `id`, on delete **Cascade**

### 3. favourites
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| user_id | uuid | — | |
| product_id | uuid | — | |
| created_at | timestamptz | `now()` | |

Foreign keys: `user_id` → auth.users.id Cascade · `product_id` → customer_products.id Cascade

### 4. search_history
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| user_id | uuid | — | |
| query | text | — | |
| result_count | int4 | `0` | |
| created_at | timestamptz | `now()` | |

Foreign keys: `user_id` → auth.users.id Cascade

### 5. support_tickets
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| user_id | uuid | — | |
| shop_id | uuid | — | |
| subject | text | — | |
| category | text | `'General'` | |
| message | text | — | |
| status | text | `'open'` | |
| priority | text | `'normal'` | |
| contact_email | text | — | |
| resolution | text | — | |
| resolved_at | timestamptz | — | |
| created_at | timestamptz | `now()` | |
| updated_at | timestamptz | `now()` | |

Foreign keys: `user_id` → auth.users.id Cascade · `shop_id` → customer_shops.id **Set null**

### 6. stock_adjustments
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| shop_id | uuid | — | |
| product_id | uuid | — | |
| user_id | uuid | — | |
| previous_quantity | int4 | — | |
| new_quantity | int4 | — | |
| delta | int4 | — | |
| reason | text | `''` | |
| created_at | timestamptz | `now()` | |

Foreign keys: `shop_id` → customer_shops.id Cascade · `product_id` → customer_products.id Cascade · `user_id` → auth.users.id **Set null**

### 7. featured_products
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| product_id | uuid | — | |
| headline | text | `''` | |
| sort_order | int4 | `0` | |
| starts_at | timestamptz | — | |
| ends_at | timestamptz | — | |
| is_active | bool | `true` | |
| created_at | timestamptz | `now()` | |

Foreign keys: `product_id` → customer_products.id Cascade

### 8. reports
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| shop_id | uuid | — | |
| created_by | uuid | — | |
| title | text | — | |
| report_type | text | `'sales'` | |
| period_start | timestamptz | — | |
| period_end | timestamptz | — | |
| total_orders | int4 | `0` | |
| total_revenue | int4 | `0` | |
| payload | jsonb | `'{}'::jsonb` | |
| created_at | timestamptz | `now()` | |

Foreign keys: `shop_id` → customer_shops.id Cascade · `created_by` → auth.users.id Cascade

### 9. settlement_batches
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| node_id | text | `'Malabe Node'` | |
| provider | text | `'LankaPay'` | |
| batch_reference | text | — | |
| total_amount | int4 | `0` | |
| clearing_buffer | text | `''` | |
| payout_ready_at | timestamptz | — | |
| gateway_name | text | `''` | |
| matched | bool | `false` | |
| generated_at | timestamptz | `now()` | |
| created_at | timestamptz | `now()` | |

No foreign keys.

### 10. node_metrics
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| node_id | text | `'Malabe Node'` | |
| service_level | text | `'queue-bypass'` | |
| route_label | text | `''` | |
| detail | text | `''` | |
| avg_handover_seconds | numeric | `0` | |
| sla_hit_rate | numeric | `0` | |
| sample_count | int4 | `0` | |
| measured_on | date | `current_date` | |

No foreign keys. Precision `(8,2)` and `(5,2)` cannot be set in this form —
plain `numeric` is fine.

### 11. report_manifests
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| title | text | — | |
| subtitle | text | `''` | |
| tag | text | `''` | |
| icon | text | `'doc'` | |
| tone | text | `'ink'` | |
| file_formats | text **array** | `'{}'` | |
| size_label | text | `''` | |
| status_label | text | `''` | |
| status_tone | text | `'good'` | |
| detail | text | `''` | |
| metrics | jsonb | `'{}'::jsonb` | |
| locked | bool | `false` | |
| sort_order | int4 | `0` | |
| is_published | bool | `true` | |
| created_at | timestamptz | `now()` | |

No foreign keys.

### 12. dispatch_settings
| Column | Type | Default | Primary |
|---|---|---|---|
| id | uuid | `gen_random_uuid()` | yes |
| node_id | text | — | **yes** |
| enabled | bool | `true` | |
| window_label | text | `''` | |
| recipient_email | text | `''` | |
| payload_label | text | `''` | |
| updated_at | timestamptz | `now()` | |

No foreign keys. `node_id` is the primary key here, not `id`.

### 13. One extra change
Go to table `customer_products` → **Add column**:
- Name `category_id`, Type `uuid`, Default leave empty

Then add a foreign key on it → `product_categories.id`, on delete **Set null**.

Without this, Home cannot read real categories.

### 14. Required function
Create this function, because the reports and stock_adjustments policies use it.
Supabase Dashboard → **Database → Functions** → create, SQL editor:

```sql
create or replace function public.owns_customer_shop(target_shop_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.customer_shops
    where id = target_shop_id and profile_id = (select auth.uid())
  );
$$;

grant execute on function public.owns_customer_shop(uuid) to authenticated;
```

## Part B — RLS policies (do not skip)

Left sidebar → **Policies** → **Create policy**. Pick the table, then use these.

### product_categories
- **read**, `authenticated`, using `is_active = true`
- **all**, `authenticated`, using `(select public.is_admin())`, check `(select public.is_admin())`

### reviews
- **read**, `authenticated`, using `true`
- **insert**, `authenticated`, check `user_id = (select auth.uid())`
- **update**, `authenticated`, using `user_id = (select auth.uid())`, check `user_id = (select auth.uid())`
- **delete**, `authenticated`, using `user_id = (select auth.uid())`

### favourites
- **read**, `authenticated`, using `user_id = (select auth.uid())`
- **insert**, `authenticated`, check `user_id = (select auth.uid())`
- **delete**, `authenticated`, using `user_id = (select auth.uid())`

### search_history
- **read**, `authenticated`, using `user_id = (select auth.uid())`
- **insert**, `authenticated`, check `user_id = (select auth.uid())`
- **delete**, `authenticated`, using `user_id = (select auth.uid())`

### support_tickets
- **read**, `authenticated`, using `user_id = (select auth.uid()) or (select public.is_admin())`
- **insert**, `authenticated`, check `user_id = (select auth.uid())`
- **update**, `authenticated`, using `user_id = (select auth.uid())`, check `user_id = (select auth.uid())`
- **delete**, `authenticated`, using `user_id = (select auth.uid())`

### stock_adjustments
- **read**, `authenticated`, using `(select public.owns_customer_shop(shop_id)) or (select public.is_admin())`
- **insert**, `authenticated`, check `(select public.owns_customer_shop(shop_id)) or (select public.is_admin())`

### featured_products
- **read**, `authenticated`, using `is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())`
- **all**, `authenticated`, using `(select public.is_admin())`, check `(select public.is_admin())`

### reports
- **read**, `authenticated`, using `(select public.owns_customer_shop(shop_id)) or (select public.is_admin())`
- **insert**, `authenticated`, check `(select public.owns_customer_shop(shop_id)) and created_by = (select auth.uid())`
- **delete**, `authenticated`, using `(select public.owns_customer_shop(shop_id)) or (select public.is_admin())`

### settlement_batches / node_metrics / dispatch_settings
For each of these three:
- **read**, `authenticated`, using `true`
- **all**, `authenticated`, using `(select public.is_admin())`, check `(select public.is_admin())`

### report_manifests
- **read**, `authenticated`, using `is_published = true`
- **all**, `authenticated`, using `(select public.is_admin())`, check `(select public.is_admin())`

## Part C — load the seed data

Only after the tables and policies exist. Use the CSVs in this folder, or paste
the SQL file. Uploading a CSV **before** the table exists fails.

| CSV | Table |
|---|---|
| `product_categories.csv` | product_categories |
| `settlement_batches.csv` | settlement_batches |
| `node_metrics.csv` | node_metrics |
| `report_manifests.csv` | report_manifests |
| `dispatch_settings.csv` | dispatch_settings |

Not covered, because they need real user/shop/product UUIDs that a static
file cannot supply: `reviews`, `favourites`, `search_history`, `reports`,
`stock_adjustments`, `support_tickets`, `featured_products`.

## Faster alternative

All of the above is what `RUN_IN_SUPABASE_SQL_EDITOR.sql` does in one paste,
including the function, the policies, the `customer_products.category_id`
column and the seed data. Use the SQL Editor instead if you can find it — the
manual route above is roughly 200 individual form entries and it is easy to
mistype a default.

If you do it manually, verify at the end: `product_categories` and
`node_metrics` should each return rows, and the app must be **signed in** or
every query returns an empty array because RLS targets the `authenticated`
role.