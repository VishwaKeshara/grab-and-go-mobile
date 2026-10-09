import assert from "node:assert/strict";
import test from "node:test";

import {
  SUGGESTED_CATEGORIES,
  categoryIcon,
  categoryTint,
} from "../utils/categories.ts";

/**
 * The category presentation helpers behind the home rail and the shop form.
 *
 * utils/categories.ts is a pure module, so it is imported directly rather than
 * exercised through Supabase. It exists because migration 024 dropped the
 * product_categories table along with the category_id foreign key: the icon and
 * tint the rail used to read from that row are now derived from the free-text
 * category label, and these are the cases that derivation gets wrong.
 */

/** Stable in the sense that matters: the same input cannot pick a colour twice. */
function tintsFor(names, runs = 5) {
  return names.map((name) => {
    const seen = new Set();
    for (let i = 0; i < runs; i += 1) seen.add(categoryTint(name));
    return seen.size;
  });
}

test("the same category always gets the same tint", () => {
  assert.deepEqual(
    tintsFor(["Vegetables", "Fruits", "Dairy", "Bakery"]),
    [1, 1, 1, 1],
  );
});

test("capitalisation does not change the colour, so one shelf is one tile", () => {
  // Nothing normalises the stored text, so these are two different values in the
  // database that have to render identically.
  assert.equal(categoryTint("Vegetables"), categoryTint("vegetables"));
  assert.equal(categoryTint("VEGETABLES"), categoryTint("Vegetables"));
});

test("whitespace around the label does not change the colour", () => {
  assert.equal(categoryTint("  Fruits  "), categoryTint("Fruits"));
});

test("different categories generally get different tints", () => {
  // Not a strict requirement -- eight colours will collide with enough names --
  // but a rail where every tile matched one colour would have lost its point.
  const distinct = new Set(
    ["Vegetables", "Fruits", "Dairy", "Bakery", "Beverages", "Spices", "Meat"].map(
      (name) => categoryTint(name),
    ),
  );

  assert.ok(distinct.size > 1);
});

test("a keyword in the label picks a matching icon", () => {
  assert.equal(categoryIcon("Fresh Vegetables"), "leaf");
  assert.equal(categoryIcon("Tropical Fruits"), "lemon-o");
  assert.equal(categoryIcon("Dairy & Chilled"), "glass");
  assert.equal(categoryIcon("Bakery"), "birthday-cake");
  assert.equal(categoryIcon("Beverages"), "coffee");
  assert.equal(categoryIcon("Frozen Foods"), "snowflake-o");
});

test("the match is case-insensitive, because the stored text is free", () => {
  assert.equal(categoryIcon("vegetables"), categoryIcon("VEGETABLES"));
});

test("an unrecognised label falls back to the basket rather than nothing", () => {
  // A missing glyph renders as an empty box on some platforms, so the fallback
  // has to be a real icon rather than undefined.
  assert.equal(categoryIcon("Zorblax Widgets"), "shopping-basket");
  assert.equal(categoryIcon(""), "shopping-basket");
});

test("a blank label is still handled without throwing", () => {
  assert.doesNotThrow(() => categoryTint(""));
  assert.equal(typeof categoryIcon(""), "string");
});

test("the suggested categories are present, unique and self-describing", () => {
  // These are what the Add Product form offers on a shop's first product, so an
  // empty or duplicated list would either show nothing or show the same chip
  // twice.
  assert.ok(SUGGESTED_CATEGORIES.length > 0);
  assert.equal(
    new Set(SUGGESTED_CATEGORIES).size,
    SUGGESTED_CATEGORIES.length,
  );
  assert.ok(
    SUGGESTED_CATEGORIES.every((label) => label.trim() === label && label !== ""),
  );
});

test("the examples a shop would reach for are all offered", () => {
  const lower = SUGGESTED_CATEGORIES.map((label) => label.toLowerCase());

  for (const expected of ["fruits", "vegetables", "dairy"]) {
    assert.ok(
      lower.includes(expected),
      `expected a "${expected}" suggestion`,
    );
  }
});

test("every suggested category resolves to a real icon and tint", () => {
  // A seed list that renders a missing glyph or no colour would be worse than
  // no list, since it is what a shop sees on its very first product.
  for (const label of SUGGESTED_CATEGORIES) {
    assert.equal(typeof categoryIcon(label), "string");
    assert.match(categoryTint(label), /^#[0-9A-Fa-f]{6}$/);
  }
});