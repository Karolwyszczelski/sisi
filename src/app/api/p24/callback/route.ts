export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hostFromEnv, p24SignVerifyMD5, parseP24Amount } from "@/lib/p24";
import { kickOrderJobs } from "@/lib/kickOrderJobs";
import { confirmVerifiedP24 } from "@/lib/orderLifecycle";

const { P24_MERCHANT_ID, P24_POS_ID } = process.env;

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

type P24Fields = {
  sessionId?: string; p24_session_id?: string;
  amount?: string | number; p24_amount?: string | number;
  currency?: string; p24_currency?: string;
  orderId?: string | number; p24_order_id?: string | number;
};


function pick(v: any, ...keys: string[]) {
  for (const k of keys) {
    const x = v?.[k];
    if (x !== undefined && x !== null && String(x).length) return x;
  }
  return undefined;
}

async function readBodyOrQuery(req: NextRequest): Promise<P24Fields> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const txt = await req.text();
    const params = new URLSearchParams(txt);
    const o: Record<string, any> = {};
    params.forEach((v, k) => (o[k] = v));
    return o as P24Fields;
  }
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const o: Record<string, any> = {};
    for (const [k, v] of fd.entries()) o[k] = typeof v === "string" ? v : await (v as File).text();
    return o as P24Fields;
  }
  try { return (await req.json()) as any; } catch {}
  const qs = Object.fromEntries(req.nextUrl.searchParams.entries());
  return qs as any;
}

async function handle(req: NextRequest) {
  const MERCH = String(P24_MERCHANT_ID || "").trim();
  const POS = String(P24_POS_ID || "").trim();
  if (!MERCH || !POS) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const raw = await readBodyOrQuery(req);
  const data: any = (raw as any)?.data ?? raw ?? {};

  const sessionId = String(pick(data, "sessionId", "p24_session_id") || "");
  const rawAmount = pick(data, "amount", "p24_amount");
  const currency = String(pick(data, "currency", "p24_currency") || "");
  const orderIdFromGateway = String(pick(data, "orderId", "p24_order_id") || "");

  if (!sessionId || rawAmount === undefined || !orderIdFromGateway) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const amountGr = parseP24Amount(rawAmount, currency);
  if (amountGr === null) return NextResponse.json({ error: "Bad amount" }, { status: 400 });

  if (currency !== "PLN" || amountGr <= 0) return NextResponse.json({ error: "Invalid payment amount or currency" }, { status: 400 });

  const expected = p24SignVerifyMD5({ sessionId, orderId: orderIdFromGateway, amount: amountGr, currency });

  const host = hostFromEnv();
  const verifyBody = new URLSearchParams({
    p24_merchant_id: MERCH,
    p24_pos_id: POS,
    p24_session_id: sessionId,
    p24_amount: String(amountGr),
    p24_currency: currency,
    p24_order_id: orderIdFromGateway,
    p24_sign: expected,
  });

  const res = await fetch(`https://${host}/trnVerify`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyBody.toString(),
  });
  const text = await res.text();

  const ok =
    (res.ok && new URLSearchParams(text).get("error") === "0") ||
    (res.ok && (() => { try { return JSON.parse(text)?.data?.status === "success"; } catch { return false; } })());

  if (!ok) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const { outcome, dispatchOrderId } = await confirmVerifiedP24(supabase, {
      sessionId, gatewayOrderId: orderIdFromGateway, amountGrosze: amountGr,
    });
    if (dispatchOrderId) kickOrderJobs(`pos:${dispatchOrderId}`);
    return NextResponse.json({ ok: outcome !== "mismatch" }, { status: outcome === "mismatch" ? 409 : 200 });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest)  { return handle(req); }
