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

  // 1) Spróbuj odpytać po sessionId (działa bez CRC)
  try {
    const r = await fetch(`${API_URL}/transaction/by/sessionId/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({} as any));
      // możliwe kształty: {data:{status}} lub {data:[{status:...}]}
      const ds = (j?.data && Array.isArray(j.data)) ? j.data[0] : j?.data;
      const st = ds?.status as string | undefined;
      if (st === "success") newStatus = "paid";
      else if (st === "cancelled" || st === "rejected" || st === "error") newStatus = "failed";
      else if (st === "pending" || st === "waiting") newStatus = "pending";
    }
  } catch {
    // cicho
  }

  // 2) (fallback) weryfikacja /transaction/verify
  if (newStatus === "pending") {
    try {
      const body = {
        merchantId: Number(MERCHANT_ID),
        posId: Number(POS_ID),
        sessionId,
        amount: Math.round(Number(order.total_price || 0) * 100),
        currency: (order as any).currency || "PLN",
        // dla niektórych kont wymagany jest orderId — jeśli masz, wyślij
        ...(orderId ? { orderId: Number(orderId) } : {}),
      };
      const vr = await fetch(`${API_URL}/transaction/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(body),
      });
      if (vr.ok) {
        const vj = await vr.json().catch(() => ({} as any));
        const st = vj?.data?.status ?? vj?.status;
        if (st === "success") newStatus = "paid";
        else if (st === "failed") newStatus = "failed";
      }
    } catch {
      // cicho
    }
  }

  if (newStatus !== order.payment_status) {
    await supabase
      .from("orders")
      .update({ payment_status: newStatus, ...(newStatus === "paid" ? { paid_at: new Date().toISOString() } : {}) })
      .eq("id", id);
  }

  return NextResponse.json({ payment_status: newStatus });
}
