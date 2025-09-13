// src/app/api/payments/create-transaction/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { orderId, amount, email, customerName } = await request.json();

    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID      = process.env.P24_POS_ID!;
    const P24_CRC_KEY     = process.env.P24_CRC_KEY!;
    const P24_ENV         = (process.env.P24_ENV || "sandbox").toLowerCase();

    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY) {
      throw new Error("Brak P24_MERCHANT_ID / P24_POS_ID / P24_CRC_KEY.");
    }

    const host =
      P24_ENV === "prod" ? "secure.przelewy24.pl" : "sandbox.przelewy24.pl";

    const sessionId = `${orderId}-${Date.now()}`.slice(0, 100);
    const amountInGrosz = Math.max(1, Math.round(Number(amount) * 100));

    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://www.sisiciechanow.pl";

    // klasyczny sign: md5(sessionId|merchantId|amount|currency|crc)
    const p24_sign = crypto
      .createHash("md5")
      .update(
        `${sessionId}|${P24_MERCHANT_ID}|${amountInGrosz}|PLN|${P24_CRC_KEY}`
      )
      .digest("hex");

    const payload = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: sessionId,
      p24_amount: String(amountInGrosz),
      p24_currency: "PLN",
      p24_description: `Zamówienie #${orderId}`,
      p24_email: email || "",
      p24_client: customerName || "",
      p24_country: "PL",
      p24_language: "pl",
      p24_url_return: `${baseUrl}/order/success?orderId=${orderId}`,
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
    // Spróbuj JSON, w razie czego querystring
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

    const paymentUrl = `https://${host}/trnRequest/${token}`;
    return NextResponse.json({ paymentUrl });
  } catch (e: any) {
    console.error("[P24_CREATE_TRANSACTION_CLASSIC_ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
