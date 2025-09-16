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
    const orderIdFromSession = extractOrderIdFromSession(sessionId);
    if (!orderIdFromSession) {
      console.warn("P24 callback: unable to derive order id", { sessionId });
    }

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

      if (error) {
        console.error(
          `P24 callback: ${statusLabel} status update by session id failed`,
          error
        );
        return "error";
      }

      if (data) {
        return "success";
      }

      console.warn(
        `P24 callback: no order matched session id for ${statusLabel} update`,
        { sessionId }
      );

      if (!orderIdFromSession) {
        return "not-found";
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("orders")
        .update(values)
        .eq("id", orderIdFromSession)
        .select()
        .maybeSingle();

      if (fallbackError) {
        console.error(
          `P24 callback: ${statusLabel} status update by order id failed`,
          fallbackError
        );
        return "error";
      }

      if (fallbackData) {
        return "success";
      }

      console.warn(
        `P24 callback: no order matched fallback order id for ${statusLabel} update`,
        { sessionId, orderIdFromSession }
      );
      return "not-found";
    };

    if (ok) {
      const paidAt = new Date().toISOString();
      const updateResult = await updateOrderWithFallback(
        { payment_status: "paid", paid_at: paidAt },
        "paid"
      );

      if (updateResult === "error") {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      if (updateResult === "not-found") {
        return NextResponse.json({ error: "Order not found" }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    const failedResult = await updateOrderWithFallback(
      { payment_status: "failed" },
      "failed"
    );

    if (failedResult === "error") {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    if (failedResult === "not-found") {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: unknown) {
    console.error("P24 callback error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}