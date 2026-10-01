import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, cartTotals, isPickupSlotAvailable, isValidPhone } from "../utils/ordering.ts";

test("cart totals use actual prices and quantities", () => {
  const items = [
    { product: { price: 280, regularPrice: 320 }, quantity: 2 },
    { product: { price: 420, regularPrice: 450 }, quantity: 1 },
  ];
  assert.deepEqual(cartTotals(items), { count: 2, units: 3, subtotal: 980, savings: 110 });
});

test("phone validation checks digit count and allowed characters", () => {
  assert.equal(isValidPhone("+94 77 123 4567"), true);
  assert.equal(isValidPhone("----------"), false);
  assert.equal(isValidPhone("+94 abc 123456"), false);
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
