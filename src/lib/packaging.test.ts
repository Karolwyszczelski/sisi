import assert from "node:assert/strict";
import test from "node:test";
import {
  countPackagingUnits,
  packagingQuantity,
  requiresPackaging,
} from "./packaging";

test("qualifies food categories and rejects drinks or unknown categories", () => {
  for (const category of ["Burger", "Pancake", "Frytki", "Kids"]) {
    assert.equal(requiresPackaging(category), true, category);
  }

  for (const category of ["Napoje", "Napój", "", null, "Inne"]) {
    assert.equal(requiresPackaging(category), false, String(category));
  }
});

test("counts one packaging unit per food item quantity", () => {
  assert.equal(
    countPackagingUnits([
      { category: "Burger", quantity: 2 },
      { category: "Pancake", quantity: 1 },
      { category: "Frytki", quantity: 1 },
    ]),
    4,
  );
});

test("does not count drinks in a mixed order", () => {
  assert.equal(
    countPackagingUnits([
      { category: "Burger", quantity: 2 },
      { category: "Napoje", quantity: 3 },
      { category: "Pancake", quantity: 1 },
      { category: "Frytki", quantity: 1 },
    ]),
    4,
  );
});

test("rejects invalid quantities instead of creating fractional or negative units", () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(packagingQuantity(quantity), 0, String(quantity));
  }

  assert.equal(packagingQuantity(undefined), 1);
  assert.equal(packagingQuantity(2), 2);
});
