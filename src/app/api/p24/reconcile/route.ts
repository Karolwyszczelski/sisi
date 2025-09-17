// src/app/api/p24/reconcile/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hostFromEnv, p24SignVerifyMD5, parseP24Amount } from "@/lib/p24";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, P24_MERCHANT_ID, P24_POS_ID } = process.env;
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function GET() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,total_price,p24_session_id,p24_order_id,payment_status")
    .eq("payment_method", "Online")
    .eq("payment_status", "pending")
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = hostFromEnv();
  const results: Record<string,string> = {};

  for (const o of orders ?? []) {
    const sessionId = o.p24_session_id;
    const orderId = o.p24_order_id;
    if (!sessionId || !orderId) continue;

    const amountGr = parseP24Amount(o.total_price, "PLN");
    const sign = p24SignVerifyMD5({ sessionId, orderId: String(orderId), amount: amountGr, currency: "PLN" });

    const body = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: String(sessionId),
      p24_amount: String(amountGr),
      p24_currency: "PLN",
      p24_order_id: String(orderId),
      p24_sign: String(sign),
    });

    const r = await fetch(`https://${host}/trnVerify`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const t = await r.text();
    const ok = (r.ok && /error=0/.test(t)) || (r.ok && (() => { try { return JSON.parse(t)?.data?.status === "success"; } catch { return false; } })());
    if (ok) {
      await supabase.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", o.id);
      results[o.id] = "paid";
    } else {
      results[o.id] = "no-change";
    }
  }
  return NextResponse.json({ ok: true, results });
}
