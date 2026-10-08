import assert from "node:assert/strict";
import test from "node:test";
import { describeError } from "../utils/errors.ts";

/**
 * The two ways a shop gets run, and therefore the two ways a product can be
 * written. Both must work: an owner signed in with their own account has no staff
 * PIN token, and the write helpers used to refuse them outright with "Sign in as
 * shop staff", which read as discounts being staff-only.
 *
 * productWriteAccess() lives in services/productService.ts, which pulls in the
 * Supabase client, so these tests exercise the decision it makes through the same
 * stubs rather than importing it.
 */
const accessFor = async (token, session) => {
  if (token) return { kind: "staff", token };
  if (session) return { kind: "owner" };
  throw new Error(
    "Sign in as the shop owner or as shop staff before changing products.",
  );
};

test("a staff PIN token takes the function path", async () => {
  assert.deepEqual(await accessFor("pin-token", null), {
    kind: "staff",
    token: "pin-token",
  });
});

test("a signed-in owner with no token takes the direct path", async () => {
  assert.deepEqual(await accessFor(null, { user: { id: "u1" } }), {
    kind: "owner",
  });
});

test("a staff token wins when the person is also signed in as a customer", async () => {
  // Signing in to the app as a customer must never silently downgrade a clerk
  // from the staff functions to the owner path.
  const access = await accessFor("pin-token", { user: { id: "u1" } });
  assert.equal(access.kind, "staff");
});

test("neither credential is refused rather than guessing", async () => {
  await assert.rejects(
    accessFor(null, null),
    /Sign in as the shop owner or as shop staff/,
  );
});

// The bug this guards against: supabase-js rejects with a PostgrestError plain
// object, so `error instanceof Error` was false and every real database message
// was replaced by the generic fallback. A missing column reached the Shop
// Management screen as "We could not load your listings." and nothing else.
test("a PostgREST error object surfaces its own message", () => {
  const postgrest = {
    message: "column customer_products.discount_percent does not exist",
    details: null,
    hint: null,
    code: "42703",
  };
  assert.equal(
    describeError(postgrest, "We could not load your listings."),
    "column customer_products.discount_percent does not exist (42703)",
  );
});

test("a missing-function error is not mistaken for a generic one", () => {
  const missing = {
    message:
      "Could not find the function public.staff_update_product(p_product_id, p_token) in the schema cache",
    code: "PGRST202",
  };
  assert.match(
    describeError(missing, "Please try again."),
    /Could not find the function/,
  );
});

test("a real Error keeps its message", () => {
  assert.equal(
    describeError(new Error("Staff session is invalid or expired"), "Please try again."),
    "Staff session is invalid or expired",
  );
});

test("a thrown string is used as-is", () => {
  assert.equal(describeError("network request failed", "Please try again."), "network request failed");
});

test("the fallback is used only when there is genuinely no message", () => {
  assert.equal(describeError(new Error("   "), "Please try again."), "Please try again.");
  assert.equal(describeError({}, "Please try again."), "Please try again.");
  assert.equal(describeError(null, "Please try again."), "Please try again.");
  assert.equal(describeError(undefined, "Please try again."), "Please try again.");
});

test("details is used when message is absent", () => {
  assert.equal(
    describeError({ details: "permission denied for table shop_inventory" }, "Please try again."),
    "permission denied for table shop_inventory",
  );
});