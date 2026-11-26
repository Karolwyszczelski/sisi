import assert from "node:assert/strict";
import test from "node:test";
import { BURGER_MONTH_NAME, burgerMonthPrice, canonicalizeBurgerMonth, isBurgerMonthName } from "./burgerMonth";

test("recognizes old edition names without matching unrelated burgers", () => {
  for (const name of ["Burger Miesiąca", "BURGER MIESIACA ZBÓJNICKI", "Burger Miesiąca – BBQ", "Burger miesiąca: Chorizo"]) {
    assert.equal(isBurgerMonthName(name), true, name);
  }
  for (const name of [null, "Zbójnicki", "Burger po Twojemu", "Burger Miesiącami"]) {
    assert.equal(isBurgerMonthName(name), false, String(name));
  }
});

test("one canonical burger survives old editions and repeated IDs", () => {
  const result = canonicalizeBurgerMonth([
    { id: 99, name: "Burger Miesiąca – Zbójnicki", price: 34.9 },
    { id: 12, name: "ZBÓJNICKI", price: 36.9 },
    { id: "12", name: "Burger Miesiąca", price: 32 },
    { id: 100, name: "Burger Miesiąca Chorizo", price: 30 },
    { id: 1, name: "Klasyczny", price: 25 },
  ]);
  assert.deepEqual(result, [
    { id: 12, name: BURGER_MONTH_NAME, price: 36.9 },
    { id: 1, name: "Klasyczny", price: 25 },
  ]);
});

test("disabled or missing canonical burger cannot be replaced by an available old edition", () => {
  const duplicate = { id: 100, name: "Burger Miesiąca Zbójnicki", available: true };
  const products = canonicalizeBurgerMonth([
    { id: 12, name: BURGER_MONTH_NAME, available: false }, duplicate,
  ]);
  assert.equal(products.filter((product) => product.available).length, 0);
  assert.deepEqual(canonicalizeBurgerMonth([duplicate]), []);
});

test("uses the configured price and rejects missing or invalid prices", () => {
  assert.equal(burgerMonthPrice("36,90"), 36.9);
  assert.equal(burgerMonthPrice(42.5), 42.5);
  for (const value of [null, undefined, "", " ", "abc", 0, -1, Infinity, NaN]) {
    assert.equal(burgerMonthPrice(value), null, String(value));
  }
});
