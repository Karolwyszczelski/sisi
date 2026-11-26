import type { CartItem } from "@/store/cartStore";

export const GTM_CONTAINER_ID = "GTM-MHTJ5JWK";
export const GA_MEASUREMENT_ID = "G-F9M54DG2CZ";
export const COOKIE_CONSENT_KEY = "cookie_consent_v1";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price: number;
  quantity: number;
};

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  currency: "PLN";
  items: AnalyticsItem[];
  shipping?: number;
  coupon?: string;
  payment_type?: string;
  fulfillment_type?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

export function readCookieConsent(): CookieConsent | null {
  if (!isBrowser()) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || "null");
    if (!parsed || typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return { necessary: true, analytics: parsed.analytics, marketing: parsed.marketing };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return readCookieConsent()?.analytics === true;
}

export function ensureGoogleDataLayer() {
  if (!isBrowser()) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer?.push(arguments);
  };
}

export function loadGoogleTagManager() {
  if (!isBrowser() || !hasAnalyticsConsent()) return;
  if (document.querySelector(`script[data-gtm-id="${GTM_CONTAINER_ID}"]`)) return;

  ensureGoogleDataLayer();
  window.dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`;
  script.dataset.gtmId = GTM_CONTAINER_ID;
  document.head.appendChild(script);
}

export function applyGoogleConsent(consent: CookieConsent) {
  if (!isBrowser()) return;
  ensureGoogleDataLayer();

  window.gtag?.("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
  });

  if (consent.analytics) loadGoogleTagManager();
  window.dispatchEvent(new CustomEvent("sisi:consent-updated", { detail: consent }));
}

export function trackEvent(eventName: string, parameters: Record<string, unknown> = {}) {
  if (!isBrowser() || !hasAnalyticsConsent()) return;
  ensureGoogleDataLayer();
  loadGoogleTagManager();
  window.gtag?.("event", eventName, parameters);
}

export function cartItemToAnalytics(item: CartItem, quantity = item.quantity || 1): AnalyticsItem {
  return {
    item_id: String(item.product_id ?? item.name),
    item_name: item.name,
    ...(item.category ? { item_category: item.category } : {}),
    price: Number(item.price) || 0,
    quantity,
  };
}

export function cartItemsToAnalytics(items: CartItem[]) {
  return items.map((item) => cartItemToAnalytics(item));
}

export function cartValue(items: CartItem[]) {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0);
}

export function trackPurchase(payload: PurchasePayload) {
  if (!isBrowser() || !hasAnalyticsConsent()) return;
  const key = `sisi_ga_purchase_${payload.transaction_id}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {}
  trackEvent("purchase", payload);
}

export function storePendingPurchase(payload: PurchasePayload) {
  if (!isBrowser() || !hasAnalyticsConsent()) return;
  try {
    sessionStorage.setItem(`sisi_pending_purchase_${payload.transaction_id}`, JSON.stringify(payload));
  } catch {}
}

export function completePendingPurchase(transactionId: string) {
  if (!isBrowser() || !hasAnalyticsConsent()) return;
  const key = `sisi_pending_purchase_${transactionId}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const payload = JSON.parse(raw) as PurchasePayload;
    trackPurchase(payload);
    sessionStorage.removeItem(key);
  } catch {}
}
