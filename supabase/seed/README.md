# Member 2 seed data (CSV)

Reference rows for the tables created in
`supabase/migrations/008_member2_reviews_favourites_reports.sql` and
`009_member2_categories_stock_log_tickets.sql`.

## Order matters

1. Run `RUN_IN_SUPABASE_SQL_EDITOR.sql` first. **A CSV cannot create a
   table** — the upload only inserts rows into tables that already exist.
2. These CSVs are then **optional**. That SQL already seeds
   `product_categories`, `settlement_batches`, `node_metrics`,
   `report_manifests` and `dispatch_settings`, so uploading these on top adds
   duplicates.

Use the CSVs if you skipped the seed block in the SQL, or want to load the
data into a different environment.

## Files

| File | Rows | Notes |
|---|---|---|
| `product_categories.csv` | 6 | Fruits, Vegetables, Dairy & Chilled, Pantry Staples, Beverages, Household |
| `settlement_batches.csv` | 1 | LankaPay Batch #992-BOC, LKR 384,200 |
| `node_metrics.csv` | 7 | One row per day for the SLA sparkline |
| `report_manifests.csv` | 4 | The four manifest cards on Reports |
| `dispatch_settings.csv` | 1 | Nightly dispatch toggle config |

## Tables deliberately not covered

These need UUIDs that must already exist in `auth.users`,
`customer_shops` or `customer_products`, so they cannot be loaded from a
static file:

`reviews`, `favourites`, `search_history`, `reports`, `stock_adjustments`,
`support_tickets`, `featured_products`

They are populated by the app at runtime, or once you have real user and
shop ids.

## Format notes

- No byte-order mark. A BOM makes Supabase read the first header as
  `ï»¿id`, which fails the upload.
- Headers must match column names exactly, using only letters, digits and
  underscores.
- `text[]` uses the Postgres literal form, e.g. `{CSV,PDF}`.
- `jsonb` holds valid JSON; inner double quotes are doubled per CSV rules.
- Datetimes use `YYYY-MM-DD HH:MM:SS`.
- `id` is omitted on purpose so `gen_random_uuid()` supplies it and re-uploads
  do not collide with an existing primary key.