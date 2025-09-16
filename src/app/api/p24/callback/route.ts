// src/app/api/payments/p24/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { P24_BASE, p24SignVerifyMD5 } from "@/lib/p24";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractOrderId(sessionId: unknown): string | null {
  if (!sessionId) return null;
  const raw = String(sessionId);
  const withoutPrefix = raw.startsWith("sisi-") ? raw.slice(5) : raw;
  const firstSegment = withoutPrefix.split("-").find((part) => part.trim().length > 0);
  return firstSegment ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    // payload.data.{merchantId,posId,sessionId,amount,currency,orderId,sign}
    const d = payload?.data;
    if (!d?.sessionId || !d?.amount || !d?.currency || !d?.orderId || !d?.sign) {
      return NextResponse.json({ error: "Bad callback" }, { status: 400 });
    }

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID;
    const P24_POS_ID = process.env.P24_POS_ID;
    const P24_CRC_KEY = process.env.P24_CRC_KEY;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      console.error("P24 callback: missing configuration");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const merchantId = Number(P24_MERCHANT_ID);
    const posId = Number(P24_POS_ID);
    if (!Number.isFinite(merchantId) || !Number.isFinite(posId)) {
      console.error("P24 callback: invalid merchant configuration");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const sessionId = String(d.sessionId);
    const currency = String(d.currency);
    const orderIdRaw = d.orderId;
    const amount = Number(d.amount);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }


    // weryfikacja podpisu notyfikacji
    const expected = p24SignVerifyMD5(
      sessionId,
      String(orderIdRaw),
      amount,
      currency,
      P24_CRC_KEY,
    );
    if (expected !== String(d.sign)) {
      console.error("P24 sign mismatch");
      return NextResponse.json({ error: "Invalid sign" }, { status: 400 });
    }

    // verify call (wymagane przez P24)
    const orderIdNumber = Number(orderIdRaw);
    const verifyBody = {
      merchantId,
      posId,
      sessionId,
      amount,
      currency,
      orderId: Number.isFinite(orderIdNumber) ? orderIdNumber : String(orderIdRaw),
      sign: expected,
    };

    const res = await fetch(`${P24_BASE}/api/v1/transaction/verify`, {
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
   const orderId = extractOrderId(sessionId);
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
  } catch (error: unknown) {
    console.error("P24 callback error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
