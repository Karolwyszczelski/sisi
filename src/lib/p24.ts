import crypto from "crypto";

export const P24_ENV = (process.env.P24_ENV || "sandbox").toLowerCase();
export const isProd = P24_ENV === "prod";
export const P24_BASE = isProd
  ? "https://secure.przelewy24.pl"
  : "https://sandbox.przelewy24.pl";

export const hostFromEnv = () => (isProd ? "secure.przelewy24.pl" : "sandbox.przelewy24.pl");

// API v3.2 (legacy) – md5(sessionId|merchantId|amount|currency|crc)
export function p24SignRegisterMD5(
  sessionId: string,
  merchantId: string | number,
  amountGr: number,
  currency: string,
  crc: string
) {
  return crypto
    .createHash("md5")
    .update(`${sessionId}|${merchantId}|${amountGr}|${currency}|${crc}`)
    .digest("hex");
}

// API v3.2 (legacy) verify – md5(sessionId|orderId|amount|currency|crc)
export function p24SignVerifyMD5(
  sessionId: string,
  orderId: string | number,
  amountGr: number,
  currency: string,
  crc: string
) {
  return crypto
    .createHash("md5")
    .update(`${sessionId}|${orderId}|${amountGr}|${currency}|${crc}`)
    .digest("hex");
}

export function amountToGrosze(amountPln: number) {
  return Math.max(1, Math.round(Number(amountPln) * 100));
}
