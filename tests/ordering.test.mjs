import assert from "node:assert/strict";
import test from "node:test";
import { addProductToCart, canTransition, cartTotals, isPickupSlotAvailable, isValidPhone } from "../utils/ordering.ts";
import { openShopPhone, shopTelUrl } from "../utils/shopPhone.ts";

test("cart totals use actual prices and quantities", () => {
  const items = [
    { product: { price: 280, regularPrice: 320 }, quantity: 2 },
    { product: { price: 420, regularPrice: 450 }, quantity: 1 },
  ];
  assert.deepEqual(cartTotals(items), { count: 2, units: 3, subtotal: 980, savings: 110 });
});

test("adding the same product increases its quantity without a duplicate row", () => {
  const product = { id: "bananas", name: "Bananas", unit: "500 g", price: 280, regularPrice: 320, image: "photo" };
  const once = addProductToCart([], product);
  const twice = addProductToCart(once, product);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].quantity, 2);
  assert.equal(twice[0].substitution.type, "call");
  assert.deepEqual(cartTotals(twice), { count: 1, units: 2, subtotal: 560, savings: 80 });
});

test("phone validation checks digit count and allowed characters", () => {
  assert.equal(isValidPhone("+94 77 123 4567"), true);
  assert.equal(isValidPhone("----------"), false);
  assert.equal(isValidPhone("+94 abc 123456"), false);
});

test("shop phone builds a safe dial link without opening it", () => {
  assert.equal(shopTelUrl("+94 (11) 234-5678"), "tel:+94112345678");
  assert.equal(shopTelUrl("011 234 5678"), "tel:0112345678");
  assert.equal(shopTelUrl("0094 11 234 5678"), "tel:+94112345678");
  assert.equal(shopTelUrl(null), null);
  assert.equal(shopTelUrl("+94 11 234 5678;123"), null);
  assert.equal(shopTelUrl("not available"), null);
});

test("shop phone opens only the normalized link through a mocked dialer", async () => {
  const opened = [];
  const number = await openShopPhone("+94 (11) 234-5678", async url => { opened.push(url); });
  assert.equal(number, "+94112345678");
  assert.deepEqual(opened, ["tel:+94112345678"]);
  await assert.rejects(openShopPhone(null, async url => { opened.push(url); }), /not provided/);
  assert.equal(opened.length, 1);
  await assert.rejects(openShopPhone("011 234 5678", async () => { throw new Error("unsupported"); }), /dialer could not be opened/);
});

test("pickup slots must allow preparation time and cannot be in the past", () => {
  const now = new Date("2026-10-01T11:20:00").getTime();
  const slot = start => ({ date: "2026-10-01", start, end: "12:30", mode: "scheduled" });
  assert.equal(isPickupSlotAvailable(slot("12:00"), 25, now), true);
  assert.equal(isPickupSlotAvailable(slot("11:30"), 25, now), false);
  assert.equal(isPickupSlotAvailable({ ...slot("12:00"), date: "2026-09-30" }, 25, now), false);
  assert.equal(isPickupSlotAvailable({ ...slot("12:00"), date: "2026-10-02" }, 25, now), true);
});

test("status changes follow the flow and cancellation closes after acceptance", () => {
  assert.equal(canTransition("placed", "accepted"), true);
  assert.equal(canTransition("placed", "ready"), false);
  assert.equal(canTransition("accepted", "cancelled"), true);
  assert.equal(canTransition("packing", "cancelled"), false);
  assert.equal(canTransition("ready", "collected"), true);
  assert.equal(canTransition("cancelled", "placed"), false);
});
