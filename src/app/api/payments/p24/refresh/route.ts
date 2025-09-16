export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getSessionAndRole } from "@/lib/serverAuth";

const API_URL =
  process.env.P24_ENV === "prod"
    ? "https://secure.przelewy24.pl/api/v1"
    : "https://sandbox.przelewy24.pl/api/v1";

const MERCHANT_ID = process.env.P24_MERCHANT_ID!;
const POS_ID = process.env.P24_POS_ID!;
const API_KEY = process.env.P24_API_KEY!;

function normalizeStatus(s?: string): "paid" | "failed" | "pending" {
  const v = String(s || "").toLowerCase();
  if (["success","completed","complete","confirmed","settled"].includes(v)) return "paid";
  if (["failed","error","rejected","cancelled","canceled","chargeback"].includes(v)) return "failed";
  return "pending";
}

export async function POST(request: Request) {
  const { session, role } = await getSessionAndRole(request);
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createRouteHandlerClient<Database>({ cookies });

  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select("id,total_price,payment_method,payment_status,p24_session_id,p24_order_id,currency")
    .eq("id", id)
    .single();

  if (ordErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.payment_method !== "Online") {
    return NextResponse.json({ payment_status: order.payment_status ?? null });
  }

  const sessionId = (order as any).p24_session_id || order.id;
  const orderId = (order as any).p24_order_id || null;
  const auth = Buffer.from(`${MERCHANT_ID}:${API_KEY}`).toString("base64");

  let newStatus: "paid" | "failed" | "pending" = order.payment_status ?? "pending";

  // 1) by/sessionId
  try {
    const r = await fetch(`${API_URL}/transaction/by/sessionId/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({} as any));
      const data = Array.isArray(j?.data) ? j.data[0] : j?.data;
      const st = normalizeStatus(data?.status);
      newStatus = st;
    }
  } catch {}

  // 2) fallback by/orderId
  if (newStatus === "pending" && orderId) {
    try {
      const r = await fetch(`${API_URL}/transaction/by/orderId/${encodeURIComponent(String(orderId))}`, {
        method: "GET",
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({} as any));
        const data = Array.isArray(j?.data) ? j.data[0] : j?.data;
        const st = normalizeStatus(data?.status);
        newStatus = st;
      }
    } catch {}
  }

  // 3) fallback verify
  if (newStatus === "pending") {
    try {
      const body = {
        merchantId: Number(MERCHANT_ID),
        posId: Number(POS_ID),
        sessionId,
        amount: Math.round(Number(order.total_price || 0) * 100),
        currency: (order as any).currency || "PLN",
        ...(orderId ? { orderId: Number(orderId) } : {}),
      };
      const r = await fetch(`${API_URL}/transaction/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({} as any));
        const st = normalizeStatus(j?.data?.status ?? j?.status);
        newStatus = st;
      }
    } catch {}
  }

  if (newStatus !== order.payment_status) {
    await supabase
      .from("orders")
      .update({ payment_status: newStatus, ...(newStatus === "paid" ? { paid_at: new Date().toISOString() } : {}) })
      .eq("id", id);
  }

  return NextResponse.json({ payment_status: newStatus });
}
