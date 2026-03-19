// src/lib/dotykacka.ts
// =============================================
// ⚠️  DEPRECATED - API v1 Client (dotykacka.pl)
// =============================================
// This file uses the old v1 API at api.dotykacka.pl which is deprecated.
// All new integrations should use the v2 API client in ./dotypos.ts
// which connects to api.dotykacka.cz/v2 (Dotypos API v2, 2026.10.0).
//
// This file is kept for reference only. Do NOT use in production.
// Migration: Replace getDotykackaToken() → dotypos.getAccessToken()
//            Replace sendOrderToDotykacka() → dotypos.createOrder()
// =============================================

/**
 * @deprecated Use dotypos.getAccessToken() from ./dotypos.ts instead.
 * The v1 API at api.dotykacka.pl is no longer maintained.
 */
export async function getDotykackaToken(): Promise<string> {
  console.warn(
    "[DEPRECATED] getDotykackaToken() uses old v1 API. Migrate to dotypos.ts v2 client."
  );

  const CLIENT_ID = process.env.DOTYKACKA_CLIENT_ID!;
  const CLIENT_SECRET = process.env.DOTYKACKA_CLIENT_SECRET!;

  const resp = await fetch("https://api.dotykacka.pl/v1/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!resp.ok) throw new Error(`Token fetch failed: ${resp.status}`);
  const { access_token } = await resp.json();
  return access_token;
}

/**
 * @deprecated Use dotypos.createOrder() from ./dotypos.ts instead.
 * The v1 API at api.dotykacka.pl is no longer maintained.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendOrderToDotykacka(orderData: any) {
  console.warn(
    "[DEPRECATED] sendOrderToDotykacka() uses old v1 API. Migrate to dotypos.ts v2 client."
  );

  const token = await getDotykackaToken();
  const resp = await fetch("https://api.dotykacka.pl/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  });
  if (!resp.ok) throw new Error(`Order POST failed: ${resp.status}`);
  return resp.json();
}
