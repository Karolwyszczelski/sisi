export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hostFromEnv, p24SignVerifyMD5, amountToGrosze } from "@/lib/p24";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, P24_MERCHANT_ID, P24_POS_ID } = process.env;
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id) {
      try { id = (await req.json())?.id; } catch {}
    }
    if (!id) return NextResponse.json({ error: "id missing" }, { status: 400 });

    const { data: ord, error } = await supabase
      .from("orders")
      .select("id,total_price,p24_session_id,p24_order_id,payment_status")
      .eq("id", id)
      .maybeSingle();

    if (error || !ord) return NextResponse.json({ error: "order not found" }, { status: 404 });

    // bez order_id P24 nie zweryfikuje transakcji (klasyczne /trnVerify)
    if (!ord.p24_order_id || !ord.p24_session_id) {
      return NextResponse.json({
        payment_status: ord.payment_status,
        reason: "missing-p24-order-or-session",
      });
    }

    const amountGr = amountToGrosze(ord.total_price || 0);
    const sign = p24SignVerifyMD5({
      sessionId: String(ord.p24_session_id),
      orderId: String(ord.p24_order_id),
      amount: amountGr,
      currency: "PLN",
    });

    const host = hostFromEnv();
    const body = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID || "").trim(),
      p24_pos_id: String(P24_POS_ID || "").trim(),
      p24_session_id: String(ord.p24_session_id),
      p24_amount: String(amountGr),
      p24_currency: "PLN",
      p24_order_id: String(ord.p24_order_id),
      p24_sign: sign,
    });

    const r = await fetch(`https://${host}/trnVerify`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const t = await r.text();
    const ok = (r.ok && /error=0/.test(t)) || (r.ok && (() => { try { return JSON.parse(t)?.data?.status === "success"; } catch { return false; } })());

    if (ok) {
      await supabase.from("orders")
        .update({ payment_status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id);
      return NextResponse.json({ payment_status: "paid" });
    }

    // nie zmieniaj na failed jeśli P24 zwraca błąd tymczasowy
    return NextResponse.json({ payment_status: ord.payment_status ?? "pending", raw: t }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
