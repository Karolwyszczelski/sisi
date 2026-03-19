// src/app/api/dotypos/webhook/route.ts
// =============================================
// Dotypos Webhook Receiver
// =============================================
//
// Handles two types of webhooks from Dotypos:
//
// 1. Entity change webhooks (registered via API):
//    - ORDERBEAN: Order changes (created, updated, completed)
//    - PRODUCT: Product changes (sync trigger)
//    - STOCKLOG: Stock changes
//    - POINTSLOG: Points changes
//    - RESERVATION: Reservation changes
//
// 2. POS Action response webhooks (via "webhook" param in POS actions):
//    - Async response from POS device after processing an action
//    - Contains order data, items, code, deviceTimestamp
//
// Setup: Register webhooks at POST /v2/clouds/{cloudId}/webhooks
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * POST /api/dotypos/webhook
 * Receives webhook notifications from Dotypos
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const timestamp = new Date().toISOString();
    
    // Dotypos sends Idempotency-Key header in POS action webhook callbacks
    // Use it for deduplication of retried webhook calls
    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    
    console.log(
      "[Dotypos Webhook] Received:",
      idempotencyKey ? `idempotency-key=${idempotencyKey}` : "no-idempotency-key",
      JSON.stringify(body, null, 2)
    );
    
    // Determine webhook type based on payload structure
    if (body.code !== undefined && (body.order || body.items)) {
      // POS Action response webhook (from "webhook" param in POS actions)
      return handlePOSActionResponse(body, timestamp);
    } else if (body.entityType || body.payloadEntity) {
      // Entity change webhook (registered webhooks)
      return handleEntityChange(body, timestamp);
    } else {
      // Unknown format - log and accept
      console.warn("[Dotypos Webhook] Unknown payload format:", body);
      
      await logWebhook("unknown", body, timestamp);
      
      return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("[Dotypos Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle POS Action response (async response from POS device)
 */
async function handlePOSActionResponse(
  body: {
    code: number;
    order?: { id: number; "external-id"?: string; "price-total"?: number; paid?: boolean };
    items?: unknown[];
    deviceTimestamp?: number;
    "external-id"?: string;
    "pass-through-errors"?: Array<{ code: number; description: string }>;
  },
  timestamp: string
) {
  const externalId = body["external-id"] || body.order?.["external-id"];
  const orderId = body.order?.id;
  const success = body.code === 0;
  
  console.log(
    `[Dotypos Webhook] POS Action response: code=${body.code}, orderId=${orderId}, externalId=${externalId}`
  );
  
  // If we have an external-id, update the order in our database
  if (externalId) {
    try {
      const supabase = getSupabase();
      
      const updateData: Record<string, unknown> = {
        dotypos_webhook_received_at: timestamp,
        dotypos_pos_response_code: body.code,
      };
      
      if (orderId) {
        updateData.dotypos_order_id = orderId;
      }
      
      if (success) {
        updateData.dotypos_status = "confirmed";
      } else {
        updateData.dotypos_status = "pos_error";
        updateData.dotypos_error = body["pass-through-errors"]?.[0]?.description 
          || `POS error code: ${body.code}`;
      }
      
      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", externalId);
      
      if (error) {
        console.error("[Dotypos Webhook] Failed to update order:", error);
      } else {
        console.log(`[Dotypos Webhook] Order ${externalId} updated with POS response`);
      }
    } catch (err) {
      console.error("[Dotypos Webhook] DB update error:", err);
    }
  }
  
  await logWebhook("pos-action-response", body, timestamp);
  
  return NextResponse.json({ received: true, code: body.code });
}

/**
 * Handle entity change webhook (ORDERBEAN, PRODUCT, STOCKLOG, etc.)
 */
async function handleEntityChange(
  body: {
    cloudId?: number;
    branchId?: number;
    entityId?: number;
    entityType?: string;
    payloadEntity?: string;
    action?: string;
    data?: Record<string, unknown>;
    timestamp?: number;
  },
  receivedAt: string
) {
  const entityType = body.entityType || body.payloadEntity || "unknown";
  
  console.log(
    `[Dotypos Webhook] Entity change: ${entityType}, entityId=${body.entityId}, action=${body.action}`
  );
  
  switch (entityType) {
    case "PRODUCT":
      // Product changed - could trigger product sync
      console.log("[Dotypos Webhook] Product change detected, consider syncing products");
      break;
      
    case "ORDERBEAN":
      // Order changed in POS
      console.log("[Dotypos Webhook] Order change from POS:", body.entityId);
      break;
      
    case "STOCKLOG":
      console.log("[Dotypos Webhook] Stock change:", body.entityId);
      break;
      
    case "RESERVATION":
      console.log("[Dotypos Webhook] Reservation change:", body.entityId);
      break;
      
    case "POINTSLOG":
      console.log("[Dotypos Webhook] Points change:", body.entityId);
      break;
      
    default:
      console.log(`[Dotypos Webhook] Unhandled entity type: ${entityType}`);
  }
  
  await logWebhook(entityType, body, receivedAt);
  
  return NextResponse.json({ received: true, entityType });
}

/**
 * Log webhook to database for debugging/auditing
 */
async function logWebhook(
  type: string,
  payload: unknown,
  timestamp: string
) {
  try {
    const supabase = getSupabase();
    
    // Try to insert into webhook_logs table (create if doesn't exist - will silently fail if missing)
    await supabase
      .from("dotypos_webhook_logs")
      .insert({
        type,
        payload,  // JSONB column - pass object directly, not JSON.stringify
        received_at: timestamp,
      });
  } catch {
    // Table might not exist yet - that's ok, just console log
    console.log(`[Dotypos Webhook] Log (${type}):`, JSON.stringify(payload).slice(0, 200));
  }
}

/**
 * GET handler - return webhook status (for health checks)
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/dotypos/webhook",
    supportedTypes: ["POS Action responses", "ORDERBEAN", "PRODUCT", "STOCKLOG", "POINTSLOG", "RESERVATION"],
    docs: "https://docs.api.dotypos.com/webhooks/",
  });
}
