import { isOrderDispatchAuthorized, orderDispatchToken } from "@/lib/orderDispatchAuth";
import { getSessionAndRole } from "@/lib/serverAuth";
// src/app/api/dotypos/send-order/route.ts
// ==========================================
// Send Order to Dotypos POS System
// ==========================================
//
// This endpoint receives an order ID and sends it to Dotypos POS.
// It uses the POS Actions API to create orders directly on the cash register.
//
// Features (2026 API):
// - Idempotency key for reliable delivery (dedup)
// - Webhook URL for async POS responses
// - Validity timestamp (request expiry)
// - Support for customizations / modifiers
//
// Usage:
// POST /api/dotypos/send-order
// Body: { orderId: "uuid-of-order" }
//
// The endpoint:
// 1. Fetches order from Supabase
// 2. Maps products to Dotypos product IDs using pos_products table
// 3. Sends order via POS Actions API with idempotency-key
// 4. Updates order with dotypos_order_id
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dotypos from "@/lib/dotypos";
import { assessPosTotal, buildSavedPosItems, createPosCatalogMappings, PosMappingError } from "@/lib/savedPosOrder";
import { formatGrosze, readSavedOrderPricing, SavedPricingError } from "@/lib/savedOrderPricing";
import { isOnlinePaymentPending } from "@/lib/orderOperations";
import { DEFAULT_POS_PRODUCT_OVERRIDES } from "@/lib/posProductMappings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Supabase Client
   ============================================================ */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(url, key, { auth: { persistSession: false } });
}

function getWebhookUrl(externalId: string): string | undefined {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  const token = orderDispatchToken(`pos-callback:${externalId}`);
  if (base && token) {
    const url = new URL("/api/dotypos/webhook", base);
    url.searchParams.set("t", token);
    return url.href;
  }
}

interface OrderData {
  id: string;
  items: unknown;
  checkout_price_grosze?: unknown;
  customer_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  contact_email?: string;
  order_type?: "delivery" | "takeaway" | "dine-in";
  selected_option?: string;
  note?: string;
  order_note?: string;
  payment_method?: string;
  payment_status?: string;
  status?: string;
  dotypos_status?: string;
  total_price?: number;
  client_delivery_time?: string | null;
  delivery_time?: string | null;
  address?: string;
  street?: string;
  city?: string;
  flat_number?: string;
  dotypos_order_id?: number;
  dotypos_receipt_id?: number;
}

// Verified active Dotypos tables for online orders (branch 175697700).
// Environment variables can override them if the POS layout changes.
const DEFAULT_ORDER_TYPE_TABLE_IDS: Readonly<Record<string, number>> = {
  delivery: 1595942776188800, // kierowca (type: DELIVERY)
  takeaway: 1297326584999827, // odbior osobisty (type: DOOR)
};

/* ============================================================
   Helper Functions
   ============================================================ */

const APP_TZ = "Europe/Warsaw";

function formatHourPL(input?: string | null): string | null {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;

  if (/^\d{1,2}:\d{2}$/.test(value)) return value;

  const t = Date.parse(value);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleTimeString("pl-PL", {
      timeZone: APP_TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return null;
}

function parseRequestedClientTime(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (value.toLowerCase() === "asap") return "Jak najszybciej";

  const direct = formatHourPL(value);
  if (direct) return direct;

  // Legacy/edge case: JSON string e.g. {"client_delivery_time":"18:30"}
  try {
    const parsed = JSON.parse(value);
    const nested = parsed?.client_delivery_time ?? parsed?.clientDelivery ?? null;
    if (!nested) return null;
    if (String(nested).toLowerCase() === "asap") return "Jak najszybciej";
    return formatHourPL(String(nested));
  } catch {
    return null;
  }
}

/* ============================================================
   POST Handler - Send Order to Dotypos
   ============================================================ */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { orderId, force } = body;
    const isForceResend = force === true;
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }
    
    if (isForceResend || !isOrderDispatchAuthorized(String(orderId), req.headers.get("X-Order-Dispatch"))) {
      const { session, role } = await getSessionAndRole();
      if (!session || (role !== "admin" && role !== "employee")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.log(`[Dotypos Order] Processing order: ${orderId}${isForceResend ? " (force resend)" : ""}`);
    
    const supabase = getSupabase();
    
    // 1. Fetch order from database
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .limit(1);
    
    if (orderError || !orders || orders.length === 0) {
      console.error("[Dotypos Order] Order not found:", orderError);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }
    
    const order: OrderData = orders[0];
    if (order.status === "cancelled") {
      return NextResponse.json({ error: "Anulowane zamówienie nie może trafić do POS." }, { status: 409 });
    }

    if (isOnlinePaymentPending(order.payment_method, order.payment_status)) {
      console.warn(`[Dotypos Order] Online payment not confirmed; skipping POS send for order ${orderId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Online payment not confirmed",
          message: "Zamowienie online nie jest jeszcze oplacone.",
        },
        { status: 409 }
      );
    }
    
    // Check if already sent to Dotypos (unless force resend was requested)
    if (order.dotypos_order_id && ["sent", "confirmed"].includes(order.dotypos_status ?? "") && !isForceResend) {
      console.log(`[Dotypos Order] Order already sent: ${order.dotypos_order_id}`);
      return NextResponse.json({
        success: true,
        already_sent: true,
        posRecorded: true,
        dotypos_order_id: order.dotypos_order_id,
      });
    }

    if (order.dotypos_order_id && isForceResend) {
      console.log(`[Dotypos Order] Force resend requested for order ${orderId} (existing Dotypos ID: ${order.dotypos_order_id})`);
    }
    
    if (["price_mismatch", "items_rejected"].includes(order.dotypos_status ?? "")) {
      return NextResponse.json({ code: "POS_PRICE_MISMATCH", error: "Kwota zgłoszona przez POS różni się od wyceny." }, { status: 409 });
    }

    const pricing = readSavedOrderPricing(order);
    const { quote } = pricing;
    const needLegacyCategories = pricing.pricedItems.some(({ price }) => price.addons.some((addon) => addon.category == null));
    const [catalog, overrides, legacyAddons] = await Promise.all([
      supabase.from("pos_products").select("pos_id,name").eq("deleted", false),
      supabase.from("pos_product_overrides").select("internal_product_id,pos_id"),
      needLegacyCategories ? supabase.from("addons").select("name,category") : Promise.resolve({ data: [], error: null }),
    ]);
    if (catalog.error || !catalog.data?.length || overrides.error || legacyAddons.error) {
      return NextResponse.json({ error: "Katalog mapowań POS jest niedostępny." }, { status: 503 });
    }

    const overrideMap = new Map(Object.entries(DEFAULT_POS_PRODUCT_OVERRIDES));
    for (const row of overrides.data ?? []) {
      overrideMap.set(String(row.internal_product_id), Number(row.pos_id));
    }
    const addonCategories = new Map((legacyAddons.data ?? []).map(({ name, category }) => [name.trim().toLowerCase(), category]));
    const mappings = createPosCatalogMappings(catalog.data, overrideMap, addonCategories, {
      packaging: process.env.DOTYPOS_PACKAGING_PRODUCT_ID,
      delivery: process.env.DOTYPOS_DELIVERY_PRODUCT_ID,
      deposit: process.env.DOTYPOS_DEPOSIT_PRODUCT_ID,
      extraMeat: process.env.DOTYPOS_EXTRA_MEAT_PRODUCT_ID,
      ingredient: process.env.DOTYPOS_ADDON_PRODUCT_ID,
      sauce: process.env.DOTYPOS_SAUCE_PRODUCT_ID,
      premium: process.env.DOTYPOS_PREMIUM_ADDON_PRODUCT_ID,
    }, order.city);
    const dotyposItems = buildSavedPosItems(pricing, mappings);
    const selectedOpt = order.selected_option || order.order_type || "local";

    // 5. Build customer info
    const customerName = order.customer_name || order.name || undefined;
    const customerEmail = order.email || order.contact_email || undefined;
    const customer = {
      name: customerName,
      phone: order.phone || undefined,
      email: customerEmail,
    };
    
    // 6. Build order note (include customer info for POS visibility)
    // NOTE: Order type (ODBIOR OSOBISTY / DOSTAWA) is NOT in the note — it's handled
    // by the take-away flag which Dotypos displays below S-number on the bon.
    // This way it appears in the right place (under order number, not at the top).
    const orderNoteParts: string[] = [];
    // Metoda płatności na samej górze bonu
    if (order.payment_method) {
      orderNoteParts.push(`Płatność: ${order.payment_method}`);
    }

    // Requested client time (visible on kitchen/receipt print)
    const requestedClientTime = parseRequestedClientTime(order.client_delivery_time);
    if (requestedClientTime) {
      orderNoteParts.push(`Czas klienta: ${requestedClientTime}`);
    }

    // Internal accepted ETA (when available, e.g. reprint after acceptance)
    const acceptedEta = formatHourPL(order.delivery_time);
    if (acceptedEta) {
      orderNoteParts.push(`Realizacja: ${acceptedEta}`);
    }

    if (customerName) {
      orderNoteParts.push(`Klient: ${customerName}`);
    }
    if (order.phone) {
      orderNoteParts.push(`Tel: ${order.phone}`);
    }
    // Add delivery address to note
    if (selectedOpt === "delivery") {
      const addrParts = [order.street || order.address, order.flat_number ? `m. ${order.flat_number}` : null, order.city].filter(Boolean);
      if (addrParts.length) {
        orderNoteParts.push(`Adres: ${addrParts.join(", ")}`);
      }
      if (quote.delivery) orderNoteParts.push(`Dostawa: ${formatGrosze(quote.delivery)}`);
    }
    if (order.order_note) {
      orderNoteParts.push(`Uwagi: ${order.order_note}`);
    }
    if (quote.discount) orderNoteParts.push(`Rabat: ${formatGrosze(quote.discount)}`);
    const isPaid = order.payment_method === "Online" && order.payment_status === "paid";

    // Determine takeaway flag from selected_option (more reliable than order_type)
    const isTakeAway = (order.selected_option || order.order_type) !== "local" &&
                       (order.selected_option || order.order_type) !== "dine-in";
    
    // 7.7. Assign the verified Dotypos table for the order type.
    // Do not search the paginated table list by name here: the first page can
    // contain hidden duplicates (e.g. "kierowca 2") before the active table.
    let tableId: number | undefined;
    const envTableId =
      selectedOpt === "delivery"
        ? process.env.DOTYPOS_TABLE_ID_DELIVERY
        : selectedOpt === "takeaway"
          ? process.env.DOTYPOS_TABLE_ID_TAKEAWAY
          : selectedOpt === "local"
            ? process.env.DOTYPOS_TABLE_ID_LOCAL
            : undefined;

    if (envTableId) {
      tableId = Number(envTableId);
    } else {
      tableId = DEFAULT_ORDER_TYPE_TABLE_IDS[selectedOpt];
    }

    if (tableId) {
      console.log(`[Dotypos Order] Assigned table ID ${tableId} for ${selectedOpt}`);
    }
    
    // 8. Send to Dotypos
    // We use order/create (createDraftOrder) for ALL orders:
    // - No receipt is printed (paragon) — cashier will issue it manually when ready
    // - Kitchen/bon printers still print based on POS configuration
    // - For paid online orders, the note includes payment info
    // Ensure tableId is a valid number
    if (tableId !== undefined && (isNaN(tableId) || tableId <= 0)) {
      console.warn(`[Dotypos Order] Invalid tableId: ${tableId}, resetting`);
      tableId = undefined;
    }
    console.log(`[Dotypos Order] Sending ${dotyposItems.length} items, paid=${isPaid}, tableId=${tableId ?? "none"} (type: ${typeof tableId})`);
    
    if (isPaid) {
      orderNoteParts.push("OPLACONE ONLINE");
    }
    
    const externalId = isForceResend
      ? `${orderId}:reprint:${Date.now()}`
      : orderId;

    const webhookUrl = getWebhookUrl(String(externalId));
    if (!webhookUrl) return NextResponse.json({ error: "Brak konfiguracji potwierdzeń POS." }, { status: 503 });

    const { data: mayDispatch, error: dispatchError } = await supabase.rpc("sisi_begin_pos_dispatch", { order_id: orderId, reprint: isForceResend });
    if (dispatchError) return NextResponse.json({ error: "Nie udało się rozpocząć wysyłki zamówienia." }, { status: 500 });
    if (!mayDispatch) return NextResponse.json({ error: "Stan zamówienia blokuje wysyłkę do POS." }, { status: 409 });

    const response = await dotypos.createDraftOrder({
      externalId,
      items: dotyposItems,
      customer,
      note: orderNoteParts.join(" | "),
      takeAway: isTakeAway,
      tableId,
      webhookUrl,
    });
    
    console.log("[Dotypos Order] Response code:", response.code);
    
    // 9. Update order with Dotypos reference
    const dotyposOrderId = response.order?.id || response.orderId;
    const dotyposReceiptId = response.receiptId;
    const accepted = response.code === 0 || response.status === "ok";
    const dotyposStatus = accepted
      ? assessPosTotal(quote.total, response.order?.["price-total"], response.order?.currency, response["pass-through-errors"])
      : "awaiting_price";
    
    const rejection = dotyposStatus === "price_mismatch" ? "Kwota POS różni się od zapisanej wyceny."
      : dotyposStatus === "items_rejected" ? "Dotypos zgłosił błąd przetwarzania pozycji." : null;
    let posRecorded = false;
    if (accepted && dotyposOrderId && (!isForceResend || !order.dotypos_order_id)) {
      const { data: recorded } = await supabase
        .from("orders")
        .update({
          dotypos_order_id: dotyposOrderId,
          dotypos_receipt_id: dotyposReceiptId,
          dotypos_sent_at: new Date().toISOString(),
          dotypos_status: dotyposStatus,
          dotypos_error: rejection,
        })
        .eq("id", orderId)
        .or("dotypos_status.is.null,dotypos_status.not.in.(confirmed,price_mismatch,items_rejected)").select("id").maybeSingle();
      posRecorded = Boolean(recorded) && dotyposStatus === "confirmed";
    }
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: accepted || response.code == null,
      ...(rejection && { success: false, error: rejection,
        code: dotyposStatus === "price_mismatch" ? "POS_PRICE_MISMATCH" : "POS_ITEMS_REJECTED" }),
      orderId,
      forceResend: isForceResend,
      posRecorded,
      dotypos: {
        orderId: dotyposOrderId,
        receiptId: dotyposReceiptId,
        status: dotyposStatus,
        code: response.code,
        passThruErrors: response["pass-through-errors"],
      },
      itemsCount: dotyposItems.length,
      duration,
    });
    
  } catch (error) {
    if (error instanceof PosMappingError) {
      return NextResponse.json({ code: "POS_MAPPING_INCOMPLETE", error: `Brak mapowania POS: ${error.missing.join(", ")}.`, missing: error.missing }, { status: 409 });
    }
    if (error instanceof SavedPricingError) {
      return NextResponse.json({ code: "POS_QUOTE_INVALID", error: "Brak kompletnej lub spójnej wyceny zamówienia." }, { status: 409 });
    }
    console.error("[Dotypos Order] POS dispatch failed");
    
    // Handle specific POS errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    let statusCode = 500;
    let userMessage = "Failed to send order to Dotypos";
    
    if (errorMessage.includes("404")) {
      // POS device didn't respond within 21 seconds (sync mode timeout)
      userMessage = "Kasa POS nie odpowiada. Sprawdź czy urządzenie jest włączone.";
      statusCode = 504; // Gateway Timeout
    } else if (errorMessage.includes("429")) {
      // Rate limit — another request is in progress (sync mode)
      userMessage = "Kasa POS przetwarza inne zamówienie. Spróbuj ponownie za chwilę.";
      statusCode = 429;
    }
    
    return NextResponse.json(
      {
        error: userMessage,
        message: errorMessage,
      },
      { status: statusCode }
    );
  }
}

/* ============================================================
   GET Handler - Check order status
   ============================================================ */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  
  if (!orderId) {
    return NextResponse.json(
      { error: "Missing orderId parameter" },
      { status: 400 }
    );
  }
  
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from("orders")
      .select("id, dotypos_order_id, dotypos_receipt_id, dotypos_sent_at")
      .eq("id", orderId)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      orderId: data.id,
      sentToDotypos: !!data.dotypos_order_id,
      dotyposOrderId: data.dotypos_order_id,
      dotyposReceiptId: data.dotypos_receipt_id,
      sentAt: data.dotypos_sent_at,
    });
    
  } catch {
    return NextResponse.json(
      { error: "Failed to check order status" },
      { status: 500 }
    );
  }
}
