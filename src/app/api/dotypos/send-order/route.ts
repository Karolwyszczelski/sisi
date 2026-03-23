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
import dotypos, { DotyposOrderItem, DotyposTable, getTables } from "@/lib/dotypos";

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
  payment_method?: string;
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
 * Normalize product name for matching (basic — used by findSpecialProduct)
 * Removes extra spaces, converts to lowercase, keeps Unicode letters (Polish chars)
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, ""); // keep letters (incl. Polish), digits, spaces
}

/** Strip Polish diacritics → ASCII equivalents for fuzzy comparison */
function stripDiacritics(s: string): string {
  return s
    .replace(/[ąĄ]/g, (c) => (c === "ą" ? "a" : "A"))
    .replace(/[ćĆ]/g, (c) => (c === "ć" ? "c" : "C"))
    .replace(/[ęĘ]/g, (c) => (c === "ę" ? "e" : "E"))
    .replace(/[łŁ]/g, (c) => (c === "ł" ? "l" : "L"))
    .replace(/[ńŃ]/g, (c) => (c === "ń" ? "n" : "N"))
    .replace(/[óÓ]/g, (c) => (c === "ó" ? "o" : "O"))
    .replace(/[śŚ]/g, (c) => (c === "ś" ? "s" : "S"))
    .replace(/[źŹ]/g, (c) => (c === "ź" ? "z" : "Z"))
    .replace(/[żŻ]/g, (c) => (c === "ż" ? "z" : "Z"));
}

/** Strip leading number prefix like "1. ", "11. " from POS product names */
function stripNumberPrefix(name: string): string {
  return name.replace(/^\d+\.\s*/, "");
}

/** Full normalization for matching: strip prefix → lowercase → remove punctuation → strip diacritics */
function normalizeForMatching(name: string): string {
  return stripDiacritics(normalizeProductName(stripNumberPrefix(name)));
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Check if two words are a "fuzzy match".
 *   1. Exact equality
 *   2. Substring — only when shorter word is ≥75 % of longer word length
 *      (avoids "gazowana" ⊂ "niegazowana" false positive)
 *   3. Levenshtein distance ≤ ceil(longerLen × 0.25), max 2
 *      (catches typos like "cheesburger" ≈ "cheeseburger")
 */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  // Substring with length ratio guard
  if (shorter.length >= 3 && longer.includes(shorter) && shorter.length / longer.length >= 0.75) {
    return true;
  }
  // Levenshtein for words ≥ 4 chars
  if (a.length >= 4 && b.length >= 4) {
    const maxDist = Math.min(2, Math.ceil(Math.max(a.length, b.length) * 0.25));
    if (levenshtein(a, b) <= maxDist) return true;
  }
  return false;
}

/**
 * Find best matching POS product for an order item.
 *
 * Strategy (ordered by precision):
 * 1. Exact match after full normalization (strip prefix + diacritics).
 * 2. Exact match with all spaces removed (catches "Red Bull" → "RedBull").
 * 3. Bidirectional word-overlap scoring with fuzzy word matching:
 *    - itemCoverage = matched item words / total item words
 *    - posCoverage  = matched POS words / total POS words
 *    - score = itemCoverage + posCoverage  (max 2.0)
 *    - +0.5 bonus when prices match (strong disambiguation signal)
 *    - Tie-break: prefer shorter POS name (= more specific / less extra words)
 *    - Minimum score: 1.0
 */
function findPosProduct(
  itemName: string,
  posProducts: PosProduct[],
  itemPrice?: number
): PosProduct | undefined {
  const normItem = normalizeForMatching(itemName);

  // Pre-compute stripped POS names
  const candidates = posProducts.map((p) => ({
    product: p,
    stripped: normalizeForMatching(p.name),
  }));

  // 1. Exact match
  const exact = candidates.find((c) => c.stripped === normItem);
  if (exact) {
    console.log(`[POS Match] "${itemName}" → exact → "${exact.product.name}" (pos_id: ${exact.product.pos_id})`);
    return exact.product;
  }

  // 1.5. Exact match ignoring all spaces (handles compound words like RedBull)
  const itemNoSpaces = normItem.replace(/ /g, "");
  if (itemNoSpaces.length >= 4) {
    const exactNS = candidates.find((c) => c.stripped.replace(/ /g, "") === itemNoSpaces);
    if (exactNS) {
      console.log(`[POS Match] "${itemName}" → exact-no-spaces → "${exactNS.product.name}" (pos_id: ${exactNS.product.pos_id})`);
      return exactNS.product;
    }
  }

  // 2. Bidirectional word-overlap scoring with fuzzy matching
  const itemWords = normItem.split(" ").filter((w) => w.length >= 3);
  if (itemWords.length === 0) return undefined;

  let bestProduct: PosProduct | undefined;
  let bestScore = 0;
  let bestStrippedLen = Infinity;

  for (const c of candidates) {
    const posWords = c.stripped.split(" ").filter((w) => w.length >= 3);
    if (posWords.length === 0) continue;

    // How many item words fuzzy-match some POS word
    const matchedItemWords = itemWords.filter((iw) =>
      posWords.some((pw) => wordsMatch(iw, pw))
    ).length;
    if (matchedItemWords === 0) continue;

    // How many POS words fuzzy-match some item word (bidirectional!)
    const matchedPosWords = posWords.filter((pw) =>
      itemWords.some((iw) => wordsMatch(iw, pw))
    ).length;

    const itemCoverage = matchedItemWords / itemWords.length;
    const posCoverage = matchedPosWords / posWords.length;
    let score = itemCoverage + posCoverage;

    // Price match bonus — strong disambiguation signal
    if (
      itemPrice != null &&
      c.product.price != null &&
      Math.abs(Number(c.product.price) - itemPrice) < 0.01
    ) {
      score += 0.5;
    }

    const isBetter =
      score > bestScore ||
      (score === bestScore && c.stripped.length < bestStrippedLen);

    if (isBetter) {
      bestScore = score;
      bestProduct = c.product;
      bestStrippedLen = c.stripped.length;
    }
  }

  if (bestProduct && bestScore >= 1.0) {
    console.log(
      `[POS Match] "${itemName}" → fuzzy (score ${bestScore.toFixed(2)}) → "${bestProduct.name}" (pos_id: ${bestProduct.pos_id})`
    );
    return bestProduct;
  }

  console.warn(
    `[POS Match] "${itemName}" → NO MATCH (best score: ${bestScore.toFixed(2)}, candidate: "${bestProduct?.name ?? "none"}")`
  );
  return undefined;
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
    
    // 3.4. Fetch addon categories from database for proper POS product mapping
    const { data: addonCategoriesData } = await supabase
      .from("addons")
      .select("name, category")
      .eq("available", true);
    const addonCategoryMap = new Map<string, string>();
    if (addonCategoriesData) {
      for (const a of addonCategoriesData) {
        addonCategoryMap.set((a.name as string).toLowerCase(), a.category as string);
      }
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

    // Smart delivery product selection:
    // - "Dowóz na terenie Ciechanowa" for Ciechanów addresses
    // - "Dowóz poza Ciechanów" for out-of-city addresses
    const orderCity = (order.city || "").toLowerCase().trim();
    const isCiechanow = orderCity.includes("ciechan");
    let deliveryProduct: PosProduct | undefined;
    if (isCiechanow) {
      deliveryProduct = findSpecialProduct(["dowóz na terenie", "dowoz na terenie", "na terenie ciechan"]);
    } else {
      deliveryProduct = findSpecialProduct(["poza ciechan", "dowóz poza", "dowoz poza"]);
    }
    // Fallback: any delivery product if specific one not found
    if (!deliveryProduct) {
      deliveryProduct = findSpecialProduct(["dowóz", "dowoz", "dostawa", "transport", "delivery"]);
    }
    if (deliveryProduct) {
      console.log(`[Dotypos Order] Delivery product: "${deliveryProduct.name}" (city: ${order.city || "?"}, isCiechanow: ${isCiechanow})`);
    }
    
    // Find special POS products for addon mapping
    const extraMeatProduct = findSpecialProduct(["dodatkowe mięso", "dodatkowe mieso"]);
    const extraIngredientProduct = findSpecialProduct(["dodatkowy składnik", "dodatkowy skladnik"]);
    const extraSauceProduct = findSpecialProduct(["dodatkowy sos"]);
    const extraFluidCheeseProduct = findSpecialProduct(["dodatkowy płynny ser", "dodatkowy plynny ser"]);
    console.log(`[Dotypos Order] Addon POS products — mięso: ${extraMeatProduct?.pos_id ?? "brak"}, składnik: ${extraIngredientProduct?.pos_id ?? "brak"}, sos: ${extraSauceProduct?.pos_id ?? "brak"}, płynny ser: ${extraFluidCheeseProduct?.pos_id ?? "brak"}`);
    
    // 4. Map order items to Dotypos items
    // Każda sztuka produktu jest osobną pozycją z własnym blokiem dodatków.
    // Dzięki temu kucharz widzi dokładnie które dodatki należą do którego burgera.
    const dotyposItems: DotyposOrderItem[] = [];
    const unmappedItems: string[] = [];
    
    for (const item of items) {
      const posProduct = findPosProduct(item.name, posProducts, item.price);
      
      if (!posProduct) {
        unmappedItems.push(item.name);
        console.warn(`[Dotypos Order] Unmapped product: ${item.name}`);
        continue;
      }
      
      // Rozbij addons na kategorie:
      //   meatTypeNote  → tylko notatka bonu (wybór mięsa, bezpłatne)
      //   extraMeatCount → osobna pozycja POS "Dodatkowe mięso"
      //   regularAddons  → osobne pozycje POS wg kategorii z bazy addons
      const regularAddons: string[] = [];
      let meatTypeNote: string | undefined;
      let extraMeatCount = 0;
      
      for (const addon of (item.addons || [])) {
        // "Mięso: kurczak" → tylko w notatce, NIE jako płatny produkt
        const meatMatch = addon.match(/^Mięso:\s*(.+)$/i);
        if (meatMatch) {
          meatTypeNote = meatMatch[1].trim();
          continue;
        }
        // "Dodatkowe mięso x2" → osobna pozycja POS
        const extraMeatMatch = addon.match(/^Dodatkowe mięso x(\d+)$/i);
        if (extraMeatMatch) {
          extraMeatCount += parseInt(extraMeatMatch[1], 10);
          continue;
        }
        regularAddons.push(addon);
      }
      
      // Notatka do produktu: typ mięsa + opcjonalna ręczna notatka klienta
      const noteParts: string[] = [];
      if (meatTypeNote) noteParts.push(`Mięso: ${meatTypeNote}`);
      if (item.note)     noteParts.push(item.note);
      const itemNote = noteParts.length > 0 ? noteParts.join(" | ") : undefined;
      
      const qty = item.quantity || 1;
      if (qty > 1) {
        console.log(`[Dotypos Order] Splitting "${item.name}" × ${qty} into individual units (each with own addons)`);
      }
      
      // Każda sztuka → własna pozycja burgera + własne dodatki
      for (let unit = 0; unit < qty; unit++) {
        // Główny produkt
        dotyposItems.push({
          id: posProduct.pos_id,
          qty: 1,
          note: itemNote,
        });
        
        // Dodatkowe mięso dla tej sztuki
        if (extraMeatCount > 0) {
          if (extraMeatProduct) {
            dotyposItems.push({
              id: extraMeatProduct.pos_id,
              qty: extraMeatCount,
              note: `Do: ${item.name}`,
            });
          } else {
            console.warn(`[Dotypos Order] Brak produktu "Dodatkowe mięso" w POS`);
          }
        }
        
        // Płatne dodatki dla tej sztuki
        for (const addonName of regularAddons) {
          const category = addonCategoryMap.get(addonName.toLowerCase()) || "dodatek";
          
          let addonPosProduct: PosProduct | undefined;
          if (category === "sos")     addonPosProduct = extraSauceProduct;
          else if (category === "premium") addonPosProduct = extraFluidCheeseProduct;
          else                          addonPosProduct = extraIngredientProduct;
          
          if (addonPosProduct) {
            dotyposItems.push({
              id: addonPosProduct.pos_id,
              qty: 1,
              note: addonName,
            });
          } else {
            console.warn(`[Dotypos Order] Brak produktu POS dla dodatku "${addonName}" (kategoria: ${category})`);
            // Dodaj do unmapped tylko raz (przy pierwszej sztuce)
            if (unit === 0) unmappedItems.push(`Dodatek: ${addonName}`);
          }
        }
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
    // NOTE: Order type (NA WYNOS / DOSTAWA) is NOT in the note — it's handled
    // by the take-away flag which Dotypos displays below S-number on the bon.
    // This way it appears in the right place (under order number, not at the top).
    const orderNoteParts: string[] = [];
    // Metoda płatności na samej górze bonu
    if (order.payment_method) {
      orderNoteParts.push(`Płatność: ${order.payment_method}`);
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
      orderNoteParts.push(`Niezmapowane: ${unmappedItems.join(", ")}`);
    }
    
    // 7. Determine if order is paid online
    const isPaid = order.payment_status === "paid" || 
                   order.payment_status === "completed";
    
    // 7.5. Calculate discount percent for Dotypos
    // Dotypos supports discount-percent (e.g. 20 = 20%) on the whole order.
    // Look up the ACTUAL percentage from discount_codes table for accuracy.
    let discountPercent = 0;
    if (order.discount_amount && order.discount_amount > 0) {
      // Try to get the exact discount percentage from the promo code definition
      if (order.promo_code) {
        try {
          const { data: dc } = await supabase
            .from("discount_codes")
            .select("type, value")
            .ilike("code", order.promo_code)
            .maybeSingle();
          if (dc && dc.type === "percent") {
            discountPercent = Number(dc.value);
            console.log(`[Dotypos Order] Discount: ${discountPercent}% from code "${order.promo_code}" (type: percent, saved: ${order.discount_amount} zł)`);
          } else if (dc && dc.type === "amount") {
            // Fixed amount discount — calculate % from total POS items value
            // Don't send discount-percent, the amounts already reflect the discount
            console.log(`[Dotypos Order] Discount: fixed ${dc.value} zł from code "${order.promo_code}" — not sent as % to POS`);
            discountPercent = 0; // Don't apply % discount for fixed-amount codes
          }
        } catch (e) {
          console.warn("[Dotypos Order] Could not look up discount code:", e);
        }
      }
      // Fallback: calculate from amounts if code lookup didn't work
      if (discountPercent === 0 && order.base_before_discount && order.base_before_discount > 0) {
        const totalBase = order.base_before_discount + (order.delivery_cost || 0);
        discountPercent = Math.round((order.discount_amount / totalBase) * 100);
        console.log(`[Dotypos Order] Discount (calculated): ${order.discount_amount} zł / ${totalBase} zł = ${discountPercent}% (code: ${order.promo_code || "auto"})`);
      }
    }
    
    // Determine takeaway flag from selected_option (more reliable than order_type)
    const isTakeAway = (order.selected_option || order.order_type) !== "local" &&
                       (order.selected_option || order.order_type) !== "dine-in";
    
    // 7.7. Find matching table ID for order type label on bon
    // Dotypos shows "Stół: [name]" on the bon when a table is assigned.
    // We look up tables by name to match order type (e.g. "kierowca" for delivery, "na wynos" for takeaway).
    let tableId: number | undefined;
    try {
      // Check env vars first (fastest, no API call)
      if (selectedOpt === "delivery" && process.env.DOTYPOS_TABLE_ID_DELIVERY) {
        tableId = parseInt(process.env.DOTYPOS_TABLE_ID_DELIVERY, 10);
      } else if (selectedOpt === "takeaway" && process.env.DOTYPOS_TABLE_ID_TAKEAWAY) {
        tableId = parseInt(process.env.DOTYPOS_TABLE_ID_TAKEAWAY, 10);
      } else if (selectedOpt === "local" && process.env.DOTYPOS_TABLE_ID_LOCAL) {
        tableId = parseInt(process.env.DOTYPOS_TABLE_ID_LOCAL, 10);
      }
      
      // Fallback: fetch tables from API and match by name
      if (!tableId) {
        console.log(`[Dotypos Order] Fetching tables from API for selectedOpt="${selectedOpt}"...`);
        const tablesRes = await getTables();
        const rawTables = tablesRes.data || [];
        console.log(`[Dotypos Order] Raw tables:`, JSON.stringify(rawTables.map((t: any) => ({ id: t.id, name: t.name, deleted: t.deleted, tid: typeof t.id, tdel: typeof t.deleted }))));
        
        // Normalize: API may return id as string and deleted as various types
        const tables = rawTables.map((t: any) => ({
          id: typeof t.id === "string" ? parseInt(t.id, 10) : Number(t.id),
          name: String(t.name || ""),
          deleted: t.deleted === true || t.deleted === "true" || t.deleted === 1,
        }));
        
        const activeTables = tables.filter((t: { deleted: boolean }) => !t.deleted);
        console.log(`[Dotypos Order] Active tables: ${activeTables.map((t: { name: string; id: number }) => `"${t.name}"(${t.id})`).join(", ")}`);
        
        // Try exact name match first, then includes (to avoid "kierowca 2" matching before "kierowca")
        const findTableExact = (name: string): { id: number; name: string } | undefined => {
          return activeTables.find((t: { name: string }) => t.name.toLowerCase().trim() === name);
        };
        const findTableIncludes = (keywords: string[]): { id: number; name: string } | undefined => {
          for (const kw of keywords) {
            const found = activeTables.find((t: { name: string }) => 
              t.name.toLowerCase().includes(kw)
            );
            if (found) return found;
          }
          return undefined;
        };
        
        let matched: { id: number; name: string } | undefined;
        if (selectedOpt === "delivery") {
          matched = findTableExact("kierowca") || findTableIncludes(["kierowca", "dostawa"]);
        } else if (selectedOpt === "takeaway") {
          matched = findTableExact("wynos") || findTableIncludes(["wynos", "takeaway"]);
        }
        
        if (matched) {
          tableId = matched.id;
          console.log(`[Dotypos Order] Matched table: "${matched.name}" (id: ${matched.id}, type: ${typeof matched.id}) for ${selectedOpt}`);
        } else {
          // Hardcoded fallback IDs (from known Dotypos tables)
          const KNOWN_TABLE_IDS: Record<string, number> = {
            delivery: 1595942776188800,  // "kierowca"
            takeaway: 1297326584999827,  // "wynos"
          };
          if (KNOWN_TABLE_IDS[selectedOpt]) {
            tableId = KNOWN_TABLE_IDS[selectedOpt];
            console.log(`[Dotypos Order] Using hardcoded table ID for ${selectedOpt}: ${tableId}`);
          } else {
            console.warn(`[Dotypos Order] No table matched for "${selectedOpt}". Active: ${activeTables.map((t: { name: string; id: number }) => `"${t.name}"(${t.id})`).join(", ")}`);
          }
        }
      }
    } catch (tableErr) {
      console.warn("[Dotypos Order] Table lookup failed (order will be sent without table):", tableErr);
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
    console.log(`[Dotypos Order] Sending ${dotyposItems.length} items, paid=${isPaid}, discount=${discountPercent}%, tableId=${tableId ?? "none"} (type: ${typeof tableId})`);
    
    if (isPaid) {
      orderNoteParts.push("OPLACONE ONLINE");
    }
    
    const response = await dotypos.createDraftOrder({
      externalId: orderId,
      items: dotyposItems,
      customer,
      note: orderNoteParts.join(" | "),
      takeAway: isTakeAway,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      tableId,
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
