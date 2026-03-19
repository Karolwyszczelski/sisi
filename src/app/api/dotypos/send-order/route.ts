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
import dotypos, { DotyposOrderItem } from "@/lib/dotypos";

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

/**
 * Get webhook URL for POS action responses (ASYNC mode).
 * 
 * IMPORTANT: When webhook URL is provided in POS action request:
 * - The HTTP response from API is minimal (just acknowledgment)
 * - Full response comes later via webhook callback
 * - This means we can't read order data from the direct response
 * 
 * When webhook is NOT provided (SYNC mode / "default webhook"):
 * - API waits up to 21 seconds for POS to respond
 * - Full response is returned in HTTP body
 * - Rate limited to 1 concurrent request per userId/clientId/cloudId/branchId
 * 
 * For a burger restaurant, SYNC mode is preferred — we get immediate
 * feedback and the rate limit is not a problem.
 * The /api/dotypos/webhook endpoint still works for entity change
 * notifications (PRODUCT, ORDERBEAN, etc.) registered via webhooks API.
 */
function getWebhookUrl(): string | undefined {
  // Return undefined to use SYNC mode (default webhook)
  // Set DOTYPOS_USE_ASYNC_WEBHOOK=true to use async webhook mode
  if (process.env.DOTYPOS_USE_ASYNC_WEBHOOK === "true") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sisiciechanow.pl";
    return `${appUrl}/api/dotypos/webhook`;
  }
  return undefined;
}

/* ============================================================
   Types
   ============================================================ */

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  addons?: string[];
  note?: string;
}

interface OrderData {
  id: string;
  items: string | OrderItem[];
  customer_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  contact_email?: string;
  order_type?: "delivery" | "takeaway" | "dine-in";
  selected_option?: string;
  note?: string;
  order_note?: string;
  payment_status?: string;
  total_price?: number;
  base_before_discount?: number;
  discount_amount?: number;
  delivery_cost?: number;
  promo_code?: string;
  address?: string;
  street?: string;
  city?: string;
  flat_number?: string;
  dotypos_order_id?: number;
  dotypos_receipt_id?: number;
}

interface PosProduct {
  pos_id: number;
  name: string;
  price?: number;
}

/* ============================================================
   Helper Functions
   ============================================================ */

/**
 * Normalize product name for matching
 * Removes extra spaces, converts to lowercase, keeps Unicode letters (Polish chars)
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, ""); // keep letters (incl. Polish), digits, spaces
}

/**
 * Find best matching POS product for an order item
 * Uses fuzzy matching if exact match not found
 */
function findPosProduct(
  itemName: string,
  posProducts: PosProduct[]
): PosProduct | undefined {
  const normalizedItemName = normalizeProductName(itemName);
  
  // 1. Try exact match
  let match = posProducts.find(
    (p) => normalizeProductName(p.name) === normalizedItemName
  );
  if (match) return match;
  
  // 2. Try contains match (item name in POS name or vice versa)
  match = posProducts.find(
    (p) =>
      normalizeProductName(p.name).includes(normalizedItemName) ||
      normalizedItemName.includes(normalizeProductName(p.name))
  );
  if (match) return match;
  
  // 3. Try partial word match (at least 3 chars)
  const itemWords = normalizedItemName.split(" ").filter((w) => w.length >= 3);
  match = posProducts.find((p) => {
    const posWords = normalizeProductName(p.name).split(" ");
    return itemWords.some((w) => posWords.some((pw) => pw.includes(w)));
  });
  
  return match;
}

/**
 * Build item note with addons and special instructions
 */
function buildItemNote(item: OrderItem): string | undefined {
  const parts: string[] = [];
  
  if (item.addons && item.addons.length > 0) {
    parts.push(`Dodatki: ${item.addons.join(", ")}`);
  }
  
  if (item.note) {
    parts.push(item.note);
  }
  
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

/* ============================================================
   POST Handler - Send Order to Dotypos
   ============================================================ */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { orderId } = body;
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }
    
    console.log(`[Dotypos Order] Processing order: ${orderId}`);
    
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
    
    // Check if already sent to Dotypos
    if (order.dotypos_order_id) {
      console.log(`[Dotypos Order] Order already sent: ${order.dotypos_order_id}`);
      return NextResponse.json({
        success: true,
        already_sent: true,
        dotypos_order_id: order.dotypos_order_id,
      });
    }
    
    // 2. Parse items
    let items: OrderItem[];
    if (typeof order.items === "string") {
      try {
        items = JSON.parse(order.items);
      } catch {
        console.error("[Dotypos Order] Failed to parse items JSON");
        return NextResponse.json(
          { error: "Invalid items format" },
          { status: 400 }
        );
      }
    } else {
      items = order.items;
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items in order" },
        { status: 400 }
      );
    }
    
    // 3. Fetch POS product mappings
    const { data: posProducts } = await supabase
      .from("pos_products")
      .select("pos_id, name, price")
      .eq("deleted", false);
    
    if (!posProducts || posProducts.length === 0) {
      console.error("[Dotypos Order] No POS products found. Run sync first.");
      return NextResponse.json(
        { 
          error: "No POS products available",
          message: "Please run product sync first: GET /api/dotypos/sync-products",
        },
        { status: 503 }
      );
    }
    
    // 3.5. Find special POS products for packaging and delivery
    const findSpecialProduct = (keywords: string[]): PosProduct | undefined => {
      for (const kw of keywords) {
        const found = posProducts.find(p => 
          normalizeProductName(p.name).includes(kw)
        );
        if (found) return found;
      }
      return undefined;
    };
    const packagingProduct = findSpecialProduct(["pakowanie na wynos", "pakowanie", "opakowanie", "packaging"]);
    const deliveryProduct = findSpecialProduct(["dowóz", "dowoz", "dostawa", "transport", "delivery"]);
    
    // 4. Map order items to Dotypos items
    const dotyposItems: DotyposOrderItem[] = [];
    const unmappedItems: string[] = [];
    
    for (const item of items) {
      const posProduct = findPosProduct(item.name, posProducts);
      
      if (posProduct) {
        dotyposItems.push({
          id: posProduct.pos_id,
          qty: item.quantity || 1,
          note: buildItemNote(item),
          // Don't override price - use POS price
        });
      } else {
        unmappedItems.push(item.name);
        console.warn(`[Dotypos Order] Unmapped product: ${item.name}`);
      }
    }
    
    // If all items are unmapped, fail
    if (dotyposItems.length === 0) {
      return NextResponse.json(
        {
          error: "No products could be mapped to POS",
          unmapped: unmappedItems,
          message: "Please sync products or add manual mappings",
        },
        { status: 400 }
      );
    }
    
    // 4.5. Add packaging cost as order item
    const selectedOpt = order.selected_option || order.order_type || "local";
    const needsPackaging = selectedOpt === "delivery" || selectedOpt === "takeaway";
    
    if (needsPackaging && packagingProduct) {
      dotyposItems.push({
        id: packagingProduct.pos_id,
        qty: 1,
        note: "Opakowanie",
        // Use POS price (set in Dotypos for the packaging product)
      });
      console.log(`[Dotypos Order] Added packaging: POS product "${packagingProduct.name}" (id: ${packagingProduct.pos_id})`);
    } else if (needsPackaging && !packagingProduct) {
      console.warn('[Dotypos Order] No "Opakowanie" product found in POS. Create it in Dotypos to include packaging cost.');
    }
    
    // 4.6. Add delivery cost as order item
    if (selectedOpt === "delivery" && order.delivery_cost && order.delivery_cost > 0) {
      if (deliveryProduct) {
        dotyposItems.push({
          id: deliveryProduct.pos_id,
          qty: 1,
          "manual-price": order.delivery_cost, // Override with actual calculated delivery cost
          note: "Dostawa",
        });
        console.log(`[Dotypos Order] Added delivery: ${order.delivery_cost} zł (POS product "${deliveryProduct.name}", id: ${deliveryProduct.pos_id})`);
      } else {
        console.warn(`[Dotypos Order] No "Dostawa" product found in POS. Create it in Dotypos to include delivery cost. Delivery: ${order.delivery_cost} zł`);
      }
    }
    
    // 5. Build customer info
    const customerName = order.customer_name || order.name || undefined;
    const customerEmail = order.email || order.contact_email || undefined;
    const customer = {
      name: customerName,
      phone: order.phone || undefined,
      email: customerEmail,
    };
    
    // 6. Build order note (include customer info for POS visibility)
    const orderNoteParts: string[] = [];
    if (selectedOpt === "delivery") {
      orderNoteParts.push("🚗 DOSTAWA");
    } else if (selectedOpt === "takeaway") {
      orderNoteParts.push("📦 NA WYNOS");
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
      if (order.delivery_cost) {
        orderNoteParts.push(`Dostawa: ${order.delivery_cost.toFixed(2)} zł`);
      }
    }
    if (order.order_note) {
      orderNoteParts.push(`Uwagi: ${order.order_note}`);
    }
    if (unmappedItems.length > 0) {
      orderNoteParts.push(`⚠️ Niezmapowane: ${unmappedItems.join(", ")}`);
    }
    
    // 7. Determine if order is paid online
    const isPaid = order.payment_status === "paid" || 
                   order.payment_status === "completed";
    
    // 7.5. Calculate discount percent for Dotypos
    // Dotypos supports discount-percent (e.g. 20 = 20%) on the whole order.
    // We calculate it from base_before_discount and discount_amount.
    let discountPercent = 0;
    if (order.discount_amount && order.discount_amount > 0 && order.base_before_discount && order.base_before_discount > 0) {
      discountPercent = Math.round((order.discount_amount / order.base_before_discount) * 100 * 100) / 100;
      console.log(`[Dotypos Order] Discount: ${order.discount_amount} zł / ${order.base_before_discount} zł = ${discountPercent}% (code: ${order.promo_code || "auto"})`);
    }
    
    // Determine takeaway flag from selected_option (more reliable than order_type)
    const isTakeAway = (order.selected_option || order.order_type) !== "local" &&
                       (order.selected_option || order.order_type) !== "dine-in";
    
    // 8. Send to Dotypos
    // We use order/create (createDraftOrder) for ALL orders:
    // - No receipt is printed (paragon) — cashier will issue it manually when ready
    // - Kitchen/bon printers still print based on POS configuration
    // - For paid online orders, the note includes payment info
    console.log(`[Dotypos Order] Sending ${dotyposItems.length} items, paid=${isPaid}, discount=${discountPercent}%`);
    
    if (isPaid) {
      orderNoteParts.push("✅ OPŁACONE ONLINE");
    }
    
    const response = await dotypos.createDraftOrder({
      externalId: orderId,
      items: dotyposItems,
      customer,
      note: orderNoteParts.join(" | "),
      takeAway: isTakeAway,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      webhookUrl: getWebhookUrl(),
    });
    
    console.log("[Dotypos Order] Response:", response);
    
    // 9. Update order with Dotypos reference
    const dotyposOrderId = response.order?.id || response.orderId;
    const dotyposReceiptId = response.receiptId;
    const dotyposStatus = response.code === 0 ? "sent" : (response.status || "unknown");
    
    if (dotyposOrderId) {
      await supabase
        .from("orders")
        .update({
          dotypos_order_id: dotyposOrderId,
          dotypos_receipt_id: dotyposReceiptId,
          dotypos_sent_at: new Date().toISOString(),
          dotypos_status: dotyposStatus,
        })
        .eq("id", orderId);
    }
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: response.code === 0 || response.status === "ok",
      orderId,
      dotypos: {
        orderId: dotyposOrderId,
        receiptId: dotyposReceiptId,
        status: dotyposStatus,
        code: response.code,
        passThruErrors: response["pass-through-errors"],
      },
      itemsCount: dotyposItems.length,
      unmappedItems: unmappedItems.length > 0 ? unmappedItems : undefined,
      duration,
    });
    
  } catch (error) {
    console.error("[Dotypos Order] Error:", error);
    
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
