// src/app/api/payments/p24/refresh/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hostFromEnv, p24SignVerifyMD5, parseP24Amount } from "@/lib/p24";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: o, error } = await supabase
    .from("orders")
    .select("id,total_price,p24_session_id,p24_order_id,payment_status,payment_method")
    .eq("id", id)
    .maybeSingle();

  if (error || !o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (o.payment_method !== "Online") return NextResponse.json({ payment_status: o.payment_status ?? null });

  if (!o.p24_session_id || !o.p24_order_id) {
    // bez order_id klasyczny /trnVerify nie zadziała
    return NextResponse.json({ payment_status: o.payment_status ?? null, note: "missing_p24_ids" }, { status: 202 });
  }

  const amountGr = parseP24Amount(o.total_price, "PLN");
  const sign = p24SignVerifyMD5({ sessionId: o.p24_session_id, orderId: String(o.p24_order_id), amount: amountGr, currency: "PLN" });

  const body = new URLSearchParams({
    p24_merchant_id: String(process.env.P24_MERCHANT_ID),
    p24_pos_id: String(process.env.P24_POS_ID),
    p24_session_id: String(o.p24_session_id),
    p24_amount: String(amountGr),
    p24_currency: "PLN",
    p24_order_id: String(o.p24_order_id),
    p24_sign: String(sign),
  });

  const host = hostFromEnv();
  const r = await fetch(`https://${host}/trnVerify`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const t = await r.text();
  const ok = (r.ok && /error=0/.test(t)) || (r.ok && (() => { try { return JSON.parse(t)?.data?.status === "success"; } catch { return false; } })());

  if (ok) {
    const { data: upd } = await supabase.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", o.id).select().maybeSingle();
    return NextResponse.json({ payment_status: upd?.payment_status ?? "paid" });
  }

  return NextResponse.json({ payment_status: o.payment_status ?? null });
}
