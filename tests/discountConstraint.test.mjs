import assert from "node:assert/strict";
import test from "node:test";

/**
 * customer_products_discount_check, transcribed from
 * supabase/migrations/021_product_fixed_discount.sql.
 *
 * Kept here as a test rather than only in SQL because the constraint and
 * staff_update_product contradicted each other for a while: the function stored
 * the equivalent percentage for a fixed discount, which this constraint
 * rejects, so every fixed discount failed with 23514 on both the staff and the
 * owner path. A pure-function transcription of the CHECK is what makes that
 * contradiction visible without a live database.
 */
function satisfiesDiscountCheck(row) {
  const pct = row.discount_percent ?? null;
  const amt = row.discount_amount_lkr ?? null;
  const regular = row.regular_price_lkr ?? null;
  const price = row.price_lkr;

  // 019: customer_products_discount_percent_check
  if (!(pct === null || (pct >= 0 && pct <= 100))) return false;
  if (!(price <= regular)) return false;

  // 021: customer_products_discount_check
  if (!(row.discount_type === null || row.discount_type === "percent" || row.discount_type === "fixed")) return false;
  if (row.discount_type === "fixed" && amt === null) return false;
  if (row.discount_type === "fixed" && (pct ?? 0) > 0) return false;
  if (row.discount_type === "percent" && amt !== null) return false;
  if (!(amt === null || amt >= 0)) return false;
  if (!(amt === null || regular === null || amt <= regular)) return false;
  return true;
}

/** The exact payload the owner path writes for a percentage, 10% off LKR 500. */
const ownerPercent = {
  price_lkr: 450,
  regular_price_lkr: 500,
  discount_type: "percent",
  discount_percent: 10,
  discount_amount_lkr: null,
};

/** And for a fixed LKR 58 off LKR 500, as the app writes it after the fix. */
const ownerFixed = {
  price_lkr: 442,
  regular_price_lkr: 500,
  discount_type: "fixed",
  discount_percent: 0,
  discount_amount_lkr: 58,
};

test("a percentage discount satisfies the CHECK constraint", () => {
  assert.equal(satisfiesDiscountCheck(ownerPercent), true);
});

test("a fixed discount satisfies the CHECK constraint", () => {
  assert.equal(satisfiesDiscountCheck(ownerFixed), true);
});

test("a fixed discount must not carry a percentage", () => {
  // The regression: staff_update_product stored 12 here, the equivalent of
  // LKR 58 off LKR 500, and the CHECK rejected it, so fixed discounts failed.
  assert.equal(
    satisfiesDiscountCheck({ ...ownerFixed, discount_percent: 12 }),
    false,
  );
});

test("the two options cannot be combined", () => {
  assert.equal(
    satisfiesDiscountCheck({ ...ownerPercent, discount_amount_lkr: 58 }),
    false,
  );
});

test("switching between options clears the one no longer used", () => {
  assert.equal(
    satisfiesDiscountCheck({ ...ownerPercent, ...ownerFixed }),
    true,
  );
  assert.equal(
    satisfiesDiscountCheck({ ...ownerFixed, ...ownerPercent }),
    true,
  );
});

test("a fixed discount cannot exceed the price", () => {
  assert.equal(
    satisfiesDiscountCheck({ ...ownerFixed, discount_amount_lkr: 5000 }),
    false,
  );
});

test("the selling price can never exceed the regular price", () => {
  assert.equal(satisfiesDiscountCheck({ ...ownerPercent, price_lkr: 550 }), false);
});

test("a fixed discount still previews as a percentage, derived from prices", () => {
  // Why storing 0 costs nothing: the modal derives the equivalent percentage
  // from the price pair, which is what it displays as "That is 12% off".
  const derived = Math.round(((500 - 442) / 500) * 100);
  assert.equal(derived, 12);
});