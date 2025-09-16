// src/app/api/payments/p24/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractOrderIdFromSession,
  hostFromEnv,
  p24SignVerifyMD5,
  parseP24Amount,
} from "@/lib/p24";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const data = payload?.data ?? payload ?? {};

    const sessionId = data.sessionId ?? data.p24_session_id;
    const rawAmount = data.amount ?? data.p24_amount;
    const currency = data.currency ?? data.p24_currency ?? "PLN";
    const orderIdFromGateway = data.orderId ?? data.p24_order_id;
    const sign = data.sign ?? data.p24_sign;

    if (!sessionId || orderIdFromGateway == null || rawAmount == null || !sign) {
      return NextResponse.json({ error: "Bad callback" }, { status: 400 });
    }

    const amountGr = parseP24Amount(rawAmount);
    if (amountGr === null) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID = process.env.P24_POS_ID!;
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      throw new Error("Brak konfiguracji P24");
    }

    // weryfikacja podpisu notyfikacji
    const expected = p24SignVerifyMD5(
      sessionId,
      orderIdFromGateway,
      amountGr,
      currency,
      P24_CRC_KEY
    );
    if (expected !== String(sign)) {
      console.error("P24 sign mismatch");
      return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
    }

    // verify call (wymagane przez P24)
    const host = hostFromEnv();
    const verifyBody = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: String(sessionId),
      p24_amount: String(amountGr),
      p24_currency: String(currency),
      p24_order_id: String(orderIdFromGateway),
      p24_sign: expected,
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

    // wyciągnij orderId z sessionId
    const orderId = extractOrderIdFromSession(sessionId);
    if (!orderId) {
      console.error("P24 callback: unable to derive order id", sessionId);
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    if (ok) {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) {
        console.error("P24 callback: Supabase update failed", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", orderId);
    if (error) {
      console.error("P24 callback: failed status update errored", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) {
    console.error("P24 callback error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}