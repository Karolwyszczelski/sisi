// src/app/api/payments/p24/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { p24, p24Base, signVerify } from "@/lib/p24";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractOrderId(sessionId: unknown): string | null {
  if (!sessionId) return null;
  const raw = String(sessionId);
  const withoutPrefix = raw.startsWith("sisi-") ? raw.slice(5) : raw;
  const trimmed = withoutPrefix.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    // payload.data.{merchantId,posId,sessionId,amount,currency,orderId,sign}
    const d = payload?.data;
    if (!d?.sessionId || !d?.amount || !d?.currency || !d?.orderId || !d?.sign) {
      return NextResponse.json({ error: "Bad callback" }, { status: 400 });
    }

    // weryfikacja podpisu notyfikacji
    const expected = signVerify(d.sessionId, d.amount, d.currency, d.orderId);
    if (expected !== d.sign) {
      console.error("P24 sign mismatch");
      return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
    }

    // verify call (wymagane przez P24)
    const verifyBody = {
      merchantId: p24.merchantId,
      posId: p24.posId,
      sessionId: d.sessionId,
      amount: d.amount,
      currency: d.currency,
      orderId: d.orderId,
      sign: expected,
    };

    const res = await fetch(`${p24Base}/api/v1/transaction/verify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    });
    const json = await res.json();
    if (!res.ok || json?.data?.status !== "success") {
      console.error("P24 verify failed:", json);
      return NextResponse.json({ error: "verify failed" }, { status: 400 });
    }

    // wyciągnij orderId z sessionId w formie tekstowej
   const orderId = extractOrderId(d.sessionId);
    if (!orderId) {
      console.error("P24 callback: unable to derive order id", d.sessionId);
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) {
      console.error("P24 callback: Supabase update failed", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("P24 callback error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
