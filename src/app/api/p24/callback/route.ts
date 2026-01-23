export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractOrderIdFromSession, hostFromEnv, p24SignVerifyMD5, parseP24Amount } from "@/lib/p24";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, P24_MERCHANT_ID, P24_POS_ID, DEBUG_P24 } = process.env;

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

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
  const currency = String(pick(data, "currency", "p24_currency") || "PLN");
  const orderIdFromGateway = String(pick(data, "orderId", "p24_order_id") || "");

  if (DEBUG_P24 === "1") console.log("P24 cb in:", { ct: req.headers.get("content-type"), method: req.method, sessionId, rawAmount, currency, orderIdFromGateway });

  if (!sessionId || rawAmount === undefined || !orderIdFromGateway) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const amountGr = parseP24Amount(rawAmount, currency);
  if (amountGr === null) return NextResponse.json({ error: "Bad amount" }, { status: 400 });

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
  if (DEBUG_P24 === "1") console.log("P24 verify:", { status: res.status, text });

  const ok =
    (res.ok && /error=0/.test(text)) ||
    (res.ok && (() => { try { return JSON.parse(text)?.data?.status === "success"; } catch { return false; } })());

  const orderIdFromSession = extractOrderIdFromSession(sessionId);
  const baseValues: Record<string, unknown> = { p24_session_id: sessionId, p24_order_id: orderIdFromGateway };

  const updateOrderWithFallback = async (values: Record<string, unknown>) => {
    const q1 = await supabase.from("orders").update(values).eq("p24_session_id", sessionId).select().maybeSingle();
    if (q1.error) return "error";
    if (q1.data) return "success";
    if (!orderIdFromSession) return "not-found";
    const q2 = await supabase.from("orders").update(values).eq("id", orderIdFromSession).select().maybeSingle();
    if (q2.error) return "error";
    return q2.data ? "success" : "not-found";
  };

  if (ok) {
    const r = await updateOrderWithFallback({ ...baseValues, payment_status: "paid", paid_at: new Date().toISOString() });
    if (r !== "success") return NextResponse.json({ error: r }, { status: r === "error" ? 500 : 400 });
    return NextResponse.json({ ok: true });
  }

  const rf = await updateOrderWithFallback({ ...baseValues, payment_status: "failed" });
  if (rf !== "success") return NextResponse.json({ ok: false, error: rf }, { status: rf === "error" ? 500 : 400 });
  return NextResponse.json({ ok: false }, { status: 400 });
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest)  { return handle(req); }
