import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.ORDER_LINK_SECRET;
const TRACKING_TTL = 7 * 24 * 60 * 60;
const PAYMENT_TTL = 2 * 60 * 60;

function digest(scope: string, id: string, expires: number) {
  if (!secret) throw new Error("ORDER_LINK_SECRET is not configured");
  return createHmac("sha256", secret).update(JSON.stringify([scope, id, expires])).digest("hex");
}

function issue(scope: string, id: string, ttl: number, issuedAt = Date.now()) {
  const expires = Math.floor(issuedAt / 1000) + ttl;
  return `${expires}.${digest(scope, id, expires)}`;
}

function matches(scope: string, id: string, token: unknown) {
  if (!secret || typeof token !== "string") return false;
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(digest(scope, id, expires), "hex"), Buffer.from(match[2], "hex"));
}

export function verify(id: string, token?: string | null) {
  return matches("tracking", id, token);
}

export function trackingUrl(origin: string, id: string) {
  const url = new URL(`/order/${encodeURIComponent(id)}`, origin);
  url.searchParams.set("t", issue("tracking", id, TRACKING_TTL));
  return url.href;
}

export function signPayment(orderId: string, issuedAt?: number) {
  return issue("payment", orderId, PAYMENT_TTL, issuedAt);
}

export function verifyPayment(orderId: string, token: unknown) {
  return matches("payment", orderId, token);
}
