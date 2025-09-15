// src/lib/p24.ts
import crypto from "crypto";

export const isProd = (process.env.P24_ENV || "sandbox") === "prod";
export const P24_BASE = isProd
  ? "https://secure.przelewy24.pl"
  : "https://sandbox.przelewy24.pl";

export function p24RegisterUrl() {
  return `${P24_BASE}/api/v1/transaction/register`;
}
export function p24VerifyUrl() {
  return `${P24_BASE}/api/v1/transaction/verify`;
}

// HMAC-SHA384(json, API_KEY), json musi zawierać crc
export function p24SignHmacSha384(payload: object, apiKey: string) {
  const json = JSON.stringify(payload);
  return crypto.createHmac("sha384", apiKey).update(json).digest("hex");
}

export function amountToGrosze(amountPln: number) {
  return Math.round(Number(amountPln) * 100);
}
