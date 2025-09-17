// src/app/api/payments/create-transaction/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { amountToGrosze, hostFromEnv, p24SignRegisterMD5 } from "@/lib/p24";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { orderId, email, customerName } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "Brak orderId." }, { status: 400 });
    }

    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id,total_price")
      .eq("id", orderId)
      .single();
    if (ordErr || !order) {
      return NextResponse.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
    }

    const amountGr = amountToGrosze(order.total_price || 0);

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID = process.env.P24_POS_ID!;
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      return NextResponse.json(
        { error: "Brak P24_MERCHANT_ID/P24_POS_ID/P24_CRC_KEY." },
        { status: 500 }
      );
    }

    const host = hostFromEnv(); // secure.przelewy24.pl lub sandbox.przelewy24.pl
    const sessionId = `sisi-${orderId}`;

    const baseUrlRaw =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://www.sisiciechanow.pl";
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");

    const returnUrl = new URL("/pickup-order", baseUrl);
    returnUrl.searchParams.set("id", String(orderId));
    const p24_url_return = returnUrl.toString();
    const p24_url_status = `${baseUrl}/api/p24/callback`;

    const p24_sign = p24SignRegisterMD5(
      sessionId,
      P24_MERCHANT_ID,
      amountGr,
      "PLN",
      P24_CRC_KEY
    );

    const payload = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: sessionId,
      p24_amount: String(amountGr),
      p24_currency: "PLN",
      p24_description: `Zamówienie #${orderId}`,
      p24_email: email || "",
      p24_client: customerName || "",
      p24_country: "PL",
      p24_language: "pl",
      p24_url_return,
      p24_url_status,
      p24_api_version: "3.2",
      p24_sign,
    });

    const res = await fetch(`https://${host}/trnRegister`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });

    const text = await res.text();
    let p24Token = "";
    try {
      const j = JSON.parse(text);
      p24Token = j?.data?.token || j?.token || "";
    } catch {
      const qs = new URLSearchParams(text);
      p24Token = qs.get("token") || "";
    }
    if (!res.ok || !p24Token) {
      console.error("P24 trnRegister error:", text);
      return NextResponse.json(
        { error: "Rejestracja transakcji nie powiodła się." },
        { status: 502 }
      );
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "pending",
        payment_method: "Online",
        p24_session_id: sessionId,
        p24_token: p24Token, // zapisujemy token z P24
      })
      .eq("id", orderId);

    const paymentUrl = `https://${host}/trnRequest/${p24Token}`;
    return NextResponse.json({
      paymentUrl,
      returnUrl: p24_url_return,
      token: p24Token,
    });
  } catch (e: unknown) {
    console.error("[P24_CREATE_TRANSACTION_ERROR]", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
