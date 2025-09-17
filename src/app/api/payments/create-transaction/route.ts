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
} = process.env;

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function pick(v: any, ...keys: string[]) {
  for (const k of keys) {
    const x = v?.[k];
    if (x !== undefined && x !== null && String(x).length) return x;
  }
  return undefined;
}

async function readBody(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const txt = await req.text();
    const params = new URLSearchParams(txt);
    const obj: Record<string, any> = {};
    params.forEach((val, key) => (obj[key] = val));
    return obj;
  }
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    for (const [k, v] of fd.entries()) obj[k] = typeof v === "string" ? v : await v.text();
    return obj;
  }
  try { return await req.json(); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readBody(req);
    const data = payload?.data ?? payload ?? {};

    const sessionId = pick(data, "sessionId", "p24_session_id");
    const rawAmount = pick(data, "amount", "p24_amount");
    const currency = pick(data, "currency", "p24_currency") ?? "PLN";
    const orderIdFromGateway = pick(data, "orderId", "p24_order_id");

    if (!sessionId || !rawAmount || !orderIdFromGateway) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!P24_MERCHANT_ID || !P24_POS_ID) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const amountGr = parseP24Amount(rawAmount, currency);

    // podpis do /trnVerify
    const expected = p24SignVerifyMD5({
      sessionId: String(sessionId),
      orderId: String(orderIdFromGateway),
      amount: amountGr,
      currency,
    });

    // verify
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
      (res.ok && (() => { try { return JSON.parse(text)?.data?.status === "success"; } catch { return false; } })());

    // fallback: id z sessionId
    const orderIdFromSession = extractOrderIdFromSession(String(sessionId));

    const baseValues: Record<string, unknown> = {
      p24_session_id: String(sessionId),
      p24_order_id: String(orderIdFromGateway),
    };

    const updateOrderWithFallback = async (
      values: Record<string, unknown>,
      _label: "paid" | "failed"
    ): Promise<"success" | "not-found" | "error"> => {
      const { data: d1, error: e1 } = await supabase
        .from("orders")
        .update(values)
        .eq("p24_session_id", sessionId)
        .select()
        .maybeSingle();
      if (e1) return "error";
      if (d1) return "success";

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
      const r = await updateOrderWithFallback(
        { ...baseValues, payment_status: "paid", paid_at: new Date().toISOString() },
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
    if (rf === "not-found") return NextResponse.json({ ok: false, error: "Order not found" }, { status: 400 });

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
