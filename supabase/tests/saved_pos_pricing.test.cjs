// Run with node --test supabase/tests/saved_pos_pricing.test.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

Object.assign(process.env, {
  APP_BASE_URL: "https://example.invalid",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic",
  ORDER_DISPATCH_SECRET: "synthetic",
  ORDER_LINK_SECRET: "synthetic",
  P24_ENV: "sandbox",
  P24_MERCHANT_ID: "1",
  P24_POS_ID: "2",
  P24_CRC_KEY: "synthetic",
  P24_REPORTS_KEY: "synthetic",
});
for (const name of ["PACKAGING", "DELIVERY", "DEPOSIT", "EXTRA_MEAT", "ADDON", "SAUCE", "PREMIUM_ADDON"]) {
  delete process.env[`DOTYPOS_${name}_PRODUCT_ID`];
}
const root = path.resolve(__dirname, "../..");
const load = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@supabase/supabase-js") return { createClient: () => mockDatabase() };
  if (name === "@/lib/serverAuth") return { getSessionAndRole: async () => ({ session: null, role: null }) };
  if (name === "@/lib/dotypos") return { createDraftOrder: (...args) => provider(...args) };
  if (name.startsWith("@/")) name = path.join(root, "src", name.slice(2));
  return load.call(this, name, parent, isMain);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true },
}).outputText, filename);
global.fetch = async () => { throw new Error("Unexpected network call in test"); };

const { NextRequest } = require("next/server");
const { POST: sendToPos } = require("../../src/app/api/dotypos/send-order/route.ts");
const { POST: receivePos } = require("../../src/app/api/dotypos/webhook/route.ts");
const { orderDispatchToken } = require("../../src/lib/orderDispatchAuth.ts");
const { readSavedOrderPricing, SavedPricingError, describeSavedOrderPricing } = require("../../src/lib/savedOrderPricing.ts");
const { buildSavedPosItems, createPosCatalogMappings, PosMappingError } = require("../../src/lib/savedPosOrder.ts");
const { prepareOrderMail } = require("../../src/lib/queuedOrderMail.ts");
const { p24Registration } = require("../../src/lib/p24QueueGateway.ts");
const { toGrosze, fromGrosze } = require("../../src/lib/orderPricing.ts");
const id = "a0000000-0000-4000-8000-000000000001";

const fullCatalog = [
  { pos_id: 101, name: "1. Burger" }, { pos_id: 102, name: "Frytki" }, { pos_id: 103, name: "Napój" },
  { pos_id: 110, name: "Dodatkowe mięso" }, { pos_id: 111, name: "Dodatkowy sos" },
  { pos_id: 112, name: "Dodatkowy płynny ser" }, { pos_id: 113, name: "Pakowanie na wynos" },
  { pos_id: 114, name: "Dowóz na terenie Ciechanowa" }, { pos_id: 115, name: "Kaucja zwrotna" },
];
const order = (discount = 1234, mode = "delivery") => {
  const takeout = mode !== "local";
  const lines = [
    { productId: "burger", quantity: 3, unitPrice: 1999, extraMeatCount: 1, extraMeatUnitPrice: 1500,
      addons: [{ name: "BBQ", category: "sos", unitPrice: 249 }], products: 11244, packaging: takeout ? 600 : 0, deposit: 0 },
    { productId: "fries", quantity: 2, unitPrice: 1001, extraMeatCount: 0, extraMeatUnitPrice: 1500,
      addons: [{ name: "Płynny ser", category: "premium", unitPrice: 499 }], products: 3000, packaging: takeout ? 400 : 0, deposit: 0 },
    { productId: "drink", quantity: 2, unitPrice: 550, extraMeatCount: 0, extraMeatUnitPrice: 1500,
      addons: [], products: 1100, packaging: 0, deposit: takeout ? 100 : 0 },
  ];
  const packaging = takeout ? 1000 : 0;
  const delivery = mode === "delivery" ? 700 : 0;
  const deposit = takeout ? 100 : 0;
  const total = 15344 + packaging + delivery - discount + deposit;
  return {
    id, status: "placed", payment_method: "Online", payment_status: "paid", selected_option: mode,
    city: "Ciechanów", contact_email: "order@example.invalid",
    total_price: fromGrosze(total),
    // These duplicate legacy fields deliberately disagree with the approved quote.
    delivery_cost: 1, discount_amount: 0, packaging_total: 9, legal_accept: { terms_version: "synthetic", deposit_total: 7 },
    items: JSON.stringify([
      { product_id: "burger", quantity: 3, name: "Burger", price: 1, addons: ["BBQ", "Mięso: wołowina", "Dodatkowe mięso x1"], note: "Bez cebuli" },
      { product_id: "fries", quantity: 2, name: "Frytki", price: 2, addons: ["Płynny ser"] },
      { product_id: "drink", quantity: 2, name: "Napój", price: 3, addons: [] },
    ]),
    checkout_price_grosze: { products: 15344, packaging, delivery, deposit, discount, total,
      lines: lines.map((line) => line.products), lineDetails: lines },
  };
};

let current;
let catalog;
let claims;
let updates;
let provider;
function reset(value = order()) {
  current = value;
  catalog = fullCatalog;
  claims = 0;
  updates = [];
  provider = async () => assert.fail("Dotypos must not receive a partial request");
}
function mockDatabase() {
  return {
    rpc: async (name) => {
      assert.equal(name, "sisi_begin_pos_dispatch");
      claims += 1;
      return { data: true };
    },
    from(table) {
      const data = table === "orders" ? [current] : table === "pos_products" ? catalog : [];
      let update;
      return {
        select() { return this; }, eq() { return this; }, or() { return this; }, limit() { return this; },
        update(row) { update = row; updates.push(row); return this; },
        async maybeSingle() { return { data: update ? { id } : data[0], error: null }; },
        then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); },
      };
    },
  };
}
function request() {
  return new NextRequest("https://example.invalid/api/dotypos/send-order", {
    method: "POST", headers: { "content-type": "application/json", "X-Order-Dispatch": orderDispatchToken(id) },
    body: JSON.stringify({ orderId: id }),
  });
}
function webhook(total, currency = "PLN", itemErrors = []) {
  const url = new URL("https://example.invalid/api/dotypos/webhook");
  url.searchParams.set("t", orderDispatchToken(`pos-callback:${id}`));
  return new NextRequest(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: 0, "pass-through-errors": itemErrors, order: { id: 80, "external-id": id, "price-total": total, currency } }),
  });
}
const mappings = (rows = fullCatalog, overrides = new Map()) => createPosCatalogMappings(rows, overrides, new Map(), {}, "Ciechanów");
const sum = (items) => items.reduce((total, item) => total + toGrosze(item["manual-price"]) * item.qty, 0);

test("delivery, takeaway and local orders reconcile with fixed, percentage, one-cent, and full discounts", () => {
  for (const mode of ["delivery", "takeaway", "local"]) {
    const max = order(0, mode).checkout_price_grosze;
    for (const discount of [0, 1, 1234, Math.round((max.products + max.packaging + max.delivery) * 0.07), max.total - max.deposit]) {
      const pricing = readSavedOrderPricing(order(discount, mode));
      const items = buildSavedPosItems(pricing, mappings());
      assert.equal(sum(items), pricing.quote.total);
      assert.equal(sum(items.filter((item) => item.id === 115)), max.deposit);
      assert.equal(items.filter((item) => item.id === 101).reduce((sum, item) => sum + item.qty, 0), 3);
      assert.ok(items.every((item) => item["manual-price"] >= 0));
    }
  }
});

test("rejects inconsistent saved quote and blocks ambiguous mappings instead of guessing", () => {
  const value = order();
  const pricing = readSavedOrderPricing(value);
  assert.throws(() => readSavedOrderPricing({ ...value, total_price: 1 }), SavedPricingError);
  assert.throws(() => readSavedOrderPricing({ ...value, items: "[]" }), SavedPricingError);
  assert.throws(() => buildSavedPosItems(pricing, mappings([...fullCatalog, { pos_id: 554, name: "Burger" }])), PosMappingError);
  assert.throws(() => buildSavedPosItems(pricing, mappings(fullCatalog, new Map([["burger", 999]]))), PosMappingError);
});

test("actual POS route blocks each type of missing mapping before reserving or calling the provider", async () => {
  for (const missing of [101, 110, 111, 112, 113, 114, 115]) {
    reset();
    catalog = fullCatalog.filter((product) => product.pos_id !== missing);
    const response = await sendToPos(request());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "POS_MAPPING_INCOMPLETE");
    assert.equal(claims, 0);
  }
  reset({ ...order(), checkout_price_grosze: null });
  assert.equal((await (await sendToPos(request())).json()).code, "POS_QUOTE_INVALID");
  assert.equal(claims, 0);
});

test("actual POS route, P24 registration and both email templates agree with the stored checkout total", async () => {
  for (const discount of [1234, 1193]) {
    reset(order(discount));
    const pricing = readSavedOrderPricing(current);
    const expected = pricing.quote.total;
    provider = async ({ items, discountPercent, webhookUrl }) => {
      assert.equal(discountPercent, undefined);
      assert.equal(sum(items), expected);
      assert.ok(webhookUrl.includes("/api/dotypos/webhook?"));
      assert.equal(sum(items.filter((item) => item.id === 115)), 100);
      return { code: 0, order: { id: 80, "price-total": fromGrosze(expected), currency: "PLN" } };
    };
    const pos = await sendToPos(request());
    assert.equal(pos.status, 200);
    assert.equal((await pos.json()).posRecorded, true);
    assert.equal(updates[0].dotypos_status, "confirmed");
    assert.equal(claims, 1);

    global.fetch = async (url, init) => {
      assert.equal(url, "https://sandbox.przelewy24.pl/trnRegister");
      assert.equal(Number(init.body.get("p24_amount")), expected);
      return Response.json({ token: "synthetic-token" });
    };
    await p24Registration({ id, session: "synthetic", amount: toGrosze(current.total_price),
      email: current.contact_email, name: "Fixture", returnToken: "dummy" })();
    for (const event of ["received", "accepted"]) {
      const email = await prepareOrderMail(mockDatabase(), event, current);
      for (const line of describeSavedOrderPricing(pricing)) assert.ok(email.text.includes(line));
      assert.doesNotMatch(email.text, /Kaucja zwrotna: 7,00/);
    }
  }
});

test("provider responses without a total are pending, and differences of one grosz cannot confirm", async () => {
  reset();
  provider = async () => ({});
  const pending = await (await sendToPos(request())).json();
  assert.equal(pending.success, true);
  assert.equal(pending.posRecorded, false);
  assert.equal(updates.length, 0);

  const gross = current.checkout_price_grosze.total;
  assert.equal((await receivePos(webhook(fromGrosze(gross - 1)))).status, 200);
  assert.equal(updates[0].dotypos_status, "price_mismatch");
  reset();
  assert.equal((await receivePos(webhook(fromGrosze(gross)))).status, 200);
  assert.equal(updates[0].dotypos_status, "confirmed");
});

test("an item rejection from POS cannot confirm even when the reported total matches", async () => {
  reset();
  const gross = current.checkout_price_grosze.total;
  const response = await receivePos(webhook(fromGrosze(gross), "PLN", [{ code: 10, description: "Synthetic item rejection" }]));
  assert.equal(response.status, 200);
  assert.equal(updates[0].dotypos_status, "items_rejected");
});
