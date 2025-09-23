// src/app/api/orders/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toZonedTime } from "date-fns-tz";
import Twilio from "twilio";

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

/* ================= Twilio =================== */
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const STAFF_PHONE_NUMBER = process.env.STAFF_PHONE_NUMBER || "";
const TWILIO_FROM_NUMBER =
  process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || "";
const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

/* ====== Wersje/Linki regulaminów (do maili) ====== */
const TERMS_VERSION = process.env.TERMS_VERSION || "2025-01";
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || "2025-01";
const TERMS_URL =
  process.env.TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL =
  process.env.TERMS_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";

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

const optLabel = (v?: string) =>
  v === "delivery" ? "DOSTAWA" : v === "takeaway" ? "NA WYNOS" : "NA MIEJSCU";

const normalizePhone = (phone?: string | null) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 9) return "+48" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (!String(phone).startsWith("+") && digits.length > 9) return "+" + digits;
  return String(phone);
};

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
  const price = (num(raw.price ?? raw.unit_price ?? raw.total_price ?? 0, 0) ?? 0) as number;

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
    phone: normalizePhone(base?.phone ?? null),
    contact_email: base?.contact_email ?? base?.email ?? null,
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
    promo_code: base?.promo_code ?? null,
    discount_amount: num(base?.discount_amount, 0) ?? 0,
    delivery_cost: num(base?.delivery_cost, null),
    delivery_lat: num(base?.delivery_lat ?? base?.lat, null),
    delivery_lng: num(base?.delivery_lng ?? base?.lng, null),
    status: sanitizeOrderStatus(base?.status),
    client_delivery_time: base?.client_delivery_time ?? base?.delivery_time ?? null,
    deliveryTime: null,
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
    const basePrice = Number(it.price ?? it.unit_price ?? 0) || 0;
    const addons = Array.isArray(it?.options?.addons) ? it.options.addons : (Array.isArray(it.addons) ? it.addons : []);
    const addonsCost = (addons ?? []).reduce((s: number, a: any) => s + (SAUCES.includes(String(a)) ? 3 : 4), 0);
    const extraMeat = Number(it?.options?.extraMeatCount ?? 0) || 0;
    const extraMeatCost = extraMeat * 10;
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
      const headerToken =
        req.headers.get("cf-turnstile-response") ||
        req.headers.get("CF-Turnstile-Response") ||
        req.headers.get("x-turnstile-token");
      const token = raw?.turnstileToken || raw?.token || raw?.cf_turnstile_token || headerToken;

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
        const jr = await ver.json();
        if (!jr?.success) {
          console.error("[turnstile.verify] fail", jr?.["error-codes"] || jr);
          return NextResponse.json({ error: "Nieudana weryfikacja formularza." }, { status: 400 });
        }
      } catch (e) {
        console.error("[turnstile.verify] error", e);
        return NextResponse.json({ error: "Błąd weryfikacji formularza." }, { status: 400 });
      }
    }

    const n = normalizeBody(raw, req);

    // wymagamy e-maila i pozycji
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
    const discount = Math.max(0, Number(n.discount_amount || 0));

    // 2.2) Dostawa: wymagaj współrzędnych, dopasuj strefę z <= max, policz koszt
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

      const distance_km = haversineKm(
        { lat: Number(rest.lat), lng: Number(rest.lng) },
        { lat: Number(n.delivery_lat), lng: Number(n.delivery_lng) }
      );

      const zone = (zones as any[])
        .sort((a, b) => Number(a.min_distance_km) - Number(b.min_distance_km))
        .find((z) => distance_km >= Number(z.min_distance_km) && distance_km <= Number(z.max_distance_km));

      if (!zone) {
        return NextResponse.json({ error: "Adres poza zasięgiem dostawy." }, { status: 400 });
      }

      // Minimum zamówienia dla dostawy z DB (np. 40 zł)
      if (baseFromItems < Number(zone.min_order_value || 0)) {
        return NextResponse.json(
          { error: `Minimalna wartość zamówienia dla dostawy to ${Number(zone.min_order_value).toFixed(2)} zł.` },
          { status: 400 }
        );
      }

      const pricingType: string =
        (zone.pricing_type as string) ?? (Number(zone.min_distance_km) === 0 ? "flat" : "per_km");

      const perKmRate = Number((zone as any).cost_per_km ?? (zone as any).per_km ?? (zone as any).zl_per_km ?? zone.cost ?? 0);
      const flatCost  = Number((zone as any).flat_cost ?? (zone as any).stala ?? zone.cost ?? 0);

      let serverCost = pricingType === "per_km" ? perKmRate * distance_km : flatCost;

      if (zone.free_over != null && baseFromItems >= Number(zone.free_over)) {
        serverCost = 0;
      }

      const rounded = Math.max(0, Math.round(serverCost * 100) / 100);

      n.delivery_cost = rounded;
      n.total_price = Math.max(0, Math.round((baseFromItems + rounded - Math.min(discount, baseFromItems + rounded)) * 100) / 100);
    } else {
      // brak dostawy
      n.delivery_cost = 0;
      n.total_price = Math.max(0, Math.round((baseFromItems - Math.min(discount, baseFromItems)) * 100) / 100);
    }

    // 3) Dociągnij produkty po STRING id
    const productIds = n.itemsArray
      .map((it) => it.product_id ?? it.productId ?? it.id ?? null)
      .filter(Boolean)
      .map((x: any) => String(x));
    const productsMap = await fetchProductsByIds(productIds);

    // 4) Zbuduj pozycje
    const normalizedItems: NormalizedItem[] = n.itemsArray.map((it) => {
      const key = String(it.product_id ?? it.productId ?? it.id ?? "");
      const db = productsMap.get(key);
      return buildItemFromDbAndOptions(db, it);
    });

    // 5) Zapis do orders
    const itemsForOrdersColumn = JSON.stringify(normalizedItems);
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        name: n.name,
        phone: n.phone,
        contact_email: n.contact_email,
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
        status: n.status,
        client_delivery_time: n.client_delivery_time,
        deliveryTime: n.deliveryTime,
        eta: n.eta,
        user: n.user,
        promo_code: n.promo_code,
        discount_amount: n.discount_amount,
        legal_accept: n.legal_accept,
      })
      .select("id, selected_option, total_price, name")
      .single();

    if (orderErr || !orderRow) {
      console.error("[orders.create] insert orders error:", orderErr?.message);
      return NextResponse.json(
        { error: "Nie udało się zapisać zamówienia." },
        { status: 500 }
      );
    }

    const newOrderId = orderRow.id;

    // 6) order_items
    if (Array.isArray(n.itemsArray) && n.itemsArray.length > 0) {
      try {
        const shaped = n.itemsArray.map((rawIt: Any, i: number) => {
          const key = String(rawIt.product_id ?? rawIt.productId ?? rawIt.id ?? "");
          const db = productsMap.get(key);
          const ni = buildItemFromDbAndOptions(db, rawIt);
          return {
            order_id: newOrderId,
            product_id: key || null,
            name: ni.name,
            quantity: ni.quantity,
            unit_price: ni.price,
            line_no: i + 1, // kolumna może być dodana przez IF NOT EXISTS
          };
        });
        const { error: oiErr } = await supabaseAdmin.from("order_items").insert(shaped);
        if (oiErr) console.warn("[orders.create] order_items insert skipped:", oiErr.message);
      } catch (e: any) {
        console.warn("[orders.create] order_items insert not executed:", e?.message);
      }
    }

    // 6.1) E-mail do klienta
    try {
      if (n.contact_email) {
        const origin = process.env.APP_BASE_URL || new URL(req.url).origin;
        const url = trackingUrl(origin, String(newOrderId));

        const total =
          typeof orderRow.total_price === "number"
            ? orderRow.total_price.toFixed(2).replace(".", ",")
            : String(orderRow.total_price ?? "0");

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

        await sendEmail({
          to: n.contact_email,
          subject: `SISI • Potwierdzenie zamówienia #${newOrderId}`,
          html,
        });
      }
    } catch (mailErr) {
      console.error("[orders.create] email to client error:", mailErr);
    }

    // 7) SMS do personelu
    try {
      if (twilioClient && TWILIO_FROM_NUMBER && STAFF_PHONE_NUMBER) {
        const to = normalizePhone(STAFF_PHONE_NUMBER);
        const from = TWILIO_FROM_NUMBER;
        if (to && from) {
          // podgląd nazw z pozycji
          const previewNames = normalizedItems.slice(0, 3).map((x) => x.name).join(", ");
          const more = normalizedItems.length > 3 ? ` +${normalizedItems.length - 3}` : "";
          const total =
            typeof orderRow.total_price === "number"
              ? orderRow.total_price.toFixed(2).replace(".", ",")
              : String(orderRow.total_price ?? "0");
          const body =
            `Nowe zamówienie #${newOrderId}\n` +
            `Typ: ${optLabel(orderRow.selected_option)}\n` +
            `Klient: ${orderRow.name ?? "—"}\n` +
            `Kwota: ${total} zł\n` +
            (previewNames ? `Pozycje: ${previewNames}${more}` : "");
          await twilioClient.messages.create({ to, from, body });
        }
      }
    } catch (smsErr) {
      console.error("[orders.create] SMS staff error:", smsErr);
    }

    // 8) OK
    return NextResponse.json({ orderId: newOrderId }, { status: 201 });
  } catch (e: any) {
    console.error("[orders.create] unexpected:", e?.message ?? e);
    return NextResponse.json({ error: "Wystąpił nieoczekiwany błąd." }, { status: 500 });
  }
}
