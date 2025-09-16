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
  // autoryzacja
  const { session, role } = await getSessionAndRole(request);
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createRouteHandlerClient<Database>({ cookies });

  // zamówienie
  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select("id,total_price,payment_method,payment_status,p24_session_id,currency")
    .eq("id", id)
    .single();

  if (ordErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.payment_method !== "Online") {
    return NextResponse.json({ payment_status: order.payment_status ?? null });
  }

  // verify
  const sessionId = (order as any).p24_session_id || order.id;
  const auth = Buffer.from(`${MERCHANT_ID}:${API_KEY}`).toString("base64");
  const body = {
    merchantId: Number(MERCHANT_ID),
    posId: Number(POS_ID),
    sessionId,
    amount: Math.round(Number(order.total_price || 0) * 100), // grosze
    currency: (order as any).currency || "PLN",
  };

  let newStatus: "paid" | "failed" | "pending" = order.payment_status ?? "pending";

  try {
    const r = await fetch(`${API_URL}/transaction/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const j = await r.json().catch(() => ({} as any));
      const status = j?.data?.status ?? j?.status;
      if (status === "success") newStatus = "paid";
      else if (status === "failed") newStatus = "failed";
      else newStatus = "pending";
    } else if (r.status === 400 || r.status === 422) {
      // negatywna weryfikacja → traktuj jako pending (albo failed, jeśli tak wolisz)
      newStatus = "pending";
    }
  } catch {
    // błąd sieci – nie zmieniamy statusu
  }

  if (newStatus !== order.payment_status) {
    await supabase.from("orders").update({ payment_status: newStatus }).eq("id", id);
  }

  return NextResponse.json({ payment_status: newStatus });
}
