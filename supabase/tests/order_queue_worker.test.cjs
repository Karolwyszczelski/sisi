// Run with node --test supabase/tests/order_queue_worker.test.cjs.
// The global fetch replacement rejects every unexpected network call.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

Object.assign(process.env, {
  P24_ENV: "sandbox",
  P24_MERCHANT_ID: "1",
  P24_POS_ID: "2",
  P24_CRC_KEY: "synthetic",
  P24_REPORTS_KEY: "synthetic",
  APP_BASE_URL: "https://example.invalid",
  ORDER_DISPATCH_SECRET: "synthetic",
  ORDER_LINK_SECRET: "synthetic",
  RESEND_API_KEY: "synthetic",
});

const root = path.resolve(__dirname, "../..");
const load = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "./pushServer") return { sendNewOrderPush: async () => {} };
  if (name.startsWith("@/")) name = path.join(root, "src", name.slice(2));
  return load.call(this, name, parent, isMain);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);

const { processOrderJob } = require("../../src/lib/orderQueue.ts");
const ID = "d0000000-0000-4000-8000-000000000001";
const SESSION = `sisi-${ID}`;
const gateway = "https://sandbox.przelewy24.pl";
const sessionLookup = `${gateway}/api/v1/transaction/by/sessionId/${SESSION}`;
const json = (body, status = 200) => Response.json(body, { status });

function fixture(kind) {
  const order = {
    id: ID, status: "placed", total_price: 20, payment_status: "pending", created_at: new Date().toISOString(),
    payment_method: "Online", p24_session_id: SESSION, selected_option: "local", contact_email: "pay@example.invalid",
  };
  const job = {
    id: "fixture", job_key: `${kind}:${ID}`, order_id: ID, kind, event: "cancelled",
    payload: { ...order }, first_external_at: null, created_at: order.created_at, attempts: 0,
  };
  const outcomes = [];
  const confirmationCalls = [];
  const db = {
    from(table) {
      assert.equal(table, "orders");
      return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: order }; } };
    },
    async rpc(name, input) {
      switch (name) {
        case "sisi_claim_order_job":
          job.attempts += 1;
          job.lease_id = "lease-" + job.attempts;
          return { data: [{ ...job }] };
        case "sisi_prepare_order_job":
          assert.equal(input.lease, job.lease_id);
          if (job.first_external_at) return { data: false };
          job.first_external_at = new Date().toISOString();
          job.prepared = input.body;
          return { data: true };
        case "sisi_store_p24_token":
          assert.equal(input.lease, job.lease_id);
          order.p24_token = input.token;
          return { data: true };
        case "sisi_confirm_p24_payment":
          confirmationCalls.push(input);
          order.payment_status = "paid";
          return { data: { outcome: order.status === "cancelled" ? "refund_pending" : "paid" } };
        case "sisi_finish_order_job":
          assert.equal(input.lease, job.lease_id);
          outcomes.push(input.result + ":" + input.code);
          return { data: true };
        default: assert.fail(`Unexpected RPC ${name}`);
      }
    },
  };
  return { db, order, job, outcomes, confirmationCalls };
}

test("registers through the worker and stores the gateway token", async () => {
  const f = fixture("p24_register");
  global.fetch = async (url, init) => {
    assert.equal(url, gateway + "/trnRegister");
    assert.equal(init.body.get("p24_session_id"), SESSION);
    assert.equal(init.body.get("p24_amount"), "2000");
    assert.ok(f.job.first_external_at, "Registration must have a durable attempt marker");
    return json({ data: { token: "synthetic-token" } });
  };
  await processOrderJob(f.db);
  assert.equal(f.order.p24_token, "synthetic-token");
  assert.deepEqual(f.outcomes, ["done:p24_registered"]);
});

test("registration response lost: never makes a second registration call", async () => {
  const f = fixture("p24_register");
  let registrations = 0;
  global.fetch = async (url) => {
    if (url === gateway + "/trnRegister") {
      registrations += 1;
      throw new Error("connection closed after gateway accepted registration");
    }
    assert.equal(url, sessionLookup);
    return json({ data: { sessionId: SESSION, currency: "PLN", amount: 2000, status: 0 } });
  };
  await processOrderJob(f.db);
  await processOrderJob(f.db);
  assert.equal(registrations, 1);
  assert.deepEqual(f.outcomes, ["pending:p24_register_failed", "review:p24_registration_unconfirmed"]);
});

test("recovers an advance payment with a lost callback, verifies it and confirms the exact local order", async () => {
  const f = fixture("p24_reconcile");
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(url);
    assert.ok(init.headers.authorization.startsWith("Basic "));
    if (url === sessionLookup) return json({ data: { sessionId: SESSION, currency: "PLN", amount: 2000, status: 1, orderId: 50 } });
    assert.equal(url, gateway + "/api/v1/transaction/verify");
    assert.equal(init.method, "PUT");
    assert.equal(JSON.parse(init.body).amount, 2000);
    return json({ data: { status: "success" } });
  };
  await processOrderJob(f.db);
  assert.equal(calls.length, 2);
  assert.deepEqual(f.confirmationCalls, [{ session_id: SESSION, gateway_order_id: "50", amount_grosze: 2000 }]);
  assert.deepEqual(f.outcomes, ["done:paid"]);
});

test("does not confirm a missing, differently priced, or refunded P24 transaction", async () => {
  const f = fixture("p24_reconcile");
  let response = json({}, 404);
  global.fetch = async (url) => { assert.equal(url, sessionLookup); return response; };
  await processOrderJob(f.db);
  response = json({ data: { sessionId: SESSION, currency: "PLN", amount: 1999, status: 2, orderId: 50 } });
  await processOrderJob(f.db);
  response = json({ data: { sessionId: SESSION, currency: "PLN", amount: 2000, status: 3, orderId: 50 } });
  await processOrderJob(f.db);
  assert.equal(f.confirmationCalls.length, 0);
  assert.deepEqual(f.outcomes, ["pending:p24_awaiting_payment", "review:p24_payment_mismatch", "review:p24_already_refunded_externally"]);
});

test("POS response lost: waits for stored confirmation and never sends a second time", async () => {
  const f = fixture("pos");
  let sends = 0;
  f.order.payment_status = "paid";
  global.fetch = async (url) => {
    assert.equal(url, "https://example.invalid/api/dotypos/send-order");
    sends += 1;
    f.order.pos_dispatch_started_at = new Date().toISOString();
    throw new Error("POS accepted but network response dropped");
  };
  await processOrderJob(f.db);
  await processOrderJob(f.db);
  f.order.dotypos_order_id = 51;
  f.order.dotypos_status = "confirmed";
  await processOrderJob(f.db);
  assert.equal(sends, 1);
  assert.deepEqual(f.outcomes, ["pending:pos_failed", "pending:pos_waiting_confirmation", "done:pos_confirmed"]);
});

test("Resend response lost: retries the same payload and key, with one delivery", async () => {
  const f = fixture("mail");
  const accepted = new Map();
  global.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    const key = init.headers["idempotency-key"];
    if (!accepted.has(key)) {
      accepted.set(key, init.body);
      throw new Error("email accepted before connection dropped");
    }
    assert.equal(init.body, accepted.get(key));
    return json({ id: "already-accepted" });
  };
  await processOrderJob(f.db);
  f.job.payload.contact_email = "new-address@example.invalid";
  await processOrderJob(f.db);
  assert.equal(accepted.size, 1);
  assert.deepEqual(f.outcomes, ["pending:mail_failed", "done:mail_sent"]);
});

test("Resend retries stop before the documented key retention expires", async () => {
  const f = fixture("mail");
  f.job.first_external_at = new Date(Date.now() - 24 * 3600000).toISOString();
  global.fetch = async () => assert.fail("No safe automatic delivery outside the key retention window");
  await processOrderJob(f.db);
  assert.deepEqual(f.outcomes, ["review:mail_dedup_window_elapsed"]);
});

test("recovers a confirmed P24 payment for a cancelled order without re-registering or sending to POS", async () => {
  const f = fixture("p24_reconcile");
  f.order.status = "cancelled";
  global.fetch = async (url) => {
    assert.equal(url, sessionLookup);
    return json({ data: { sessionId: SESSION, currency: "PLN", amount: 2000, status: 2, orderId: 50 } });
  };
  await processOrderJob(f.db);
  assert.equal(f.confirmationCalls.length, 1);
  assert.deepEqual(f.outcomes, ["done:refund_pending"]);
});

test("POS retries transport failure before the dispatch marker, preserving the same order ID", async () => {
  const f = fixture("pos");
  let calls = 0;
  f.order.payment_status = "paid";
  global.fetch = async (url, init) => {
    assert.equal(url, "https://example.invalid/api/dotypos/send-order");
    assert.deepEqual(JSON.parse(init.body), { orderId: ID });
    if (++calls === 1) return json({}, 503);
    f.order.pos_dispatch_started_at = new Date().toISOString();
    f.order.dotypos_status = "sent";
    f.order.dotypos_order_id = 50;
    return json({ success: true, posRecorded: true });
  };
  await processOrderJob(f.db);
  await processOrderJob(f.db);
  assert.equal(calls, 2);
  assert.deepEqual(f.outcomes, ["pending:pos_waiting_confirmation", "done:pos_sent"]);
});
