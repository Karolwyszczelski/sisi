const STORAGE_KEY = "sisi.checkout-attempt";
type CheckoutAttempt = { fingerprint: string; key: string };

export async function checkoutBodyFingerprint(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readCheckoutAttempt(): CheckoutAttempt | null {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return typeof attempt?.key === "string" && typeof attempt?.fingerprint === "string" ? attempt : null;
  } catch {
    return null;
  }
}

export function storeCheckoutAttempt(attempt: CheckoutAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The caller still holds the attempt in memory for this page.
  }
}
