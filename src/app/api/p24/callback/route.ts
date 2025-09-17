// src/app/api/p24/callback/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractOrderIdFromSession,
  hostFromEnv,
  p24SignVerifyMD5,
  parseP24Amount,
} from "@/lib/p24";

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  P24_MERCHANT_ID,
  P24_POS_ID,
  P24_CRC_KEY,            // potrzebne do podpisu
  DEBUG_P24,
} = process.env;

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// czytaj każde możliwe body
async function readBody(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const txt = await req.text();
    const params = new URLSearchParams(txt);
    const o: Record<string, any> = {};
    params.forEach((v, k) => (o[k] = v));
    return o;
  }
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const o: Record<string, any> = {};
    for (const [k, v] of fd.entries()) o[k] = typeof v === "string" ? v : await v.text();
    return o;
  }
  try { return await req.json(); } catch { return {}; }
}
const pick = (v: any, ...keys: string[]) => keys.map(k => v?.[k]).find(x => x !== undefined && x !== null && String(x).length);

export async function POST(req: NextRequest) {
  try {
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const payload = await readBody(req);
    const data = payload?.data ?? payload ?? {};

    const sessionId = String(pick(data, "sessionId", "p24_session_id") || "");
    const rawAmount = pick(data, "amount", "p24_amount");
    const currency = String(pick(data, "currency", "p24_currency") || "PLN");
    const orderIdFromGateway = String(pick(data, "orderId", "p24_order_id") || "");

    if (!sessionId || !rawAmount || !orderIdFromGateway) {
      if (DEBUG_P24 === "1") console.log("P24 cb missing fields", { sessionId, rawAmount, orderIdFromGateway, currency, data });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountGr = parseP24Amount(rawAmount, currency);

    // verify do P24
    const expected = p24SignVerifyMD5({
      sessionId,
      orderId: orderIdFromGateway,
      amount: amountGr,
      currency,
    });

    const host = hostFromEnv();
    const verifyBody = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: sessionId,
      p24_amount: String(amountGr),
      p24_currency: currency,
      p24_order_id: orderIdFromGateway,
      p24_sign: String(expected),
    });

    const res = await fetch(`https://${host}/trnVerify`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });
    const text = await res.text();
    if (DEBUG_P24 === "1") console.log("P24 verify:", { status: res.status, text });

    const ok =
      (res.ok && /error=0/.test(text)) ||
      (res.ok && (() => { try { return JSON.parse(text)?.data?.status === "success"; } catch { return false; } })());

    // fallback id z session
    const orderIdFromSession = extractOrderIdFromSession(sessionId);

    const baseValues: Record<string, unknown> = {
      p24_session_id: sessionId,
      p24_order_id: orderIdFromGateway,
    };

    const updateOrderWithFallback = async (
      values: Record<string, unknown>
    ): Promise<"success" | "not-found" | "error"> => {
      const q1 = await supabase
        .from("orders")
        .update(values)
        .eq("p24_session_id", sessionId)
        .select()
        .maybeSingle();
      if (q1.error) return "error";
      if (q1.data) return "success";

      if (!orderIdFromSession) return "not-found";

      const q2 = await supabase
        .from("orders")
        .update(values)
        .eq("id", orderIdFromSession)
        .select()
        .maybeSingle();
      if (q2.error) return "error";
      return q2.data ? "success" : "not-found";
    };

    if (ok) {
      const r = await updateOrderWithFallback({ ...baseValues, payment_status: "paid", paid_at: new Date().toISOString() });
      if (r !== "success") return NextResponse.json({ error: r }, { status: r === "error" ? 500 : 400 });
      return NextResponse.json({ ok: true });
    }

    const rf = await updateOrderWithFallback({ ...baseValues, payment_status: "failed" });
    if (rf !== "success") return NextResponse.json({ ok: false, error: rf }, { status: rf === "error" ? 500 : 400 });
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e) {
    if (DEBUG_P24 === "1") console.log("P24 callback exception:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
