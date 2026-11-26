import { createHmac, timingSafeEqual } from "node:crypto";

export function orderDispatchToken(orderId: string): string | null {
  const secret = process.env.ORDER_DISPATCH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHmac("sha256", secret).update(`sisi:dotypos:${orderId}`).digest("hex") : null;
}

export function isOrderDispatchAuthorized(orderId: string, token: string | null): boolean {
  const expected = orderDispatchToken(orderId);
  if (!expected || !token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}
