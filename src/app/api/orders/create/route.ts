import { kickOrderJobs } from "@/lib/kickOrderJobs";
import { createHash } from "node:crypto";
import { parseDepositGrosze } from "@/lib/containerDeposit";
import { EXTRA_MEAT_GROSZE, fromGrosze, productLineGrosze, quoteInPln, toGrosze } from "@/lib/orderPricing";
import { ORDER_TERMS_TEXT, ORDER_TERMS_VERSION } from "@/config/termsSnapshot";
import { getSessionAndRole } from "@/lib/serverAuth";
import { checkoutSelectionSchema, validateCheckoutLine, type CheckoutAddon } from "@/lib/checkoutValidation";
import { canAcceptOrder, readOrderAvailability } from "@/lib/orderAvailability";
// src/app/api/orders/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  requiresPackaging,
} from "@/lib/packaging";
import {
  calculateDeliveryQuote,
  type DeliveryZonePricing,
  validateDeliveryZones,
} from "@/lib/deliveryPricing";
import {
  getDeliveryPlace,
  getDrivingDistanceKmToPlace,
  isValidGooglePlaceId,
} from "@/lib/googleDelivery";

/* === email + link śledzenia === */
import { signPayment } from "@/lib/orderLink";

/* ============== Supabase admin ============== */
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

// Lazy-loaded singleton for backward compatibility
let _supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = getSupabaseAdmin();
    return (_supabaseAdmin as any)[prop];
  },
});

/* ================= Turnstile =================== */
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";

/* ====== Wersje/Linki regulaminów (do maili) ====== */
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || "2025-01";
/* ============== Typy i utils =============== */
type Any = Record<string, any>;

type NormalizedItem = {
  product_id?: string | number;
  name: string;
  quantity: number;
  price: number;
  category?: string | null;
  addons: string[];
  ingredients: string[];
  note?: string;
  description?: string;
  _src?: Any;
};

const num = (v: any, d: number | null = null): number | null => {
  if (v == null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Normalizacja ceny: przyjmuje "20,90" i "20.90" */
const money = (v: any): number => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  if (typeof v === "string") {
    const s = v.replace(/[^0-9,.\-]/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  return 0;
};

/* twarda normalizacja do E.164 (+48500111222) */
const normalizePhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = "48" + digits; // lokalne PL
  if (digits.length < 9 || digits.length > 15) return null;
  const e164 = "+" + digits;
  return /^\+[1-9]\d{8,14}$/.test(e164) ? e164 : null;
};

// === START INSERT: normalizeOrderNote ===
const normalizeOrderNote = (v: any): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, 500);
};
// === END INSERT: normalizeOrderNote ===


const toArray = (val: any): any[] =>
  Array.isArray(val) ? val : val == null ? [] : [val];

const clientIp = (req: Request) => {
  const xff =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "";
  return xff.split(",")[0].trim() || null;
};

/* ----- Parser składników ----- */
const parseIngredients = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "object") {
    if (Array.isArray((v as any).items)) return parseIngredients((v as any).items);
    return Object.values(v).map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    const s = v.trim();
    try {
      return parseIngredients(JSON.parse(s));
    } catch {}
    if (s.startsWith("{") && s.endsWith("}")) {
      return s
        .slice(1, -1)
        .split(",")
        .map((x) => x.replace(/^"+|"+$/g, "").trim())
        .filter(Boolean);
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

/* ============== Enrichment z DB ============== */


type ProductRow = {
  id: string | number;
  name?: string | null;
  title?: string | null;
  label?: string | null;
  description?: string | null;
  description_pl?: string | null;
  ingredients?: any;
  composition?: any;
  sklad?: any;
};

const nameFromProductRow = (row?: ProductRow): string | undefined =>
  row ? row.name || row.title || row.label || undefined : undefined;

const descFromProductRow = (row?: ProductRow): string | undefined =>
  row ? row.description_pl ?? row.description ?? undefined : undefined;

const ingredientsFromProductRow = (row?: ProductRow): string[] =>
  row
    ? parseIngredients(row.ingredients) ||
      parseIngredients(row.composition) ||
      parseIngredients(row.sklad) ||
      []
    : [];

/* ----- Sklej DB + opcje klienta ----- */
function buildItemFromDbAndOptions(dbRow: ProductRow | undefined, raw: Any): NormalizedItem {
  const productId = dbRow?.id ?? raw.product_id ?? raw.productId ?? raw.id ?? undefined;
  const baseName =
    nameFromProductRow(dbRow) ||
    raw.name ||
    raw.product_name ||
    raw.productName ||
    raw.title ||
    raw.label ||
    "(bez nazwy)";

  const quantity = (num(raw.quantity ?? raw.qty ?? 1, 1) ?? 1) as number;
  const price = money(raw.price ?? raw.unit_price ?? raw.total_price ?? 0);

  const opt = raw.options ?? {};
  const addons: string[] = [
    ...toArray(raw.addons),
    ...toArray(opt.addons),
    ...toArray(raw.extras),
    ...toArray(raw.toppings),
    ...toArray(raw.selected_addons),
  ]
    .flat()
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);

  if (typeof opt.extraMeatCount === "number" && opt.extraMeatCount > 0) {
    addons.push(`Dodatkowe mięso x${opt.extraMeatCount}`);
  }
  if (typeof opt.meatType === "string" && opt.meatType.trim()) {
    addons.push(`Mięso: ${opt.meatType.trim()}`);
  }

  const baseIngredients = ingredientsFromProductRow(dbRow);
  const clientIng =
    parseIngredients(raw.ingredients) ||
    parseIngredients(raw.sklad) ||
    parseIngredients(raw.composition);
  const ingredients = [...baseIngredients, ...clientIng];

  const note =
    (typeof raw.note === "string" && raw.note) ||
    (typeof opt.note === "string" && opt.note) ||
    undefined;

  const description =
    (typeof raw.description === "string" && raw.description) ||
    descFromProductRow(dbRow);

  return {
    product_id: productId,
    name: String(baseName),
    quantity,
    price,
    addons,
    ingredients,
    note,
    description,
    _src: raw,
  };
}

// === START INSERT: TZ helpers (Europe/Warsaw) ===
const APP_TZ = "Europe/Warsaw";

type TzParts = {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
};

const getTzParts = (date: Date, timeZone: string): TzParts => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const out: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = p.value;

  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
};

const getOffsetMs = (date: Date, timeZone: string): number => {
  const p = getTzParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
};

const zonedDateTimeToUtc = (
  p: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string
): Date => {
  const desiredAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second ?? 0);

  // 1) pierwsze przybliżenie
  let utc = desiredAsUtc - getOffsetMs(new Date(desiredAsUtc), timeZone);

  // 2) drugi przebieg (ważne na granicach DST)
  const off2 = getOffsetMs(new Date(utc), timeZone);
  utc = desiredAsUtc - off2;

  return new Date(utc);
};
// === END INSERT: TZ helpers (Europe/Warsaw) ===


/* ----- Promo picker + czas klienta ----- */
function pickPromo(v: any): string | null {
  const src = v || {};
  const keys = [
    "promo_code","promoCode","code","coupon","coupon_code","couponCode",
    "discount_code","discountCode","voucher","voucher_code","voucherCode"
  ];
  for (const k of keys) {
    const val = src?.[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

type ClientTimeNorm = { client_delivery_time: string | null; delivery_time: string | null };

function normalizeClientTime(v: any): ClientTimeNorm {
  if (!v) return { client_delivery_time: null, delivery_time: null };

  if (typeof v === "string" && v.trim().toLowerCase() === "asap") {
    return { client_delivery_time: "asap", delivery_time: null };
  }

  const tz = APP_TZ;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const parseHHMM = (s: string) => {
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    return { hh, mm };
  };

  if (typeof v === "string") {
    const s = v.trim();
    const hm = parseHHMM(s);

    // 1) "HH:mm" z FE -> client_delivery_time="HH:mm", deliveryTime=UTC ISO (dziś/jutro w PL)
    if (hm) {
      const { hh, mm } = hm;

      const nowUtc = new Date();
      const nowPl = toZonedTime(nowUtc, tz);

      const localIsoToday = `${ymd(nowPl)}T${pad2(hh)}:${pad2(mm)}:00`;
      let utcDate = fromZonedTime(localIsoToday, tz);

      if (utcDate.getTime() < nowUtc.getTime()) {
        const tomorrowPl = new Date(nowPl);
        tomorrowPl.setDate(tomorrowPl.getDate() + 1);
        const localIsoTomorrow = `${ymd(tomorrowPl)}T${pad2(hh)}:${pad2(mm)}:00`;
        utcDate = fromZonedTime(localIsoTomorrow, tz);
      }

      return {
        client_delivery_time: `${pad2(hh)}:${pad2(mm)}`,
        delivery_time: utcDate.toISOString(),
      };
    }

    // 2) Jeśli przyszło ISO/date-string -> client_delivery_time wyliczamy w PL, deliveryTime = ISO UTC
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const pl = toZonedTime(d, tz);
      return {
        client_delivery_time: `${pad2(pl.getHours())}:${pad2(pl.getMinutes())}`,
        delivery_time: d.toISOString(),
      };
    }
  }

  if (v instanceof Date && !isNaN(v.getTime())) {
    const pl = toZonedTime(v, tz);
    return {
      client_delivery_time: `${pad2(pl.getHours())}:${pad2(pl.getMinutes())}`,
      delivery_time: v.toISOString(),
    };
  }

  return { client_delivery_time: null, delivery_time: null };
}

/* ============== Normalizacja BODY ============== */
function normalizeBody(raw: any, req: Request) {
  const base = raw?.orderPayload ? raw.orderPayload : raw;
  const rawItems =
    raw?.items ??
    base?.items ??
    raw?.order_items ??
    raw?.cart ??
    raw?.products ??
    raw?.itemsPayload ??
    [];
  const itemsArray: Any[] =
    typeof rawItems === "string"
      ? (() => {
          try {
            return JSON.parse(rawItems);
          } catch {
            return [];
          }
        })()
      : Array.isArray(rawItems)
      ? rawItems
      : [];

  // akceptacja prawna (z ciała lub auto)
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;
  const accepted_at = new Date().toISOString();

  const submittedTerms = base?.legal_accept?.terms_version;
  const legal_accept = submittedTerms === ORDER_TERMS_VERSION
    ? { terms_version: submittedTerms, terms_text: ORDER_TERMS_TEXT, privacy_version: PRIVACY_VERSION, marketing_opt_in: false, accepted_at, ip, ua }
    : null;

  return {
    name: base?.name ?? base?.customer_name ?? null,
    phone: base?.phone ?? null, // surowy, walidujemy niżej twardo
    contact_email: base?.contact_email ?? base?.email ?? null,
        // === START INSERT: order_note ===
    order_note: normalizeOrderNote(
      base?.order_note ??
      base?.orderNote ??
      raw?.order_note ??
      raw?.orderNote ??
      null
    ),
    // === END INSERT: order_note ===

    address: base?.address ?? null,
    street: base?.street ?? null,
    postal_code: base?.postal_code ?? null,
    city: base?.city ?? null,
    flat_number: base?.flat_number ?? null,
    selected_option: base?.selected_option,
    payment_method: base?.payment_method,
    payment_status:
      base?.payment_method === "Online" ? "pending" : null,
    promo_code: pickPromo(base) ?? pickPromo(raw),
    delivery_cost: 0,
    delivery_place_id:
      base?.delivery_place_id ??
      base?.deliveryPlaceId ??
      raw?.delivery_place_id ??
      raw?.deliveryPlaceId ??
      null,
    delivery_lat: num(base?.delivery_lat ?? base?.lat, null),
    delivery_lng: num(base?.delivery_lng ?? base?.lng, null),
    status: "placed",
    // czas dostawy (canonical) + legacy kolumna "deliveryTime" (case-sensitive)
    ...(() => {
      const ct = normalizeClientTime(base?.client_delivery_time ?? base?.delivery_time ?? null);
      return {
        client_delivery_time: ct.client_delivery_time,
        delivery_time: ct.delivery_time,
      };
    })(),
    eta: base?.eta ?? null,
    user: null as string | null,
    legal_accept,
    itemsArray,
  };
}

type CheckoutPrice = Parameters<typeof quoteInPln>[0];
type SavedCheckout = {
  orderId: string;
  price: CheckoutPrice;
  promoCode: string | null;
  paymentMethod: string;
  createdAt: string;
};

function checkoutResponse(result: SavedCheckout, replayed: boolean) {
  return NextResponse.json({
    orderId: result.orderId,
    total: fromGrosze(result.price.total),
    discount_amount: fromGrosze(result.price.discount),
    promo_code: result.promoCode,
    ...(result.paymentMethod === "Online" && {
      paymentToken: signPayment(result.orderId, Date.parse(result.createdAt)),
    }),
  }, { status: replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let packagingCostSetting = 2;
  const addonPriceMap = new Map<string, CheckoutAddon>();
  const productsMap = new Map<string, ProductRow & { price: unknown; deposit_grosze: number; available: boolean | null; category: string | null; subcategory: string | null }>();

  try {
    const raw = await req.json().catch(() => null);
    const selection = checkoutSelectionSchema.safeParse(raw?.orderPayload ?? raw);
    if (!selection.success) {
      return NextResponse.json({ error: "Wybierz poprawny tryb zamówienia i metodę płatności." }, { status: 400 });
    }
    const key = req.headers.get("x-idempotency-key");
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      return NextResponse.json({ error: "Brakuje poprawnego identyfikatora próby zamówienia." }, { status: 400 });
    }

    const n = normalizeBody(raw, req);
    if (n.payment_method === "Online" && !process.env.ORDER_LINK_SECRET) {
      return NextResponse.json({ error: "Płatność online jest chwilowo niedostępna." }, { status: 503 });
    }
    const { session } = await getSessionAndRole();
    n.user = session?.user.id ?? null;
    const displayedTotal = (raw.orderPayload ?? raw).total_price;
    const expectedGrosze = typeof displayedTotal === "number" ? toGrosze(displayedTotal) : NaN;
    if (!Number.isSafeInteger(expectedGrosze) || displayedTotal < 0) {
      return NextResponse.json({ error: "Brakuje kwoty do potwierdzenia." }, { status: 400 });
    }

    // Bind retries to the submitted order and authenticated identity, without
    // including the one-time Turnstile token or request metadata.
    const { legal_accept, ...intent } = n;
    const fingerprint = createHash("sha256").update(JSON.stringify(
      { ...intent, client_delivery_time: (raw.orderPayload ?? raw).client_delivery_time ?? (raw.orderPayload ?? raw).delivery_time ?? null,
        delivery_time: undefined, terms: legal_accept?.terms_version, expectedGrosze },
      (_key, value) => value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))
        : value,
    )).digest("hex");
    const keyConflict = () => NextResponse.json({ code: "KEY_CONFLICT", error: "Ta próba dotyczy innego zamówienia." }, { status: 409 });
    const orderUnavailable = () => NextResponse.json({ error: "Zapisane zamówienie jest niedostępne." }, { status: 409 });
    const closed = () => NextResponse.json({ error: "Przyjmowanie zamówień w tym trybie jest tymczasowo wyłączone." }, { status: 503 });

    const previous = await supabaseAdmin.from("checkout_requests").select("fingerprint,order_id,result").eq("key", key).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data) {
      if (previous.data.fingerprint !== fingerprint) return keyConflict();
      if (!previous.data.order_id) return orderUnavailable();
      return checkoutResponse(previous.data.result as SavedCheckout, true);
    }

    const availability = await readOrderAvailability(supabaseAdmin).catch(() => null);
    if (!availability || !canAcceptOrder(availability.effective, selection.data.selected_option)) return closed();

    // 1) Godziny (Europe/Warsaw)
    const nowPl = toZonedTime(new Date(), "Europe/Warsaw");
    const h = nowPl.getHours();
    const m = nowPl.getMinutes();
    const beforeOpen = h < 10 || (h === 10 && m < 40);
    const afterClose = h > 21 || (h === 21 && m > 45);
    if (beforeOpen || afterClose) {
      return NextResponse.json(
        { error: "Zamówienia przyjmujemy w godz. 10:40–21:45." },
        { status: 400 }
      );
    }

    // 2.0) Turnstile
if (TURNSTILE_SECRET_KEY) {
  // token z nagłówka (różne warianty) lub z body (fallback)
  let token =
    req.headers.get("cf-turnstile-response") ||
    req.headers.get("CF-Turnstile-Response") ||
    req.headers.get("x-turnstile-token") ||
    null;

  if (!token) {
    try {
      const b: any = raw || (await req.clone().json().catch(() => null));
      token =
        b?.turnstileToken ||
        b?.token ||
        b?.cf_turnstile_token ||
        null;
    } catch {}
  }

  if (!token) {
    return NextResponse.json({ error: "Brak weryfikacji antybot." }, { status: 400 });
  }

  try {
    const ver = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: String(token),
        remoteip: clientIp(req) || "",
      }).toString(),
    });
    const jr = (await ver.json()) as any;

    if (!jr?.success) {
      const codes: string[] = Array.isArray(jr?.["error-codes"]) ? jr["error-codes"] : [];
      console.error("[turnstile.verify] fail", codes.length ? codes : jr);
      // ważne: dla timeout-or-duplicate zwracamy 409, żeby FE mógł zrobić 1x retry z nowym tokenem
      if (codes.includes("timeout-or-duplicate")) {
        return NextResponse.json({ error: "duplicate" }, { status: 409 });
      }
      return NextResponse.json({ error: "Nieudana weryfikacja formularza." }, { status: 400 });
    }
  } catch (e) {
    console.error("[turnstile.verify] error", e);
    return NextResponse.json({ error: "Błąd weryfikacji formularza." }, { status: 400 });
  }
}

    if (!n.legal_accept) return NextResponse.json({ error: "Zaakceptuj regulamin zamówień." }, { status: 400 });

    // wymagamy telefonu (E.164), e-maila oraz pozycji
    const phoneE164 = normalizePhone(n.phone);
    if (!phoneE164) {
      return NextResponse.json(
        { error: "Podaj poprawny numer telefonu (np. +48500111222)." },
        { status: 400 }
      );
    }
    n.phone = phoneE164;

    if (!n.contact_email) {
      return NextResponse.json(
        { error: "Wymagany jest adres e-mail do potwierdzenia." },
        { status: 400 }
      );
    }
    if (!Array.isArray(n.itemsArray) || n.itemsArray.length === 0) {
      return NextResponse.json({ error: "Koszyk jest pusty." }, { status: 400 });
    }
    {
      const [addonsRes, productsRes] = await Promise.all([
        supabaseAdmin.from("addons").select("name,price,category").eq("available", true),
        supabaseAdmin
          .from("products")
          .select("id, name, category, subcategory, price, available, description, ingredients, deposit_grosze"),
      ]);
      const { data: addons, error: addonsErr } = addonsRes;
      const { data: products, error: productsErr } = productsRes;

      if (typeof availability.packagingCost === "number") {
        packagingCostSetting = availability.packagingCost;
      }

      if (!addonsErr && addons) {
        for (const addon of addons) {
          if (typeof addon.name === "string" && addon.name.trim() && typeof addon.price === "number" && Number.isFinite(addon.price) && addon.price >= 0) {
            const name = addon.name.trim().toLowerCase();
            addonPriceMap.set(name, { price: addon.price, category: addon.category });
          }
        }
      }

      if (productsErr || addonsErr) {
        return NextResponse.json({ error: "Katalog zamówień jest niedostępny." }, { status: 503 });
      }

      // Buduj mapę kategorii produktów (dla kaucji)
      if (!productsErr && products) {
        for (const product of products) {
          productsMap.set(String(product.id), product);

        }
      }
    }

    const catalogItems: Any[] = [];
    for (const item of n.itemsArray) {
      const product = productsMap.get(String(item?.product_id ?? item?.productId ?? item?.id ?? ""));
      const price = Number(product?.price);
      if (!product?.name || product.available === false || product.price == null || !Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Produkt jest niedostępny. Odśwież menu i sprawdź koszyk." }, { status: 409 });
      }
      const line = validateCheckoutLine(item, product, addonPriceMap);
      if ("error" in line) {
        return NextResponse.json({ error: line.error }, { status: 400 });
      }
      catalogItems.push({
        product_id: product.id,
        name: product.name,
        category: product.category,
        deposit_grosze: product.deposit_grosze,
        quantity: line.quantity,
        price: fromGrosze(toGrosze(price)),
        options: line.options,
      });
    }
    n.itemsArray = catalogItems;

    const takeout = n.selected_option === "takeaway" || n.selected_option === "delivery";
    const lineDetails = n.itemsArray.map((item) => {
      const unitPrice = toGrosze(item.price);
      const addons = (item.options.addons as string[]).map((name) => {
        const addon = addonPriceMap.get(name.toLowerCase())!;
        return { name, unitPrice: toGrosze(addon.price), category: addon.category };
      });
      const extraMeatCount = item.options.extraMeatCount;
      const quantity = item.quantity;
      return {
        productId: item.product_id,
        quantity,
        unitPrice,
        addons,
        extraMeatCount,
        extraMeatUnitPrice: EXTRA_MEAT_GROSZE,
        products: productLineGrosze(unitPrice, addons.map((addon) => addon.unitPrice), extraMeatCount, quantity),
        packaging: takeout && requiresPackaging(item.category) ? quantity * toGrosze(packagingCostSetting) : 0,
        deposit: takeout ? parseDepositGrosze(item.deposit_grosze ?? 0) * quantity : 0,
      };
    });
    const lines = lineDetails.map((line) => line.products);
    const products = lines.reduce((sum, amount) => sum + amount, 0);
    const packaging = lineDetails.reduce((sum, line) => sum + line.packaging, 0);
    const deposit = lineDetails.reduce((sum, line) => sum + line.deposit, 0);

    let deliveryMinRequired = 0;

    // 2.2) Dostawa
    if (n.selected_option === "delivery") {
      if (!isValidGooglePlaceId(n.delivery_place_id)) {
        return NextResponse.json(
          { error: "Wybierz adres z listy, aby ustawić lokalizację dostawy." },
          { status: 400 }
        );
      }

      const [{ data: zones, error: zErr }, { data: rest, error: rErr }] = await Promise.all([
        supabaseAdmin.from("delivery_zones").select("*").eq("active", true),
        supabaseAdmin.from("restaurant_info").select("lat,lng").eq("id", 1).single(),
      ]);

      if (zErr || rErr || !zones || !rest) {
        return NextResponse.json({ error: "Brak konfiguracji stref dostawy." }, { status: 500 });
      }

      const zoneValidationErrors = validateDeliveryZones(
        zones as DeliveryZonePricing[],
      );
      if (zoneValidationErrors.length) {
        console.error(
          "[orders.create] Invalid delivery zones:",
          zoneValidationErrors.join(" "),
        );
        return NextResponse.json(
          { error: "Konfiguracja stref dostawy wymaga poprawy." },
          { status: 503 },
        );
      }

      const origin = { lat: Number(rest.lat), lng: Number(rest.lng) };
      if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
        return NextResponse.json(
          { error: "Punkt startowy restauracji jest nieprawidłowy." },
          { status: 503 },
        );
      }

      let distanceKm: number;
      let deliveryPlace: Awaited<ReturnType<typeof getDeliveryPlace>>;
      try {
        [distanceKm, deliveryPlace] = await Promise.all([
          getDrivingDistanceKmToPlace(origin, n.delivery_place_id),
          getDeliveryPlace(n.delivery_place_id),
        ]);
      } catch (error) {
        console.error(
          "[orders.create] Google delivery verification error:",
          error instanceof Error ? error.message : error,
        );
        return NextResponse.json(
          { error: "Nie udało się potwierdzić drogowej trasy dostawy. Spróbuj ponownie." },
          { status: 503 },
        );
      }

      const productsOnlyTotal = fromGrosze(products);
      const deliveryQuote = calculateDeliveryQuote(
        distanceKm,
        zones as DeliveryZonePricing[],
        productsOnlyTotal,
        deliveryPlace.city,
      );
      if (!deliveryQuote) {
        return NextResponse.json(
          {
            error: `Adres poza zasięgiem dostawy (${Math.round(distanceKm)} km).`,
          },
          { status: 400 },
        );
      }

      deliveryMinRequired = deliveryQuote.minOrderValue;
      if (!deliveryQuote.minOrderOk) {
        return NextResponse.json(
          { error: `Minimalna wartość zamówienia dla dostawy to ${deliveryMinRequired.toFixed(2)} zł (wartość produktów: ${productsOnlyTotal.toFixed(2)} zł).` },
          { status: 400 }
        );
      }

      // Dane adresowe i współrzędne pochodzą z Google Place ID, a nie z pól
      // możliwych do zmiany po stronie klienta.
      n.street = deliveryPlace.street;
      n.city = deliveryPlace.city;
      n.postal_code = deliveryPlace.postalCode;
      n.address = deliveryPlace.formattedAddress;
      n.delivery_lat = deliveryPlace.lat;
      n.delivery_lng = deliveryPlace.lng;
      n.delivery_cost = deliveryQuote.cost;
    }

    // 4) Pozycje
    const normalizedItems: NormalizedItem[] = n.itemsArray.map((it) => {
      const key = String(it.product_id ?? it.productId ?? it.id ?? "");
      const db = productsMap.get(key);
      return {
        ...buildItemFromDbAndOptions(db, it),
        category: it.category ?? null,
      };
    });

    const delivery = toGrosze(n.delivery_cost);
    const { data: result, error: checkoutError } = await supabaseAdmin.rpc("sisi_create_checkout", {
      request_key: key,
      request_fingerprint: fingerprint,
      order_data: {
        name: n.name,
        phone: n.phone,
        contact_email: n.contact_email,
        order_note: n.order_note,
        address: n.address,
        street: n.street,
        postal_code: n.postal_code,
        city: n.city,
        flat_number: n.flat_number,
        selected_option: n.selected_option,
        payment_method: n.payment_method,
        payment_status: n.payment_status,
        items: JSON.stringify(normalizedItems),
        delivery_min_required: deliveryMinRequired,
        status: n.status,
        client_delivery_time: n.client_delivery_time,
        delivery_time: n.delivery_time,
        eta: n.eta,
        user: n.user,
        legal_accept: { ...n.legal_accept, packaging_total: fromGrosze(packaging), deposit_total: fromGrosze(deposit) },
      },
      order_lines: normalizedItems.map((item, i) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        line_no: i + 1,
      })),
      price: { products, packaging, delivery, deposit, lines, lineDetails },
      expected_grosze: expectedGrosze,
      requested_code: n.promo_code,
    });
    if (checkoutError) throw checkoutError;
    switch (result?.status) {
      case "KEY_CONFLICT": return keyConflict();
      case "ORDER_UNAVAILABLE": return orderUnavailable();
      case "CLOSED": return closed();
      case "PROMO_UNAVAILABLE":
        return NextResponse.json({ error: "Kod promocyjny jest nieważny lub został już wykorzystany." }, { status: 400 });
      case "ZERO_ONLINE":
        return NextResponse.json({ error: "Dla zamówienia o wartości 0 zł wybierz inną metodę płatności." }, { status: 400 });
      case "PRICE_CHANGED": {
        const quote = quoteInPln(result.price);
        return NextResponse.json({ code: "PRICE_CHANGED", total: quote.total, quote }, { status: 409 });
      }
      case "OK": break;
      default: throw new Error("Unexpected checkout outcome");
    }

    const saved = result as SavedCheckout;
    if (result.replayed) return checkoutResponse(saved, true);
    const jobs = [`mail:${saved.orderId}:received`];
    if (saved.paymentMethod !== "Online") jobs.push(`pos:${saved.orderId}`);
    kickOrderJobs(...jobs);
    return checkoutResponse(saved, false);
  } catch (e: any) {
    console.error("[orders.create] unexpected error", e?.code ?? "internal");
    return NextResponse.json({ error: "Wystąpił nieoczekiwany błąd." }, { status: 500 });
  }
}
