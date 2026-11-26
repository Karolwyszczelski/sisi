export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  hostFromEnv,
  p24SignVerifyMD5,
  parseP24Amount,
} from "@/lib/p24";
import { confirmVerifiedP24 } from "@/lib/orderLifecycle";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

let _supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = getSupabaseAdmin();
    return (_supabaseAdmin as any)[prop];
  },
});


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
    const currency = b.p24_currency || b.currency || "";
    const sign = b.p24_sign || b.sign;

    if (!sessionId || !orderIdFromGateway || amountGr === null || !sign) {
      return NextResponse.json({ error: "Bad payload" }, { status: 400 });
    }

    // weryfikacja podpisu z notyfikacji
    if (currency !== "PLN" || amountGr <= 0) return NextResponse.json({ error: "Invalid payment amount or currency" }, { status: 400 });

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
      (vr.ok && new URLSearchParams(vtxt).get("error") === "0") ||
      (vr.ok && (() => { try { const j = JSON.parse(vtxt); return j?.data?.status === "success"; } catch { return false; } })());

    if (!ok) return NextResponse.json({ ok: false }, { status: 400 });

    const outcome = await confirmVerifiedP24(supabaseAdmin, {
      sessionId: String(sessionId), gatewayOrderId: String(orderIdFromGateway), amountGrosze: amountGr,
    }, new URL(req.url).origin);
    return NextResponse.json({ ok: outcome !== "mismatch" }, { status: outcome === "mismatch" ? 409 : 200 });
  } catch (e: any) {
    console.error("[P24_WEBHOOK_ERROR]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
