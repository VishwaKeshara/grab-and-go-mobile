import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Run against a disposable development project only. The service-role key stays
// in this Node process; it is never used by the Expo app.
const required = [
  "TEST_SUPABASE_URL", "TEST_SUPABASE_PUBLISHABLE_KEY",
  "TEST_SUPABASE_SERVICE_ROLE_KEY",
  "TEST_CUSTOMER_A_EMAIL", "TEST_CUSTOMER_A_PASSWORD",
  "TEST_CUSTOMER_B_EMAIL", "TEST_CUSTOMER_B_PASSWORD",
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error("Set development test credentials: " + missing.join(", "));

const client = key => createClient(process.env.TEST_SUPABASE_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const publicKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const customerA = client(publicKey);
const customerB = client(publicKey);
const anonymous = client(publicKey);
const admin = client(process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);
let orderId;
let pastSlotId;
let unavailableSlotId;

async function signIn(api, email, password) {
  const { data, error } = await api.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert.ok(data.user?.id);
  return data.user.id;
}
async function changeCart(api, operation, productId = null, quantity = null) {
  const { error } = await api.rpc("change_customer_cart", {
    p_operation: operation, p_product_id: productId,
    p_quantity: quantity, p_substitution: null,
  });
  if (error) throw error;
}
function offsetDate(date, days) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

try {
  const anonRead = await anonymous.from("customer_orders").select("id").limit(1);
  assert.ok(anonRead.error, "Anonymous clients must not read orders");
  const anonWrite = await anonymous.rpc("change_customer_cart", { p_operation: "clear" });
  assert.ok(anonWrite.error, "Anonymous clients must not call cart mutations");

  const customerAId = await signIn(
    customerA, process.env.TEST_CUSTOMER_A_EMAIL, process.env.TEST_CUSTOMER_A_PASSWORD,
  );
  const customerBId = await signIn(
    customerB, process.env.TEST_CUSTOMER_B_EMAIL, process.env.TEST_CUSTOMER_B_PASSWORD,
  );
  assert.notEqual(customerAId, customerBId);

  const { data: shops, error: shopError } = await customerA.from("customer_shops")
    .select("id").eq("active", true).limit(1);
  if (shopError) throw shopError;
  assert.ok(shops?.length, "Load the development catalog seed first");
  const shopId = shops[0].id;
  const { data: products, error: productError } = await customerA
    .from("customer_products").select("id,price_lkr")
    .eq("shop_id", shopId).eq("active", true).eq("available", true)
    .is("substitute_for", null).gt("stock_quantity", 2).limit(1);
  if (productError) throw productError;
  assert.ok(products?.length, "Load an in-stock development product");
  const product = products[0];

  await changeCart(customerA, "clear");
  await changeCart(customerB, "clear");
  await changeCart(customerA, "add", product.id, 1);
  await changeCart(customerA, "add", product.id, 1);
  await changeCart(customerB, "add", product.id, 1);
  const substitute = await customerA.rpc("change_customer_cart", {
    p_operation: "substitute", p_product_id: product.id,
    p_quantity: null, p_substitution: { type: "none" },
  });
  if (substitute.error) throw substitute.error;

  const { data: cartA, error: cartAError } = await customerA.from("customer_carts")
    .select("id").eq("customer_id", customerAId).single();
  if (cartAError) throw cartAError;
  const { data: hiddenCart, error: hiddenCartError } = await customerB
    .from("customer_carts").select("id").eq("customer_id", customerAId);
  if (hiddenCartError) throw hiddenCartError;
  assert.equal(hiddenCart.length, 0, "Customer B must not see A's cart");
  const { data: hiddenCartItems, error: hiddenCartItemsError } = await customerB
    .from("customer_cart_items").select("id").eq("cart_id", cartA.id);
  if (hiddenCartItemsError) throw hiddenCartItemsError;
  assert.equal(hiddenCartItems.length, 0, "Customer B must not see A's items");

  const restarted = client(publicKey);
  await signIn(restarted, process.env.TEST_CUSTOMER_A_EMAIL, process.env.TEST_CUSTOMER_A_PASSWORD);
  const { data: persisted, error: persistedError } = await restarted
    .from("customer_cart_items").select("quantity,substitution").eq("cart_id", cartA.id);
  if (persistedError) throw persistedError;
  assert.equal(persisted.length, 1, "Adding twice must retain one product row");
  assert.equal(persisted[0].quantity, 2, "A new client session must load the saved quantity");
  assert.equal(persisted[0].substitution.type, "none");

  const { data: availability, error: slotError } = await customerA
    .rpc("get_customer_pickup_slots", { p_shop_id: shopId, p_days: 7 });
  if (slotError) throw slotError;
  const slot = availability.slots.find(value => value.mode === "scheduled");
  assert.ok(slot, "The development shop needs a future scheduled slot");
  assert.ok(slot.date >= availability.today);

  const pastStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pastInsert = await admin.from("customer_pickup_slots").insert({
    shop_id: shopId, slot_date: offsetDate(availability.today, -2),
    starts_at: pastStart.toISOString(),
    ends_at: new Date(pastStart.getTime() + 30 * 60000).toISOString(),
    mode: "scheduled", capacity: 6,
  }).select("id").single();
  if (pastInsert.error) throw pastInsert.error;
  pastSlotId = pastInsert.data.id;

  const unavailableStart = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const unavailableInsert = await admin.from("customer_pickup_slots").insert({
    shop_id: shopId, slot_date: offsetDate(availability.today, 15),
    starts_at: unavailableStart.toISOString(),
    ends_at: new Date(unavailableStart.getTime() + 30 * 60000).toISOString(),
    mode: "scheduled", capacity: 6, is_available: false,
  }).select("id").single();
  if (unavailableInsert.error) throw unavailableInsert.error;
  unavailableSlotId = unavailableInsert.data.id;

  const request = {
    p_shop_id: shopId, p_slot_id: slot.id,
    p_expected_subtotal: product.price_lkr * 2,
    p_payment_method: "pickup", p_customer_name: "Backend Test Customer",
    p_customer_phone: "+94 77 123 4567",
    p_packing_instructions: "", p_travel_method: "walking",
  };
  const past = await customerA.rpc("place_customer_order", {
    ...request, p_checkout_id: "past-" + randomUUID(), p_slot_id: pastSlotId,
  });
  assert.ok(past.error, "Past slots must fail in the backend");
  const unavailable = await customerA.rpc("place_customer_order", {
    ...request, p_checkout_id: "unavailable-" + randomUUID(),
    p_slot_id: unavailableSlotId,
  });
  assert.ok(unavailable.error, "Closed slots must fail in the backend");
  const wrongPrice = await customerA.rpc("place_customer_order", {
    ...request, p_checkout_id: "price-" + randomUUID(),
    p_expected_subtotal: request.p_expected_subtotal + 1,
  });
  assert.ok(wrongPrice.error, "Current server prices must override client totals");
  const { data: afterFailure, error: afterFailureError } = await customerA
    .from("customer_cart_items").select("quantity").eq("cart_id", cartA.id);
  if (afterFailureError) throw afterFailureError;
  assert.equal(afterFailure[0]?.quantity, 2, "Rejected checkout must keep the cart");

  const checkoutId = "integration-" + randomUUID();
  const first = await customerA.rpc("place_customer_order", {
    ...request, p_checkout_id: checkoutId,
  });
  if (first.error) throw first.error;
  orderId = first.data;
  const retry = await customerA.rpc("place_customer_order", {
    ...request, p_checkout_id: checkoutId,
  });
  if (retry.error) throw retry.error;
  assert.equal(retry.data, orderId, "Retry must return the original order");

  const { data: orders, error: orderError } = await customerA
    .from("customer_orders")
    .select("id,subtotal_lkr,total_lkr,payment_status")
    .eq("checkout_id", checkoutId);
  if (orderError) throw orderError;
  assert.equal(orders.length, 1);
  assert.equal(orders[0].subtotal_lkr, product.price_lkr * 2);
  assert.equal(orders[0].total_lkr, product.price_lkr * 2);
  assert.equal(orders[0].payment_status, "pay_at_pickup");
  const { data: orderItems, error: orderItemsError } = await customerA
    .from("customer_order_items").select("quantity,unit_price_lkr,substitution")
    .eq("order_id", orderId);
  if (orderItemsError) throw orderItemsError;
  assert.equal(orderItems.length, 1);
  assert.equal(orderItems[0].quantity, 2);
  assert.equal(orderItems[0].unit_price_lkr, product.price_lkr);
  assert.equal(orderItems[0].substitution.type, "none");
  const { data: payment, error: paymentError } = await customerA
    .from("customer_payments").select("status,amount_lkr").eq("order_id", orderId).single();
  if (paymentError) throw paymentError;
  assert.equal(payment.status, "pay_at_pickup");
  assert.equal(payment.amount_lkr, product.price_lkr * 2);
  const { data: history, error: historyError } = await customerA
    .from("customer_order_status_history").select("status").eq("order_id", orderId);
  if (historyError) throw historyError;
  assert.ok(history.some(value => value.status === "placed"));
  const { data: remaining, error: remainingError } = await customerA
    .from("customer_cart_items").select("id").eq("cart_id", cartA.id);
  if (remainingError) throw remainingError;
  assert.equal(remaining.length, 0, "Purchased cart rows clear only after order creation");

  for (const table of [
    "customer_orders", "customer_order_items",
    "customer_payments", "customer_order_status_history",
  ]) {
    const column = table === "customer_orders" ? "id" : "order_id";
    const { data, error } = await customerB.from(table).select("*").eq(column, orderId);
    if (error) throw error;
    assert.equal(data.length, 0, `Customer B must not read A's ${table}`);
  }
  const deniedCancel = await customerB.rpc("cancel_customer_order", { p_order_id: orderId });
  assert.ok(deniedCancel.error);
  const deniedStatus = await customerA.rpc("set_customer_order_status", {
    p_order_id: orderId, p_status: "accepted",
  });
  assert.ok(deniedStatus.error);
  const deniedUpdate = await customerA.from("customer_orders")
    .update({ status: "ready" }).eq("id", orderId);
  assert.ok(deniedUpdate.error, "Direct order writes must be denied");

  if (process.env.TEST_SHOP_EMAIL && process.env.TEST_SHOP_PASSWORD) {
    const staff = client(publicKey);
    await signIn(staff, process.env.TEST_SHOP_EMAIL, process.env.TEST_SHOP_PASSWORD);
    const accepted = await staff.rpc("set_customer_order_status", {
      p_order_id: orderId, p_status: "accepted",
    });
    if (accepted.error) throw accepted.error;
    const { data: updated, error: updatedError } = await customerA
      .from("customer_orders").select("status").eq("id", orderId).single();
    if (updatedError) throw updatedError;
    assert.equal(updated.status, "accepted");
    const { data: updates, error: updatesError } = await customerA
      .from("customer_order_status_history").select("status").eq("order_id", orderId);
    if (updatesError) throw updatesError;
    assert.ok(updates.some(value => value.status === "accepted"));
  }
  console.log("Customer ordering database integration checks passed.");
} finally {
  if (orderId) {
    const cancelled = await customerA.rpc("cancel_customer_order", { p_order_id: orderId });
    if (cancelled.error) console.warn("Test order remains in the development project.");
  }
  await Promise.allSettled([
    changeCart(customerA, "clear"), changeCart(customerB, "clear"),
    pastSlotId ? admin.from("customer_pickup_slots").delete().eq("id", pastSlotId) : Promise.resolve(),
    unavailableSlotId ? admin.from("customer_pickup_slots").delete().eq("id", unavailableSlotId) : Promise.resolve(),
  ]);
}
