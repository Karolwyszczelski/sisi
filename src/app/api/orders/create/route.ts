// src/app/api/orders/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toZonedTime } from "date-fns-tz";
import Twilio from "twilio";

/* ============== Supabase admin ============== */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/* ================= Twilio =================== */
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);
const STAFF_PHONE_NUMBER = process.env.STAFF_PHONE_NUMBER || "";
const TWILIO_FROM_NUMBER =
  process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || "";

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
      data.forEach((r: any) => map.set(String(r.id), r as ProductRow));
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

/* ============== Normalizacja BODY ============== */
function normalizeBody(raw: any) {
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
    total_price: num(base?.total_price, 0),
    delivery_cost: num(base?.delivery_cost, null),
    status: (base?.status as any) ?? "placed",
    client_delivery_time: base?.client_delivery_time ?? base?.delivery_time ?? null,
    deliveryTime: null,
    eta: base?.eta ?? null,
    user: base?.user ?? base?.user_id ?? null,
    itemsArray,
  };
}

/* ===================== Handler ===================== */
export async function POST(req: Request) {
  try {
    // 1) Godziny (Europe/Warsaw)
    const nowPl = toZonedTime(new Date(), "Europe/Warsaw");
    const h = nowPl.getHours();
    const m = nowPl.getMinutes();
    const beforeOpen = h < 11 || (h === 11 && m < 30);
    const afterClose = h > 21 || (h === 21 && m > 45);
    if (beforeOpen || afterClose) {
      return NextResponse.json(
        { error: "Zamówienia przyjmujemy w godz. 11:30–21:45." },
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
    const n = normalizeBody(raw);

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
        items: itemsForOrdersColumn,
        total_price: n.total_price,
        delivery_cost: n.delivery_cost,
        status: n.status,
        client_delivery_time: n.client_delivery_time,
        deliveryTime: n.deliveryTime,
        eta: n.eta,
        user: n.user,
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

    // 6) order_items – minimalny zestaw kolumn (bez 'addons')
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
            line_no: i + 1,
          };
        });
        const { error: oiErr } = await supabaseAdmin.from("order_items").insert(shaped);
        if (oiErr) console.warn("[orders.create] order_items insert skipped:", oiErr.message);
      } catch (e: any) {
        console.warn("[orders.create] order_items insert not executed:", e?.message);
      }
    }

    // 7) SMS do personelu (tylko tekst, poprawne E.164)
    try {
      if (TWILIO_FROM_NUMBER && STAFF_PHONE_NUMBER) {
        const to = normalizePhone(STAFF_PHONE_NUMBER);
        const from = TWILIO_FROM_NUMBER;
        if (to && from) {
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
