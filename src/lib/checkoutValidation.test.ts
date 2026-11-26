import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSelectionSchema, validateCheckoutLine } from "./checkoutValidation";
import { canAcceptOrder } from "./orderAvailability";

const catalog = new Map([
  ["bekon", { price: 4, category: "dodatek" }],
  ["ketchup", { price: 3, category: "sos" }],
  ["płynny ser", { price: 6, category: "premium" }],
]);
const burger = { name: "Burger SISI", category: "burger" };
const fries = { name: "Frytki" };

test("requires a supported fulfillment and payment method", () => {
  for (const selected_option of ["local", "takeaway", "delivery"]) {
    for (const payment_method of ["Gotówka", "Terminal", "Online"]) {
      assert.ok(checkoutSelectionSchema.safeParse({ selected_option, payment_method }).success);
    }
  }
  for (const value of [{}, { selected_option: "other", payment_method: "Online" }, { selected_option: "delivery", payment_method: "other" }]) {
    assert.equal(checkoutSelectionSchema.safeParse(value).success, false);
  }
});

test("the master flag vetoes every mode and each mode has its own flag", () => {
  const closed = { orders_enabled: false, local_enabled: true, takeaway_enabled: true, delivery_enabled: true };
  for (const mode of ["local", "takeaway", "delivery"] as const) {
    assert.equal(canAcceptOrder(closed, mode), false);
    assert.equal(canAcceptOrder({ ...closed, orders_enabled: true }, mode), true);
    assert.equal(canAcceptOrder({ ...closed, orders_enabled: true, [mode + "_enabled"]: false }, mode), false);
  }
});

test("accepts supported burger options and canonicalizes quantity", () => {
  const result = validateCheckoutLine({ qty: "2", options: { meatType: "kurczak", extraMeatCount: 1, addons: [" Bekon "] } }, burger, catalog);
  assert.deepEqual(result, {
    quantity: 2,
    options: { meatType: "kurczak", extraMeatCount: 1, addons: ["Bekon"], note: undefined },
  });
});

test("enforces product-specific add-ons and fixed meat choices", () => {
  assert.ok("quantity" in validateCheckoutLine({ addons: ["Ketchup", "Płynny ser"] }, fries, catalog));
  assert.ok("error" in validateCheckoutLine({ addons: ["Płynny ser"] }, { name: "Frytki z serem" }, catalog));
  assert.ok("error" in validateCheckoutLine({ addons: ["Bekon"] }, fries, catalog));
  assert.ok("error" in validateCheckoutLine({ addons: ["Ketchup"] }, { name: "Woda" }, catalog));
  assert.ok("error" in validateCheckoutLine({ addons: ["Nieznany"] }, burger, catalog));
  assert.ok("error" in validateCheckoutLine({ options: { meatType: "wołowina" } }, { ...burger, name: "Chicken Burger" }, catalog));
  assert.ok("error" in validateCheckoutLine({ options: { extraMeatCount: 1 } }, { ...burger, name: "Burger Vege" }, catalog));
});

test("rejects malformed quantities, options and swaps without a catalog rule", () => {
  for (const item of [
    null,
    { qty: 0 },
    { quantity: 2.5 },
    { options: [] },
    { options: { extraMeatCount: 100 } },
    { options: { swaps: [{ from: "a", to: "b" }] } },
  ]) {
    assert.ok("error" in validateCheckoutLine(item, burger, catalog));
  }
  assert.ok("quantity" in validateCheckoutLine({ options: { swaps: [] } }, burger, catalog));
});
