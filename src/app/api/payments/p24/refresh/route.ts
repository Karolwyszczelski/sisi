// src/app/api/payments/p24/refresh/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getSessionAndRole } from "@/lib/serverAuth";

const API_URL = process.env.P24_ENV === "prod"
  ? "https://secure.przelewy24.pl/api/v1"
  : "https://sandbox.przelewy24.pl/api/v1";

const MERCHANT_ID = process.env.P24_MERCHANT_ID!;
const POS_ID      = process.env.P24_POS_ID!;
const API_KEY     = process.env.P24_API_KEY!;   // ten z panelu P24
const CRC_KEY     = process.env.P24_CRC_KEY!;   // nie wysyłamy, ale trzymaj w env

export async function POST(req: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select("id,total_price,payment_method,payment_status,p24_session_id, currency")
    .eq("id", id)
    .single();

  if (ordErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.payment_method !== "Online") {
    return NextResponse.json({ payment_status: order.payment_status ?? null });
  }

  // Musisz mieć zapisany sessionId (albo token) nadany przy rejestracji transakcji:
  const sessionId = (order as any).p24_session_id || order.id; // fallback

  // Weryfikacja w P24 (REST v1)
  // Auth: Basic(base64("<merchantId>:<apiKey>"))
  const auth = Buffer.from(`${MERCHANT_ID}:${API_KEY}`).toString("base64");

  // verify: P24 wymaga potwierdzenia kwoty/currency+sessionId
  const body = {
    merchantId: Number(MERCHANT_ID),
    posId: Number(POS_ID),
    sessionId,
    amount: Math.round(Number(order.total_price || 0) * 100), // w groszach
    currency: (order as any).currency || "PLN",
  };

  let paid = false;
  try {
    const r = await fetch(`${API_URL}/transaction/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    // jeśli transakcja poprawna, P24 zwraca success; w przeciwnym razie błąd
    if (r.ok) {
      const j = await r.json().catch(() => ({} as any));
      // typowo: { data: { status: "success" } } lub 200 bez body
      const ok =
        j?.data?.status === "success" ||
        j?.status === "success" ||
        r.status === 200;
      paid = !!ok;
    }
  } catch (e) {
    // zostaw bez zmian przy błędzie sieciowym
  }

  const newStatus: "paid" | "failed" | "pending" =
    paid ? "paid" : (order.payment_status === "failed" ? "failed" : "pending");

  if (newStatus !== order.payment_status) {
    await supabase
      .from("orders")
      .update({ payment_status: newStatus })
      .eq("id", id);
  }

  return NextResponse.json({ payment_status: newStatus });
}
