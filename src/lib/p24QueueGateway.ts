import { createHash } from "node:crypto";
import { hostFromEnv, p24SignRegisterMD5 } from "./p24";

const timeout = () => AbortSignal.timeout(7000);

function credentials() {
  const merchantId = Number(process.env.P24_MERCHANT_ID);
  const posId = Number(process.env.P24_POS_ID);
  const crc = process.env.P24_CRC_KEY;
  if (!Number.isSafeInteger(merchantId) || merchantId <= 0 || !Number.isSafeInteger(posId) || posId <= 0 || !crc) {
    throw new Error("p24_config");
  }
  return { merchantId, posId, crc };
}

function authorization(posId: number) {
  const secret = process.env.P24_REPORTS_KEY;
  if (!secret) throw new Error("p24_reports_config");
  return "Basic " + Buffer.from(`${posId}:${secret}`).toString("base64");
}

export function p24Site() {
  const value = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  const url = value ? new URL(value) : null;
  if (!url || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("order_base_url_config");
  return url.origin;
}

export function p24Registration(order: { id: string; session: string; amount: number; email: string; name: string; returnToken: string }) {
  const { merchantId, posId, crc } = credentials();
  authorization(posId); // Require the recovery channel before registering a new session.
  const site = p24Site();
  const body = new URLSearchParams({
    p24_merchant_id: String(merchantId),
    p24_pos_id: String(posId),
    p24_session_id: order.session,
    p24_amount: String(order.amount),
    p24_currency: "PLN",
    p24_description: `Zamówienie #${order.id}`,
    p24_email: order.email,
    p24_client: order.name,
    p24_country: "PL",
    p24_language: "pl",
    p24_url_return: `${site}/pickup-order?${new URLSearchParams({ id: order.id, t: order.returnToken })}`,
    p24_url_status: `${site}/api/p24/callback`,
    p24_api_version: "3.2",
    p24_sign: p24SignRegisterMD5(order.session, merchantId, order.amount, "PLN", crc),
  });

  return async () => {
    const response = await fetch(`https://${hostFromEnv()}/trnRegister`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body, redirect: "error", signal: timeout(),
    });
    const text = await response.text();
    let token: unknown;
    try {
      const data = JSON.parse(text);
      token = data?.data?.token ?? data?.token;
    } catch {
      token = new URLSearchParams(text).get("token");
    }
    if (!response.ok || typeof token !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(token)) {
      throw new Error("p24_registration_unconfirmed");
    }
    return token;
  };
}

export async function findP24Payment(sessionId: string, expected: number) {
  const { merchantId, posId, crc } = credentials();
  const auth = authorization(posId);
  const base = `https://${hostFromEnv()}/api/v1/transaction`;
  const response = await fetch(`${base}/by/sessionId/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: auth }, redirect: "error", signal: timeout(),
  });
  if (response.status === 404) return { state: "awaiting" } as const;
  if (!response.ok) throw new Error("p24_lookup_failed");

  const { data } = await response.json();
  if (data?.sessionId !== sessionId || data.currency !== "PLN" || data.amount !== expected) return { state: "mismatch" } as const;
  if (data.status === 0) return { state: "awaiting" } as const;
  if (data.status === 3) return { state: "refunded" } as const;
  if (![1, 2].includes(data.status) || !Number.isSafeInteger(data.orderId) || data.orderId <= 0) return { state: "mismatch" } as const;

  if (data.status === 1) {
    const details = { sessionId, orderId: data.orderId, amount: expected, currency: "PLN", crc };
    const sign = createHash("sha384").update(JSON.stringify(details)).digest("hex");
    const verified = await fetch(`${base}/verify`, {
      method: "PUT", headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ merchantId, posId, sessionId, amount: expected, currency: "PLN", orderId: data.orderId, sign }),
      redirect: "error", signal: timeout(),
    });
    const verification = await verified.json().catch(() => null);
    if (!verified.ok || verification?.data?.status !== "success") throw new Error("p24_verify_pending");
  }

  return { state: "paid", gatewayOrderId: String(data.orderId) } as const;
}
