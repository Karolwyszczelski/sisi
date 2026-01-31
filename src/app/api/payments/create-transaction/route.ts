// src/app/api/payments/create-transaction/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { amountToGrosze, hostFromEnv, p24SignRegisterMD5 } from "@/lib/p24";

// Lazy initialization - klient tworzony dopiero przy pierwszym użyciu
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function POST(req: Request) {
  const supabase = getSupabase();
  try {
    // przyjmij body lub query; tylko orderId jest wymagane
    let body: any = {};
    try { body = await req.json(); } catch {}
    const url = new URL(req.url);
    const orderId =
      body?.orderId ??
      body?.id ??
      url.searchParams.get("orderId") ??
      url.searchParams.get("id");

    const email = String(body?.email ?? "");
    const customerName = String(body?.customerName ?? "");

    if (!orderId) return NextResponse.json({ error: "orderId missing" }, { status: 400 });

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,total_price")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) return NextResponse.json({ error: "order not found" }, { status: 404 });

    const { P24_MERCHANT_ID, P24_POS_ID, P24_CRC_KEY, APP_BASE_URL, NEXT_PUBLIC_BASE_URL } = process.env;
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY)
      return NextResponse.json({ error: "P24 env missing" }, { status: 500 });

    // kwotę bierzemy TYLKO z DB
    const amountGr = amountToGrosze(order.total_price || 0);
    const sessionId = `sisi-${orderId}`;
    const baseUrl = (APP_BASE_URL || NEXT_PUBLIC_BASE_URL || "https://www.sisiciechanow.pl").replace(/\/+$/, "");
    const host = hostFromEnv();

    const p24_url_return = `${baseUrl}/pickup-order?id=${orderId}`;
    const p24_url_status = `${baseUrl}/api/p24/callback`;

    const p24_sign = p24SignRegisterMD5(sessionId, P24_MERCHANT_ID, amountGr, "PLN", P24_CRC_KEY);

    const payload = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: sessionId,
      p24_amount: String(amountGr),
      p24_currency: "PLN",
      p24_description: `Zamówienie #${orderId}`,
      p24_email: email,
      p24_client: customerName,
      p24_country: "PL",
      p24_language: "pl",
      p24_url_return,
      p24_url_status,
      p24_api_version: "3.2",
      p24_sign,
    });

    const resp = await fetch(`https://${host}/trnRegister`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });

    const text = await resp.text();
    let p24Token = "";
    try { p24Token = JSON.parse(text)?.data?.token || JSON.parse(text)?.token || ""; }
    catch { p24Token = new URLSearchParams(text).get("token") || ""; }

    if (!resp.ok || !p24Token) {
      console.error("trnRegister fail", { status: resp.status, text });
      return NextResponse.json({ error: "trnRegister failed" }, { status: 502 });
    }

    await supabase
      .from("orders")
      .update({
        payment_method: "Online",
        payment_status: "pending",
        p24_session_id: sessionId,
        p24_token: p24Token,
      })
      .eq("id", orderId);

    const paymentUrl = `https://${host}/trnRequest/${p24Token}`;
    return NextResponse.json({ paymentUrl, token: p24Token, returnUrl: p24_url_return });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
