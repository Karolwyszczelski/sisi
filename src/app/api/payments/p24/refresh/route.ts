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
const POS_ID      = process.env.P24_POS_ID!;
const API_KEY     = process.env.P24_API_KEY!;

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
  const orderId   = (order as any).p24_order_id ? Number((order as any).p24_order_id) : undefined;

  const auth = Buffer.from(`${MERCHANT_ID}:${API_KEY}`).toString("base64");
  const body: Record<string, any> = {
    merchantId: Number(MERCHANT_ID),
    posId: Number(POS_ID),
    sessionId,
    amount: Math.round(Number(order.total_price || 0) * 100),
    currency: (order as any).currency || "PLN",
  };
  if (orderId) body.orderId = orderId;

  let newStatus: "paid" | "failed" | "pending" = (order.payment_status ?? "pending") as any;

  try {
    const r = await fetch(`${API_URL}/transaction/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    const safeJson = await r.json().catch(() => null as any);

    if (r.ok) {
      const st = safeJson?.data?.status ?? safeJson?.status;
      if (!st || st === "success" || st === true) newStatus = "paid";
      else if (st === "failed") newStatus = "failed";
      else newStatus = "pending";
    } else {
      const msg = (safeJson?.error?.message || safeJson?.message || "").toString().toLowerCase();
      const code = (safeJson?.error?.code || "").toString().toLowerCase();
      if (msg.includes("already") || code.includes("already")) {
        newStatus = "paid";
      } else if (r.status === 400 || r.status === 422) {
        newStatus = "pending";
      }
    }
  } catch {
    // sieć padła – zostaw bez zmian
  }

  if (newStatus !== order.payment_status) {
    await supabase.from("orders").update({ payment_status: newStatus }).eq("id", id);
  }

  return NextResponse.json({ payment_status: newStatus });
}
