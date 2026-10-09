import assert from "node:assert/strict";
import test from "node:test";

import {
  basePrice,
  discountAmount,
  discountMode,
  discountPercent,
  discountSummary,
  hasDiscount,
} from "../utils/discounts.ts";

/**
 * The discount reading behind the Offers filter and every "% off" badge.
 *
 * utils/discounts.ts is a pure module, so it is imported directly rather than
 * exercised through the Supabase client. The cases below are the ones the Offers
 * rail gets wrong if it only reads discount_percent: a fixed discount stores that
 * column as 0 by design (021's CHECK constraint forbids storing a percentage
 * alongside an amount), so a rail filtering on the column alone would hide every
 * fixed-amount promotion in the app.
 */

test("a percentage discount is read from the stored column", () => {
  const product = {
    price: 1350,
    regular_price: 1500,
    discount_percent: 10,
    discount_type: "percent",
    discount_amount_lkr: null,
  };

  assert.equal(discountMode(product), "percent");
  assert.equal(discountPercent(product), 10);
  assert.equal(basePrice(product), 1500);
  assert.equal(hasDiscount(product), true);
  assert.equal(discountSummary(product).label, "10% OFF");
});

test("a fixed discount is read from the stored amount, not the 0 percent", () => {
  // discount_percent is 0 here on purpose -- 021 stores 0 for a fixed discount.
  const product = {
    price: 1440,
    regular_price: 1500,
    discount_percent: 0,
    discount_type: "fixed",
    discount_amount_lkr: 60,
  };

  assert.equal(discountMode(product), "fixed");
  assert.equal(discountAmount(product), 60);
  // Still reported as a percentage so a shopper can compare it against a
  // percentage promotion on another product.
  assert.equal(discountPercent(product), 4);
  assert.equal(hasDiscount(product), true);
  assert.equal(discountSummary(product).label, "LKR 60 OFF");
});

test("a row written before 019 has neither column and is read from its prices", () => {
  const product = { price: 1800, regular_price: 2000 };

  assert.equal(discountPercent(product), 10);
  assert.equal(discountAmount(product), 200);
  assert.equal(hasDiscount(product), true);
  assert.equal(discountSummary(product).label, "10% OFF");
});

test("an undiscounted product reports no discount at all", () => {
  const product = { price: 1500, regular_price: 1500 };

  assert.equal(discountPercent(product), 0);
  assert.equal(discountAmount(product), 0);
  assert.equal(hasDiscount(product), false);
  assert.equal(discountSummary(product).hasDiscount, false);
});

test("a regular price below the selling price is treated as no discount", () => {
  // A price rise looks like a negative discount. Reading it as one would put an
  // "OFF" badge on a product that is not discounted, so it is clamped to zero.
  const product = { price: 1600, regular_price: 1500 };

  assert.equal(discountPercent(product), 0);
  assert.equal(hasDiscount(product), false);
});

test("a zero regular price never divides by zero", () => {
  const product = { price: 1500, regular_price: 0 };

  assert.equal(discountPercent(product), 0);
  assert.equal(discountAmount(product), 0);
  assert.equal(hasDiscount(product), false);
});

test("a missing regular price falls back to the selling price as the base", () => {
  // Some rows were created before regular_price_lkr was recorded on every row, so
  // "was" must never render above "now" for them.
  const product = { price: 900, regular_price: null };

  assert.equal(basePrice(product), 900);
  assert.equal(discountPercent(product), 0);
  assert.equal(hasDiscount(product), false);
});

/**
 * The orderability conditions, transcribed from
 * supabase/migrations/012_unify_inventory_source.sql → change_customer_cart.
 *
 * These matter because discoveryService's query is now an INNER join with exactly
 * these three filters. It previously LEFT joined and fell back to the denormalised
 * stock column, which listed products the RPC refuses: tapping Add threw, and
 * because react-native-web's Alert.alert is a no-op the tap looked like it had
 * done nothing at all. Keeping the predicate here makes the agreement between the
 * query and the RPC something a test can check, rather than a comment.
 */
function cartAccepts(row) {
  return (
    row.active === true &&
    row.is_available === true &&
    row.stock_quantity >= 1 &&
    row.substitute_for == null &&
    row.shop_active === true
  );
}

/** A plain, orderable listing. */
const orderable = {
  active: true,
  is_available: true,
  stock_quantity: 4,
  substitute_for: null,
  shop_active: true,
};

test("a stocked, available listing is one the cart will accept", () => {
  assert.equal(cartAccepts(orderable), true);
});

test("a listing with no inventory row is refused by the cart", () => {
  // This is the case the LEFT join used to leak into the browse lists.
  assert.equal(cartAccepts({ ...orderable, stock_quantity: 0 }), false);
});

test("a listing the shop has switched off is refused", () => {
  assert.equal(cartAccepts({ ...orderable, is_available: false }), false);
});

test("a substitute is refused as a cart line", () => {
  // It exists only to be swapped in for another product.
  assert.equal(cartAccepts({ ...orderable, substitute_for: "other-uuid" }), false);
});

test("an archived listing or a closed shop is refused", () => {
  assert.equal(cartAccepts({ ...orderable, active: false }), false);
  assert.equal(cartAccepts({ ...orderable, shop_active: false }), false);
});

test("a discount does not affect whether a listing can be added", () => {
  // Offers are a price change, not an availability change. An offer on a
  // well-stocked product still has to pass the same cart check.
  const onOffer = { ...orderable, price: 1350, regular_price: 1500 };

  assert.equal(cartAccepts(onOffer), true);
  assert.equal(discountPercent(onOffer), 10);
  assert.equal(hasDiscount(onOffer), true);
});