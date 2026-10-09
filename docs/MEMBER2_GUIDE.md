# Member 2 — Product & Shop Management

Page-by-page walkthrough. Each entry gives the user story, where the data comes
from, and the honest current status.

## Read this first

Two things gate almost every screen:

1. **The SQL migration must be run.** Until then the tables aren't reachable
   and the screens error.
2. **You must be signed in.** RLS targets the `authenticated` role, so a
   signed-out session receives `[]` from every table — you see empty lists,
   not errors.

---

## Who signs in as what

The app has one sign-in. Role comes from `profiles.role`:

| Role | Where they land |
|---|---|
| `customer` | customer screens — home, search, product details |
| `shop` | shop screens — dashboard, stock, reports |
| `admin` | admin screens |

A shop owner is a normal account with `role = 'shop'`.

---

## 1. Home — `/home`

**Story:** A commuter opens the app and browses what's available near them.

**Reads:** `profiles` (their name and role), `pickup_hubs` (their preferred
pickup point).

**Should also read:** `customer_products` for products and
`product_categories` + the new `customer_products.category_id` for the
category rail.

**Status:** Partly wired. `homeService` reads profiles and hubs correctly, but
the **category tiles and product cards are hardcoded arrays in the screen**.
Wiring them to `product_categories` and `customer_products` is the remaining
work.

---

## 2. Search — `/search`

**Story:** A commuter types "milk" and gets matching products.

**Reads:** `customer_products`, joined to `customer_shops` for the shop name.
Filters on `name`, `unit`, `price_lkr`, `available`, `stock_quantity`.

**Writes:** `search_history` — one row per search, collapsed when you repeat
the same term. Delete a single entry or clear all.

**Status:** Fully wired. Search, sort, in-stock filter and history all work.

**Note:** there is no category filter because `customer_products` has no
category column. The new `category_id` column fixes that once the migration is
applied.

---

## 3. Product Details — `/product-details?id=<uuid>`

**Story:** A commuter taps a product to see price and leave a review.

**Reads:** `customer_products` joined to `customer_shops`.
**Writes:** `favourites` (add/remove), `reviews` (one per person per product —
posting again updates the existing review).

**Status:** Fully wired. Favourite toggle persists, star rating posts a review,
average rating and count display in the hero card.

**Needs a product id.** The screen reads `?id=` from the URL. Search is the
easiest way to get one — tap any result.

---

## 4. Shop Management — `/shop-management`

**Story:** A shop owner registers their shop and maintains its product list.

**Reads:** `customer_shops` where `profile_id = your user id`.
**Writes:** `customer_shops` and `customer_products` — create, edit, pause,
delete.

**Ownership rule:** `customer_shops.profile_id = auth.uid()`. There is no
`owner_id` column. RLS enforces this in the database, not just the app.

**Status:** Fully wired. Create shop, create/edit/delete listings, pause and
resume.

**Note:** no description or category fields, because `customer_products` has
neither column. The form uses `unit`, `pickup_counter`,
`preparation_minutes`, and separate selling/regular prices instead.

---

## 5. Stock Update — `/stock-update`

**Story:** A shop owner counts the shelf and corrects the numbers.

**Reads:** `shop_inventory` (quantity, `low_stock_threshold`, `is_available`)
joined to `customer_products` for name and price.

**Writes:** on every change it updates `shop_inventory.quantity` **and**
`customer_products.stock_quantity`, then appends a `stock_adjustments` row
recording previous quantity, new quantity, the delta, and who did it.

**Status:** Fully wired. `+`/`−` steppers, Restock +10, Mark Sold Out, and the
ON/OFF availability toggle all persist and are logged.

**The two stock columns.** `shop_inventory.quantity` is the source of truth
because it's the only one with a per-product `low_stock_threshold`, which the
Low Stock tab needs. `customer_products.stock_quantity` is a denormalised copy
for the customer catalogue, so a product list doesn't need a join.

Both are written in the same operation. **There is no database trigger**, so a
direct SQL write or another member's code could leave them out of step. Say the
word and I'll add a trigger to make it impossible.

---

## 6. Shop Dashboard — `/shop-dashboard`

**Story:** A shop owner opens the app and sees today's sales, and flips the
shop open or closed.

**Should read:** `customer_orders` for sales figures, `shop_inventory` for
stock warnings, `customer_shops.is_open` for the open/closed toggle.

**Status:** **Not wired.** The screen renders `LKR 68,400` revenue and
`LKR 54,200` settlement as literal text. There is no service call at all.
This is the biggest remaining gap in your scope.

---

## 7. Reports — `/reports`

**Story:** An operator reviews settlement batches and downloads manifests.

**Reads:** `settlement_batches`, `node_metrics`, `report_manifests`,
`dispatch_settings`.

**Writes:** `dispatch_settings.enabled` when you toggle Automated Dispatch.

**Status:** Wired to those four tables. LankaPay batch card, SLA sparkline
from 7 days of `node_metrics`, four manifest cards, dispatch toggle.

**Two gaps:**
- The **Download PDF / XLSX / Export All** buttons are present and tappable but
  report that they need `expo-file-system` and `expo-sharing`, which are not
  installed. Install them on a machine with working npm and wire the handlers.
- The numbers come from `settlement_batches` and `node_metrics`, **not** from
  `customer_orders`. Once order data exists, `generateReport()` should switch to
  real order aggregates.

---

## 8. Help & Support — `/help-support`

**Story:** A commuter can't find an answer and raises a ticket.

**Reads:** `customer_shops` for the Partner Stores list.
**Should write:** `support_tickets` — create, read, update status, delete.

**Status:** Search, 7 FAQs, contact cards and Partner Stores are built.
**The ticket feature is not built.** The `support_tickets` table and its
service functions exist in code, but no screen calls them.

**Also:** the FAQ answers are a hardcoded array. Moving them to a table would
let support edit them without a code deploy.

---

## Shop owner journey, end to end

1. Sign in at `/shop-login` with an account whose `profiles.role = 'shop'`
2. `/shop-dashboard` — sees sales and stock (**numbers currently hardcoded**)
3. `/shop-management` — creates the shop, adds product listings
4. `/stock-update` — sets quantities; every change is saved and logged
5. `/reports` — reviews settlement batches and manifests
6. `/help-support` — reads FAQs, contacts support

## Shop-to-customer journey

1. Customer signs in, lands on `/home` — categories and products
   (**currently hardcoded**)
2. `/search` — finds a product, filters by price and stock
3. `/product-details?id=…` — reads details, favourites it, leaves a review
4. Shop owner's listing in `/shop-management` is what they saw, because both
   sides read `customer_products`

---

## Priority order for the remaining work

| Priority | Item | Why |
|---|---|---|
| 1 | Run the SQL migration | Nothing works without it |
| 2 | Wire `/shop-dashboard` to `customer_orders` + `shop_inventory` | Only page with no data layer at all |
| 3 | Build the `/help-support` ticket UI | Service exists, screen missing |
| 4 | Wire `/home` to `product_categories` + `customer_products` | Hardcoded arrays |
| 5 | Move FAQ to a table | So support can edit without a deploy |
| 6 | Install `expo-file-system` + `expo-sharing` | Unblocks report downloads |
| 7 | Add a stock sync trigger | Prevents the two stock columns drifting |