// src/app/api/p24/reconcile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { hostFromEnv, p24SignVerifyMD5, parseP24Amount } from "@/lib/p24";

const { P24_MERCHANT_ID, P24_POS_ID, CRON_SECRET } = process.env;

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

let _supabase: ReturnType<typeof getSupabase> | null = null;
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) {
    if (!_supabase) _supabase = getSupabase();
    return (_supabase as any)[prop];
  },
});

export async function GET(req: NextRequest) {
  // auth: Bearer <CRON_SECRET> lub ?token=<CRON_SECRET>
  const auth = headers().get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = new URL(req.url).searchParams.get("token");
  if (CRON_SECRET && auth !== CRON_SECRET && token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!P24_MERCHANT_ID || !P24_POS_ID) {
    return NextResponse.json({ error: "P24 env missing" }, { status: 500 });
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,total_price,p24_session_id,p24_order_id,payment_status,payment_method")
    .eq("payment_method", "Online")
    .eq("payment_status", "pending")
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = hostFromEnv();
  const results: Record<string, string> = {};

  for (const o of orders ?? []) {
    const sessionId = o.p24_session_id;
    const orderId = o.p24_order_id;
    if (!sessionId || !orderId) {
      results[o.id] = "skip-missing-ids";
      continue;
    }

    const amountGr = parseP24Amount(o.total_price, "PLN");
    const sign = p24SignVerifyMD5({
      sessionId,
      orderId: String(orderId),
      amount: amountGr,
      currency: "PLN",
    });

    const body = new URLSearchParams({
      p24_merchant_id: String(P24_MERCHANT_ID),
      p24_pos_id: String(P24_POS_ID),
      p24_session_id: String(sessionId),
      p24_amount: String(amountGr),
      p24_currency: "PLN",
      p24_order_id: String(orderId),
      p24_sign: String(sign),
    });

    try {
      const r = await fetch(`https://${host}/trnVerify`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const t = await r.text();

      const ok =
        (r.ok && /error=0/.test(t)) ||
        (r.ok &&
          (() => {
            try {
              return JSON.parse(t)?.data?.status === "success";
            } catch {
              return false;
            }
          })());

      if (ok) {
        await supabase
          .from("orders")
          .update({ payment_status: "paid", paid_at: new Date().toISOString() })
          .eq("id", o.id);
        results[o.id] = "paid";
      } else {
        results[o.id] = "no-change";
      }
    } catch (e) {
      results[o.id] = "verify-error";
    }
  }

  return NextResponse.json({ ok: true, results });
}
