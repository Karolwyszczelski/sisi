// src/app/api/orders/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { sendNewOrderPush } from "@/lib/pushServer";

/* === email + link śledzenia === */
import { trackingUrl } from "@/lib/orderLink";
import { sendEmail } from "@/lib/mailer";

/* ============== Supabase admin ============== */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/* ================= Turnstile =================== */
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";

/* ====== Wersje/Linki regulaminów (do maili) ====== */
const TERMS_VERSION = process.env.TERMS_VERSION || "2025-01";
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || "2025-01";
const TERMS_URL =
  process.env.TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL =
  process.env.PRIVACY_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";

/* ============== Typy i utils =============== */
type Any = Record<string, any>;

type NormalizedItem = {
  name: string;
  quantity: number;
  price: number;
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

const optLabel = (v?: string) =>
  v === "delivery" ? "DOSTAWA" : v === "takeaway" ? "NA WYNOS" : "NA MIEJSCU";

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
const PRODUCT_TABLES = ["products", "menu_items", "menu", "dishes"] as const;

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

async function fetchProductsByIds(idsMixed: (string | number)[]) {
  const ids = Array.from(new Set(idsMixed.map((x) => String(x)))).filter(Boolean);
  if (!ids.length) return new Map<string, ProductRow>();
  for (const table of PRODUCT_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id,name,title,label,description,description_pl,ingredients,composition,sklad")
      .in("id", ids);
    if (!error && data && data.length) {
      const map = new Map<string, ProductRow>();
      (data as any[]).forEach((r) => map.set(String(r.id), r as ProductRow));
      return map;
    }
  }
  return new Map<string, ProductRow>();
}

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

const ALLOWED_ORDER_STATUSES = ["new", "placed", "accepted", "cancelled", "completed"] as const;
type AllowedOrderStatus = (typeof ALLOWED_ORDER_STATUSES)[number];

function sanitizeOrderStatus(raw: unknown): AllowedOrderStatus {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (ALLOWED_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as AllowedOrderStatus)
    : "placed";
}

/* ===== Haversine ===== */
const haversineKm = (a:{lat:number;lng:number}, b:{lat:number;lng:number}) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s1 = Math.sin(dLat/2)**2 +
             Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s1));
};

// === START INSERT: Google driving distance (optional) ===
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

async function getDrivingDistanceKm(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<number | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(`${origin.lat},${origin.lng}`)}` +
    `&destinations=${encodeURIComponent(`${dest.lat},${dest.lng}`)}` +
    `&mode=driving&units=metric&key=${GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  if (data?.status !== "OK") return null;

  const el = data?.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") return null;

  const meters = Number(el.distance?.value);
  if (!Number.isFinite(meters)) return null;

  return meters / 1000;
}
// === END INSERT: Google driving distance (optional) ===


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

  const legal_accept =
    base?.legal_accept && typeof base.legal_accept === "object"
      ? {
          terms_version: base.legal_accept.terms_version || TERMS_VERSION,
          privacy_version: base.legal_accept.privacy_version || PRIVACY_VERSION,
          marketing_opt_in: !!base.legal_accept.marketing_opt_in,
          accepted_at: base.legal_accept.accepted_at || accepted_at,
          ip: base.legal_accept.ip || ip,
          ua: base.legal_accept.ua || ua,
        }
      : {
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          marketing_opt_in: !!base?.marketing_opt_in,
          accepted_at,
          ip,
          ua,
        };

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
    selected_option: (base?.selected_option as any) ?? "local",
    payment_method: base?.payment_method ?? "Gotówka",
    payment_status:
      (base?.payment_method ?? "Gotówka") === "Online" ? "pending" : null,
    total_price: num(base?.total_price, 0),
    promo_code: pickPromo(base) ?? pickPromo(raw),
    discount_amount: num(base?.discount_amount, 0) ?? 0,
    delivery_cost: num(base?.delivery_cost, null),
    delivery_lat: num(base?.delivery_lat ?? base?.lat, null),
    delivery_lng: num(base?.delivery_lng ?? base?.lng, null),
    status: sanitizeOrderStatus(base?.status),
    // czas dostawy (canonical) + legacy kolumna "deliveryTime" (case-sensitive)
    client_delivery_time: (() => {
      const v = normalizeClientTime(base?.client_delivery_time ?? base?.delivery_time ?? null);
      return v;
    })(),
    delivery_time: (() => {
      const v = normalizeClientTime(base?.client_delivery_time ?? base?.delivery_time ?? null);
      return v;
    })(),
    eta: base?.eta ?? null,
    user: base?.user ?? base?.user_id ?? null,
    legal_accept,
    itemsArray,
  };
}

/* ===== Kalkulacja subtotalu po stronie serwera (spójna z frontem) ===== */
const SAUCES = [
  "Amerykański","Ketchup","Majonez","Musztarda","Meksykański","Serowy chili","Czosnkowy","Musztardowo-miodowy","BBQ",
];

function calcSubtotalFromItems(selected_option: string, itemsArray: Any[]): number {
  const packaging = (selected_option === "delivery" || selected_option === "takeaway") ? 2 : 0;
  const itemsSum = itemsArray.reduce((acc, it) => {
    const qty = Number(it.quantity ?? 1) || 1;
    const basePrice = money(it.price ?? it.unit_price ?? 0);
    const addons = Array.isArray(it?.options?.addons) ? it.options.addons : (Array.isArray(it.addons) ? it.addons : []);
    const addonsCost = (addons ?? []).reduce((s: number, a: any) => s + (String(a).toLowerCase() === "płynny ser" ? 6 : SAUCES.includes(String(a)) ? 3 : 4), 0);
    const extraMeat = Number(it?.options?.extraMeatCount ?? 0) || 0;
    const extraMeatCost = extraMeat * 15;
    return acc + (basePrice + addonsCost + extraMeatCost) * qty;
  }, 0);
  return Math.max(0, Math.round((itemsSum + packaging) * 100) / 100);
}

/* ===================== Handler ===================== */
export async function POST(req: Request) {
  try {
    // 0) Kill-switch
    {
      const { data: cfg, error: cfgErr } = await supabaseAdmin
        .from("restaurant_info")
        .select("ordering_open")
        .eq("id", 1)
        .single();

      if (cfgErr || !cfg) {
        return NextResponse.json({ error: "Konfiguracja sklepu niedostępna." }, { status: 503 });
      }
      if (cfg.ordering_open === false) {
        return NextResponse.json(
          { error: "Zamawianie jest tymczasowo wyłączone. Zapraszamy później!" },
          { status: 503 }
        );
      }
    }

    // --- PROMO: helpery bez joinów i bez RPC ---
    // --- PROMO: helpery bez joinów i bez RPC ---
    type DiscountCode = {
      id: string;
      code: string;
      type: "amount" | "percent";
      value: number;
      active: boolean;
      auto_apply: boolean;
      starts_at: string | null;
      expires_at: string | null;
      min_order: number | null;
      max_uses: number | null;
      per_user_max_uses: number | null;
    };

    async function getDiscountByCode(codeInput: string): Promise<DiscountCode> {
      const { data: dc, error } = await supabaseAdmin
        .from("discount_codes")
        .select(
          "id, code, type, value, active, auto_apply, starts_at, expires_at, min_order, max_uses, per_user_max_uses"
        )
        .ilike("code", codeInput)
        .maybeSingle();

      if (error || !dc) throw new Error("invalid_code");

      const now = new Date().toISOString();
      if (!dc.active) throw new Error("inactive");
      if (dc.starts_at && dc.starts_at > now) throw new Error("not_started");
      if (dc.expires_at && dc.expires_at < now) throw new Error("expired");

      return {
        id: String(dc.id),
        code: String(dc.code),
        type:
          (dc.type === "amount" ? "amount" : "percent") as "amount" | "percent",
        value: Number(dc.value || 0),
        active: !!dc.active,
        auto_apply: !!dc.auto_apply,
        starts_at: dc.starts_at ? String(dc.starts_at) : null,
        expires_at: dc.expires_at ? String(dc.expires_at) : null,
        min_order: dc.min_order == null ? null : Number(dc.min_order),
        max_uses: dc.max_uses == null ? null : Number(dc.max_uses),
        per_user_max_uses:
          dc.per_user_max_uses == null ? null : Number(dc.per_user_max_uses),
      };
    }

    async function getUsageCounts(
      codeId: string,
      userId: string | null,
      emailLower: string | null
    ) {
      const [allQ, userQ, emailLowerQ, emailPlainQ] = await Promise.all([
        supabaseAdmin
          .from("discount_redemptions")
          .select("*", { head: true, count: "exact" })
          .eq("code_id", codeId),
        userId
          ? supabaseAdmin
              .from("discount_redemptions")
              .select("*", { head: true, count: "exact" })
              .eq("code_id", codeId)
              .eq("user_id", userId)
          : Promise.resolve({ count: 0 }),
        emailLower
          ? supabaseAdmin
              .from("discount_redemptions")
              .select("*", { head: true, count: "exact" })
              .eq("code_id", codeId)
              .eq("email_lower", emailLower)
          : Promise.resolve({ count: 0 }),
        emailLower
          ? supabaseAdmin
              .from("discount_redemptions")
              .select("*", { head: true, count: "exact" })
              .eq("code_id", codeId)
              .eq("email", emailLower)
          : Promise.resolve({ count: 0 }),
      ]);

      return {
        all: Number((allQ as any).count || 0),
        byUser: Number((userQ as any).count || 0),
        byEmail:
          Number((emailLowerQ as any).count || 0) +
          Number((emailPlainQ as any).count || 0),
      };
    }

    function computeDiscount(base: number, dc: DiscountCode): number {
      const raw = dc.type === "percent" ? base * (dc.value / 100) : dc.value;
      const clamped = Math.min(Math.max(0, raw), base);
      return Math.round(clamped * 100) / 100;
    }

    // wybór najlepszej auto-promocji (auto_apply = true) dla danego koszyka
    async function getBestAutoDiscount(
      baseTotal: number,
      userId: string | null,
      emailLower: string | null
    ): Promise<{ dc: DiscountCode; amount: number } | null> {
      const { data, error } = await supabaseAdmin
        .from("discount_codes")
        .select(
          "id, code, type, value, active, auto_apply, starts_at, expires_at, min_order, max_uses, per_user_max_uses"
        )
        .eq("auto_apply", true)
        .eq("active", true);

      if (error || !data || !data.length) return null;

      const nowIso = new Date().toISOString();
      let best: { dc: DiscountCode; amount: number } | null = null;

      for (const row of data as any[]) {
        const dc: DiscountCode = {
          id: String(row.id),
          code: String(row.code),
          type: row.type === "amount" ? "amount" : "percent",
          value: Number(row.value || 0),
          active: !!row.active,
          auto_apply: !!row.auto_apply,
          starts_at: row.starts_at ? String(row.starts_at) : null,
          expires_at: row.expires_at ? String(row.expires_at) : null,
          min_order: row.min_order == null ? null : Number(row.min_order),
          max_uses: row.max_uses == null ? null : Number(row.max_uses),
          per_user_max_uses:
            row.per_user_max_uses == null
              ? null
              : Number(row.per_user_max_uses),
        };

        if (!dc.value || dc.value <= 0) continue;
        if (dc.starts_at && dc.starts_at > nowIso) continue;
        if (dc.expires_at && dc.expires_at < nowIso) continue;
        if (dc.min_order != null && baseTotal < Number(dc.min_order)) continue;

        const { all, byUser, byEmail } = await getUsageCounts(
          dc.id,
          userId,
          emailLower
        );

        if (dc.max_uses != null && all >= Number(dc.max_uses)) continue;

        const perUserLimit =
          dc.per_user_max_uses == null ? 1 : Number(dc.per_user_max_uses);

        if (userId && byUser >= perUserLimit) continue;
        if (emailLower && byEmail >= perUserLimit) continue;

        const amount = computeDiscount(baseTotal, dc);
        if (amount <= 0) continue;

        if (!best || amount > best.amount) {
          best = { dc, amount };
        }
      }

      return best;
    }

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

    // 2) Body
    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

    const n = normalizeBody(raw, req);

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

    // 2.1) Subtotal po stronie serwera
    const baseFromItems = calcSubtotalFromItems(n.selected_option, n.itemsArray);
    const discount = 0;

    let deliveryMinRequired = 0;

    // 2.2) Dostawa
    if (n.selected_option === "delivery") {
      if (n.delivery_lat == null || n.delivery_lng == null) {
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

            const originLL = { lat: Number(rest.lat), lng: Number(rest.lng) };
const destLL = { lat: Number(n.delivery_lat), lng: Number(n.delivery_lng) };

// 1) Google (dystans drogowy) → 2) fallback: Haversine (po prostej)
const googleKm = await getDrivingDistanceKm(originLL, destLL).catch(() => null);
const distance_km = googleKm ?? haversineKm(originLL, destLL);



      const zone = (zones as any[])
        .sort((a, b) => Number(a.min_distance_km) - Number(b.min_distance_km))
        .find((z) => distance_km >= Number(z.min_distance_km) && distance_km <= Number(z.max_distance_km));

      if (!zone) {
        return NextResponse.json({ error: "Adres poza zasięgiem dostawy." }, { status: 400 });
      }

      deliveryMinRequired = Number(zone.min_order_value || 0);

      if (baseFromItems < deliveryMinRequired) {
        return NextResponse.json(
          { error: `Minimalna wartość zamówienia dla dostawy to ${deliveryMinRequired.toFixed(2)} zł.` },
          { status: 400 }
        );
      }

            const pricingTypeRaw = String((zone as any).pricing_type ?? "").toLowerCase();
const pricingType =
  pricingTypeRaw === "per_km" || pricingTypeRaw === "flat"
    ? pricingTypeRaw
    : Number(zone.min_distance_km) === 0
    ? "flat"
    : "per_km";


      // Twoje realne kolumny: cost (legacy), cost_fixed, cost_per_km
      const costLegacy = Number((zone as any).cost ?? 0);
      const costFixed = Number((zone as any).cost_fixed ?? 0);
      const costPerKm = Number((zone as any).cost_per_km ?? 0);

      let serverCost = 0;

      if (pricingType === "per_km") {
  const perKmRate = costPerKm > 0 ? costPerKm : costLegacy;

  // liczymy tylko nadwyżkę ponad min_distance_km danej strefy
  const minKm = Number((zone as any).min_distance_km ?? 0);
  const billableKm = Math.max(0, distance_km - minKm);

  serverCost = Math.max(0, costFixed) + Math.max(0, perKmRate) * billableKm;
} else {
  // flat
  serverCost = costFixed > 0 ? costFixed : costLegacy;
}



      if (zone.free_over != null && baseFromItems >= Number(zone.free_over)) {
        serverCost = 0;
      }

      const rounded = Math.max(0, Math.round(serverCost * 100) / 100);

      n.delivery_cost = rounded;
      n.total_price = Math.max(0, Math.round((baseFromItems + rounded - Math.min(discount, baseFromItems + rounded)) * 100) / 100);
    } else {
      n.delivery_cost = 0;
      n.total_price = Math.max(0, Math.round((baseFromItems - Math.min(discount, baseFromItems)) * 100) / 100);
    }

    // 3) Dociągnij produkty
    const productIds = n.itemsArray
      .map((it) => it.product_id ?? it.productId ?? it.id ?? null)
      .filter(Boolean)
      .map((x: any) => String(x));
    const productsMap = await fetchProductsByIds(productIds);

    // 4) Pozycje
    const normalizedItems: NormalizedItem[] = n.itemsArray.map((it) => {
      const key = String(it.product_id ?? it.productId ?? it.id ?? "");
      const db = productsMap.get(key);
      return buildItemFromDbAndOptions(db, it);
    });

    // >>> USTAW MINIMA (przed insertem do orders)
    const baseBeforeDiscount = baseFromItems;
    // <<<

    // 5) Zapis do orders
    const itemsForOrdersColumn = JSON.stringify(normalizedItems);
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        name: n.name,
        phone: n.phone,
        contact_email: n.contact_email,
        order_note: (n as any).order_note ?? null,
        address: n.address,
        street: n.street,
        postal_code: n.postal_code,
        city: n.city,
        flat_number: n.flat_number,
        selected_option: n.selected_option,
        payment_method: n.payment_method,
        payment_status: n.payment_status,
        items: itemsForOrdersColumn,
        total_price: n.total_price,
        delivery_cost: n.delivery_cost,
        base_before_discount: baseBeforeDiscount,     // NOWE
        delivery_min_required: deliveryMinRequired,   // NOWE
        status: n.status,
        client_delivery_time: n.client_delivery_time,
        ["delivery_time"]: n.delivery_time,
        eta: n.eta,
        user: n.user,
        promo_code: null,     // policzymy niżej
        discount_amount: 0,   // policzymy niżej
        legal_accept: n.legal_accept,
      })
      .select("id, selected_option, total_price, name")
      .single();

    if (orderErr || !orderRow) {
      console.error("[orders.create] insert orders error:", orderErr?.message);
      return NextResponse.json({ error: "Nie udało się zapisać zamówienia." }, { status: 500 });
    }

     const newOrderId = orderRow.id;

    const baseTotal = Math.max(
      0,
      Math.round((baseFromItems + (n.delivery_cost ?? 0)) * 100) / 100
    );
    const emailLower = (n.contact_email || "").toLowerCase() || null;

    // Zużycie kodu (z amount)
    let currentTotal = n.total_price;
    let appliedCode: DiscountCode | null = null;
    let appliedDiscount = 0;

    // 5.1) Kod wpisany przez klienta – ma pierwszeństwo nad auto-promocją
    if (n.promo_code) {
      try {
        const dc = await getDiscountByCode(n.promo_code);

        if (dc.min_order != null && baseTotal < Number(dc.min_order)) {
          throw new Error(`min_order:${Number(dc.min_order).toFixed(2)}`);
        }

        const { all, byUser, byEmail } = await getUsageCounts(
          dc.id,
          n.user ?? null,
          emailLower
        );

        if (dc.max_uses != null && all >= Number(dc.max_uses)) {
          throw new Error("limit_exhausted");
        }

        const perUserLimit =
          dc.per_user_max_uses == null ? 1 : Number(dc.per_user_max_uses);

        if (n.user && byUser >= perUserLimit) {
          throw new Error("used_by_user");
        }

        if (emailLower && byEmail >= perUserLimit) {
          throw new Error("used_by_email");
        }

        const applied = computeDiscount(baseTotal, dc);
        const newTotal = Math.max(
          0,
          Math.round((baseTotal - applied) * 100) / 100
        );

        const { error: redErr } = await supabaseAdmin
          .from("discount_redemptions")
          .insert({
            code_id: dc.id,
            code: dc.code,
            order_id: newOrderId,
            user_id: n.user ?? null,
            email_lower: emailLower,
            amount: applied,
          });
        if (redErr) throw redErr;

        const { error: updErr } = await supabaseAdmin
          .from("orders")
          .update({
            promo_code: dc.code,
            discount_amount: applied,
            total_price: newTotal,
          })
          .eq("id", newOrderId);

        if (updErr) {
          await supabaseAdmin
            .from("discount_redemptions")
            .delete()
            .eq("order_id", newOrderId);
          throw updErr;
        }

        currentTotal = newTotal;
        appliedCode = dc;
        appliedDiscount = applied;
      } catch (e: any) {
        console.error("[orders.create] promo apply error:", e?.message || e);
        await supabaseAdmin.from("orders").delete().eq("id", newOrderId);
        return NextResponse.json(
          {
            error:
              "Kod promocyjny jest nieważny lub został już wykorzystany.",
          },
          { status: 400 }
        );
      }
    }

    // 5.2) Auto-promocja (auto_apply) – tylko jeśli brak ręcznie podanego kodu
    if (!appliedCode) {
      try {
        const auto = await getBestAutoDiscount(
          baseTotal,
          (n.user as string | null) ?? null,
          emailLower
        );

        if (auto) {
          const { dc, amount } = auto;
          const newTotal = Math.max(
            0,
            Math.round((baseTotal - amount) * 100) / 100
          );

          const { error: redErr } = await supabaseAdmin
            .from("discount_redemptions")
            .insert({
              code_id: dc.id,
              code: dc.code,
              order_id: newOrderId,
              user_id: n.user ?? null,
              email_lower: emailLower,
              amount,
            });

          if (!redErr) {
            const { error: updErr } = await supabaseAdmin
              .from("orders")
              .update({
                promo_code: dc.code,
                discount_amount: amount,
                total_price: newTotal,
              })
              .eq("id", newOrderId);

            if (!updErr) {
              currentTotal = newTotal;
              appliedCode = dc;
              appliedDiscount = amount;
            } else {
              await supabaseAdmin
                .from("discount_redemptions")
                .delete()
                .eq("order_id", newOrderId);
            }
          }
        }
      } catch (e: any) {
        console.warn(
          "[orders.create] auto promo skipped:",
          e?.message || e
        );
      }
    }

    // 6) order_items
if (Array.isArray(n.itemsArray) && n.itemsArray.length > 0) {
  try {
    // pomocniczo: lookup po nazwie -> id (tylko dla pewnych dopasowań)
    const nameToId = new Map<string, string>();
    for (const [id, row] of productsMap.entries()) {
      const nm =
        (row?.name || row?.title || row?.label || "").toString().trim().toLowerCase();
      if (nm) nameToId.set(nm, String(id));
    }

    const shaped = n.itemsArray.map((rawIt: Any, i: number) => {
      const rawKey = rawIt.product_id ?? rawIt.productId ?? rawIt.id ?? null;
      let pid = rawKey != null ? String(rawKey) : "";

      // fallback po nazwie (gdy brak pid, a nazwa pasuje do produktu z bazy)
      if (!pid) {
        const nm = (rawIt.name || "").toString().trim().toLowerCase();
        if (nm && nameToId.has(nm)) pid = nameToId.get(nm)!;
      }

      // walidacja pid: nie przyjmujemy pustych/„null”/„undefined”
      const validPid =
        !!pid && pid !== "null" && pid !== "undefined";

      // zbuduj linię
      const db = validPid ? productsMap.get(pid) : undefined;
      const ni = buildItemFromDbAndOptions(db as any, rawIt);

      return {
        order_id: newOrderId,
        product_id: validPid ? pid : null, // odfiltrujemy poniżej
        name: ni.name,
        quantity: ni.quantity,
        unit_price: ni.price,
        line_no: i + 1,
      };
    });

    // odrzuć pozycje bez poprawnego product_id (DB ma NOT NULL)
    const filtered = shaped.filter(r => r.product_id !== null);

    if (filtered.length) {
      const { error: oiErr } = await supabaseAdmin
        .from("order_items")
        .insert(filtered);
      if (oiErr) {
        console.warn("[orders.create] order_items insert error:", oiErr.message);
      }
    } else {
      console.warn("[orders.create] order_items: all dropped due to missing product_id");
    }

    // diagnostyka: pokaż które pozycje wypadły (razem z nazwą)
    const dropped = shaped.filter(r => r.product_id === null).map(r => r.name);
    if (dropped.length) {
      console.warn("[orders.create] dropped items (no product_id):", dropped);
    }
  } catch (e: any) {
    console.warn("[orders.create] order_items insert not executed:", e?.message);
  }
}

    // 6.9) Web Push do obsługi (ekran blokady / dymek systemowy)
    try {
      await sendNewOrderPush({
        orderId: newOrderId,
        totalPln: currentTotal,
        selectedOption: n.selected_option,
      });
    } catch (pushErr) {
      console.error("[orders.create] push error:", pushErr);
    }



    // 6.1) e-mail
    try {
      if (n.contact_email) {
        const origin = process.env.APP_BASE_URL || new URL(req.url).origin;
        const url = trackingUrl(origin, String(newOrderId));
        const total =
          typeof currentTotal === "number"
            ? currentTotal.toFixed(2).replace(".", ",")
            : String(currentTotal ?? "0");

        const html = `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 8px">Potwierdzenie zamówienia #${newOrderId}</h2>
            <p style="margin:0 0 16px">Dziękujemy za zamówienie w SISI.</p>
            <p style="margin:16px 0">
              <a href="${url}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">
                Sprawdź status i czas dostawy
              </a>
            </p>
            <p style="margin:8px 0">Kwota: <strong>${total} zł</strong></p>
            <p style="margin:8px 0">Opcja: <strong>${optLabel(orderRow.selected_option)}</strong></p>
            <hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
            <p style="font-size:12px;color:#555;margin:0">
              Akceptacja: Regulamin v${TERMS_VERSION} (<a href="${TERMS_URL}">link</a>),
              Polityka prywatności v${PRIVACY_VERSION} (<a href="${PRIVACY_URL}">link</a>)
            </p>
          </div>
        `;

        await sendEmail({ to: n.contact_email, subject: `SISI • Potwierdzenie zamówienia #${newOrderId}`, html });
      }
    } catch (mailErr) {
      console.error("[orders.create] email to client error:", mailErr);
    }

    // 7) OK
    return NextResponse.json(
      {
        orderId: newOrderId,
        total: currentTotal,
        discount_amount: appliedDiscount,
        promo_code: appliedCode?.code ?? null,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[orders.create] unexpected:", e?.message ?? e);
    return NextResponse.json({ error: "Wystąpił nieoczekiwany błąd." }, { status: 500 });
  }
}
