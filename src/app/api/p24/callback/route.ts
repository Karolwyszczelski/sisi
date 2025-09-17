// src/app/api/p24/callback/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractOrderIdFromSession,
  hostFromEnv,           // zwraca 'secure.przelewy24.pl' lub 'sandbox.przelewy24.pl'
  p24SignVerifyMD5,     // md5(sessionId|orderId|amount|currency|crc)
  parseP24Amount,       // zamienia 15.90 PLN -> 1590
} from "@/lib/p24";

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  P24_MERCHANT_ID,
  P24_POS_ID,
} = process.env;

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = payload?.data ?? payload ?? {};

    const sessionId: string | undefined = data.sessionId ?? data.p24_session_id;
    const rawAmount: string | number | undefined = data.amount ?? data.p24_amount;
    const currency: string = data.currency ?? data.p24_currency ?? "PLN";
    const orderIdFromGateway: string | number | undefined =
      data.orderId ?? data.p24_order_id;

    if (!sessionId || !rawAmount || !orderIdFromGateway) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!P24_MERCHANT_ID || !P24_POS_ID) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const amountGr = parseP24Amount(rawAmount, currency);

    const expected = p24SignVerifyMD5({
      sessionId,
      orderId: String(orderIdFromGateway),
      amount: amountGr,
      currency,
    });

    const host = hostFromEnv();
    const verifyBody = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: String(sessionId),
      p24_amount: String(amountGr),
      p24_currency: String(currency),
      p24_order_id: String(orderIdFromGateway),
      p24_sign: String(expected),
    });

    const res = await fetch(`https://${host}/trnVerify`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });
    const text = await res.text();

    const ok =
      (res.ok && /error=0/.test(text)) ||
      (res.ok && (() => { try { const j = JSON.parse(text); return j?.data?.status === "success"; } catch { return false; } })());

    const orderIdFromSession = extractOrderIdFromSession(sessionId);

    const baseValues: Record<string, unknown> = {
      p24_session_id: String(sessionId),
      ...(orderIdFromGateway ? { p24_order_id: String(orderIdFromGateway) } : {}),
    };

    const updateOrderWithFallback = async (
      values: Record<string, unknown>,
      statusLabel: "paid" | "failed"
    ): Promise<"success" | "not-found" | "error"> => {
      const { data, error } = await supabase
        .from("orders")
        .update(values)
        .eq("p24_session_id", sessionId)
        .select()
        .maybeSingle();

      if (error) return "error";
      if (data) return "success";

      if (!orderIdFromSession) return "not-found";

      const { data: d2, error: e2 } = await supabase
        .from("orders")
        .update(values)
        .eq("id", orderIdFromSession)
        .select()
        .maybeSingle();

      if (e2) return "error";
      return d2 ? "success" : "not-found";
    };

    if (ok) {
      const paidAt = new Date().toISOString();
      const r = await updateOrderWithFallback(
        { ...baseValues, payment_status: "paid", paid_at: paidAt },
        "paid"
      );
      if (r === "error") return NextResponse.json({ error: "Update failed" }, { status: 500 });
      if (r === "not-found") return NextResponse.json({ error: "Order not found" }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const rf = await updateOrderWithFallback(
      { ...baseValues, payment_status: "failed" },
      "failed"
    );
    if (rf === "error") return NextResponse.json({ error: "Update failed" }, { status: 500 });
    if (rf === "not-found") {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 400 });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
