import assert from "node:assert/strict";
import test from "node:test";
import { compactPosItems, parsePosItemOptions, type PosVariant } from "./posOrderItems";

function burger(qty: number, overrides: Partial<PosVariant> = {}): PosVariant {
  return { product: { id: 12, qty, "manual-price": 36.9, note: "Mięso: wołowina" }, addons: [], requiresPackaging: true, ...overrides };
}
const packaging = { id: 99, "manual-price": 2 };

test("ten identical burgers become one line plus one packaging line", () => {
  const input = [burger(7), burger(1), burger(2)];
  const snapshot = structuredClone(input);
  const result = compactPosItems(input, packaging);
  assert.deepEqual(result, [
    { id: 12, qty: 10, "manual-price": 36.9, note: "Mięso: wołowina" },
    { id: 99, qty: 10, "manual-price": 2 },
  ]);
  assert.deepEqual(input, snapshot, "must not mutate saved order items");
});

test("separates meat, preparation notes, addons and prices while linking each addon", () => {
  const variants = [
    burger(3),
    burger(2, { product: { id: 12, qty: 2, "manual-price": 36.9, note: "Mięso: kurczak" }, addons: [{ id: 50, qty: 1, note: "Bekon" }] }),
    burger(1, { product: { id: 12, qty: 1, "manual-price": 36.9, note: "Mięso: wołowina | bez cebuli" } }),
    burger(1, { product: { id: 12, qty: 1, "manual-price": 40, note: "Mięso: wołowina" } }),
    burger(1, { addons: [{ id: 50, qty: 1, note: "Bekon" }] }),
    burger(1, { addons: [{ id: 50, qty: 1, note: "Cheddar" }] }),
  ];
  const result = compactPosItems(variants, packaging);
  assert.equal(result.filter((line) => line.id === 12).length, 6);
  assert.deepEqual(result.filter((line) => line.id === 50).map(({ qty, note }) => ({ qty, note })), [
    { qty: 2, note: "Do poz. 2: Bekon" },
    { qty: 1, note: "Do poz. 5: Bekon" },
    { qty: 1, note: "Do poz. 6: Cheddar" },
  ]);
  assert.equal(result.at(-1)?.qty, 9);
  assert.match(result.find((line) => line.id === 12 && line.note?.includes("kurczak"))!.note!, /Poz\. 2/);
});

test("addon order does not prevent merging and per-unit quantities multiply correctly", () => {
  const addons = [{ id: 50, qty: 1, note: "Bekon" }, { id: 51, qty: 2 }];
  const result = compactPosItems([burger(2, { addons }), burger(3, { addons: [...addons].reverse() })], packaging);
  assert.equal(result.length, 4);
  assert.equal(result[0].qty, 5);
  assert.equal(result.find((line) => line.id === 50)?.qty, 5);
  assert.equal(result.find((line) => line.id === 51)?.qty, 10);
  assert.equal(result.at(-1)?.qty, 5);
});

test("duplicate addons aggregate within a variant, but different per-burger counts stay separate", () => {
  const addon = { id: 50, qty: 1, note: "Bekon" };
  const result = compactPosItems([
    burger(2, { addons: [addon, addon] }),
    burger(3, { addons: [{ ...addon, qty: 2 }] }),
    burger(1, { addons: [addon] }),
  ]);
  assert.deepEqual(result.filter((line) => line.id === 12).map((line) => line.qty), [5, 1]);
  assert.deepEqual(result.filter((line) => line.id === 50).map((line) => line.qty), [10, 1]);
});

test("drinks and dine-in items do not add packaging; no mapped items means no charge", () => {
  const result = compactPosItems([burger(2), { product: { id: 20, qty: 3 }, addons: [], requiresPackaging: false }], packaging);
  assert.equal(result.at(-1)?.qty, 2);
  assert.equal(compactPosItems([burger(2, { requiresPackaging: false })], packaging).length, 1);
  assert.deepEqual(compactPosItems([], packaging), []);
});

test("grouping preserves every product's quantity and total monetary value", () => {
  const variants = [burger(3, { addons: [{ id: 50, qty: 1 }, { id: 51, qty: 2 }] }), burger(2, { addons: [{ id: 51, qty: 2 }, { id: 50, qty: 1 }] }), burger(1)];
  const prices: Record<number, number> = { 12: 39, 50: 4, 51: 15, 99: 2 };
  const compact = compactPosItems(variants, packaging);
  const oldRows = variants.flatMap((variant) => Array.from({ length: variant.product.qty }, () => [
    { ...variant.product, qty: 1 }, ...variant.addons, { ...packaging, qty: 1 },
  ]).flat());
  const totals = (lines: typeof compact) => lines.reduce<Record<number, number>>((sum, line) => {
    sum[line.id] = (sum[line.id] || 0) + line.qty * Math.round((line["manual-price"] ?? prices[line.id]) * 100);
    return sum;
  }, {});
  assert.deepEqual(totals(compact), totals(oldRows));
  assert.equal(compact.length, 5);
  assert.equal(oldRows.length, 22);
});

test("reads checkout meat and per-unit additions, preserving swaps and kitchen notes", () => {
  const options = parsePosItemOptions({
    addons: ["Bekon", "Mięso: kurczak", "Dodatkowe mięso x2"],
    note: "bez soli", _src: { options: { swaps: [{ from: "cheddar", to: "feta" }] } },
  });
  assert.deepEqual(options.regularAddons, ["Bekon"]);
  assert.equal(options.extraMeatCount, 2);
  assert.equal(options.note, "Mięso: kurczak | Zamiana: cheddar → feta | bez soli | Dodatki/szt.: Bekon, dodatkowe mięso x2");
});

test("staff-edited fields override old labels without double-counting extra meat", () => {
  const options = parsePosItemOptions({ addons: ["Mięso: wołowina", "Dodatkowe mięso x2"], meatType: "kurczak", extraMeatCount: 1 });
  assert.equal(options.extraMeatCount, 1);
  assert.equal(options.note, "Mięso: kurczak | Dodatki/szt.: dodatkowe mięso x1");
  assert.equal(parsePosItemOptions({ addons: ["Dodatkowe mięso x2"], extraMeatCount: 0 }).extraMeatCount, 0);
});

test("rejects invalid counts rather than silently changing quantities", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => compactPosItems([burger(qty)]));
  assert.throws(() => compactPosItems([burger(1, { addons: [{ id: 50, qty: -1 }] })]));
  assert.throws(() => parsePosItemOptions({ extraMeatCount: -1 }));
});
