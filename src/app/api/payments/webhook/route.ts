export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractOrderIdFromSession,
  hostFromEnv,
  p24SignVerifyMD5,
  parseP24Amount,
} from "@/lib/p24";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// P24 wysyła application/x-www-form-urlencoded
async function readFormOrJson(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const qs = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    qs.forEach((v, k) => (obj[k] = v));
    return obj;
  }
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const b: any = await readFormOrJson(req);

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID = process.env.P24_POS_ID!;
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      throw new Error("Brak konfiguracji P24");
    }

    // nazewnictwo wg v3.2
    const sessionId = b.p24_session_id || b.sessionId;
    const orderIdFromGateway = b.p24_order_id || b.orderId;
    const rawAmount = b.p24_amount ?? b.amount;
    const amountGr = parseP24Amount(rawAmount);
    const currency = b.p24_currency || b.currency || "PLN";
    const sign = b.p24_sign || b.sign;

    if (!sessionId || !orderIdFromGateway || amountGr === null || !sign) {
      return NextResponse.json({ error: "Bad payload" }, { status: 400 });
    }

    // weryfikacja podpisu z notyfikacji
    const expected = p24SignVerifyMD5(
      sessionId,
      orderIdFromGateway,
      amountGr,
      currency,
      P24_CRC_KEY
    );
    if (expected !== String(sign)) {
      console.error("P24 webhook: sign mismatch");
      return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
    }

    // verify call
    const host = hostFromEnv();
    const verifyPayload = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: String(sessionId),
      p24_amount: String(amountGr),
      p24_currency: String(currency),
      p24_order_id: String(orderIdFromGateway),
      p24_sign: expected,
    });

    const vr = await fetch(`https://${host}/trnVerify`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyPayload.toString(),
    });
    const vtxt = await vr.text();

    const ok =
      (vr.ok && /error=0/.test(vtxt)) ||
      (vr.ok && (() => { try { const j = JSON.parse(vtxt); return j?.data?.status === "success"; } catch { return false; } })());

    // z sessionId wyciągamy id zamówienia w formie tekstowej
    const orderIdFromSession = extractOrderIdFromSession(sessionId);
    if (!orderIdFromSession) {
      console.warn("P24 webhook: unable to derive order id", { sessionId });
    }

    const updateOrderWithFallback = async (
      values: Record<string, unknown>,
      statusLabel: "paid" | "failed"
    ): Promise<"success" | "not-found" | "error"> => {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .update(values)
        .eq("p24_session_id", sessionId)
        .select()
        .maybeSingle();

        if (error) {
        console.error(
          `P24 webhook: ${statusLabel} status update by session id failed`,
          error
        );
        return "error";
      }

      if (data) {
        return "success";
      }

      console.warn(
        `P24 webhook: no order matched session id for ${statusLabel} update`,
        { sessionId }
      );

      if (!orderIdFromSession) {
        return "not-found";
      }

      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from("orders")
        .update(values)
        .eq("id", orderIdFromSession)
        .select()
        .maybeSingle();

      if (fallbackError) {
        console.error(
          `P24 webhook: ${statusLabel} status update by order id failed`,
          fallbackError
        );
        return "error";
      }

      if (fallbackData) {
        return "success";
      }

      console.warn(
        `P24 webhook: no order matched fallback order id for ${statusLabel} update`,
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
    console.error("[P24_WEBHOOK_ERROR]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}