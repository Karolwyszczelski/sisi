export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  amountToGrosze,
  hostFromEnv,
  p24SignRegisterMD5,
} from "@/lib/p24";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { orderId, email, customerName } = await request.json();
    if (!orderId) throw new Error("Brak orderId.");

    // Kwota tylko z DB
    const { data: order, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id,total_price")
      .eq("id", orderId)
      .single();
    if (ordErr || !order) throw new Error("Nie znaleziono zamówienia.");

    const amountGr = amountToGrosze(order.total_price || 0);

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID = process.env.P24_POS_ID!;
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      throw new Error("Brak P24_MERCHANT_ID / P24_POS_ID / P24_CRC_KEY.");
    }

    const host = hostFromEnv();
    // stały, deterministyczny sessionId dla zamówienia
    const sessionId = `sisi-${orderId}`;

    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://www.sisiciechanow.pl";

    // UWAGA: masz stronę /orders/success
    const p24_url_return = `${baseUrl}/orders/success?orderId=${orderId}`;

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
      p24_url_status: `${baseUrl}/api/payments/webhook`,
      p24_api_version: "3.2",
      p24_sign,
    });

    const res = await fetch(`https://${host}/trnRegister`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });

    const text = await res.text();
    let token = "";
    try {
      const j = JSON.parse(text);
      token = j?.data?.token || j?.token || "";
    } catch {
      const qs = new URLSearchParams(text);
      token = qs.get("token") || "";
    }
    if (!res.ok || !token) {
      console.error("P24 trnRegister error:", text);
      throw new Error("Rejestracja transakcji nie powiodła się.");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        status: "pending",
        payment_status: "pending",
        payment_method: "Online",
        p24_session_id: sessionId,
        p24_token: token,
      })
      .eq("id", orderId);

    const paymentUrl = `https://${host}/trnRequest/${token}`;
    return NextResponse.json({ paymentUrl });
  } catch (e: any) {
    console.error("[P24_CREATE_TRANSACTION_ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
