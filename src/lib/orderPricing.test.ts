import assert from "node:assert/strict";
import test from "node:test";
import { fromGrosze, productLineGrosze, quoteInPln, toGrosze, totalGrosze } from "./orderPricing";

test("converts decimal prices before multiplying quantities and adding components", () => {
  assert.equal(toGrosze(10.075), 1008);
  assert.equal(toGrosze(39.99), 3999);
  assert.equal(productLineGrosze(toGrosze(39.99), [toGrosze(3.49), toGrosze(0.01)], 1, 3), 17547);
});

test("caps discounts before applying the deposit and converts only at the response boundary", () => {
  assert.equal(totalGrosze(999, 200, 600, 9999, 150), 150);
  const total = totalGrosze(999, 200, 600, 180, 150);
  assert.equal(total, 1769);
  assert.equal(quoteInPln({ products: 999, packaging: 200, delivery: 600, discount: 180, deposit: 150, total, lines: [999] }).total, 17.69);
  assert.equal(fromGrosze(total), 17.69);
});
