// src/app/api/promo/validate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // service role, bez RLS
  { auth: { persistSession: false } }
);

type DcRow = {
  code: string;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  min_order: number | null;
  max_uses: number | null;
  type: "percent" | "amount";
  value: number;
};

export async function POST(req: Request) {
  // 1) parse
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 }); }

  const code = String(body.code ?? "").trim();
  const total = Number(body.total ?? 0);
  const userId = body.userId ? String(body.userId) : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;

  if (!code) return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });

  // 2) znajdź kod (CITEXT → używamy eq)
  const { data: dc, error: dcErr } = await supabase
    .from("discount_codes")
    .select("code, active, starts_at, expires_at, min_order, max_uses, type, value")
    .eq("code", code)
    .single<DcRow>();

  if (dcErr || !dc) return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });
  if (!dc.active) return NextResponse.json({ valid: false, message: "Kod jest wyłączony." }, { status: 400 });

  const now = new Date();
  if (dc.starts_at && new Date(dc.starts_at) > now)
    return NextResponse.json({ valid: false, message: "Kod jeszcze nieaktywny." }, { status: 400 });
  if (dc.expires_at && new Date(dc.expires_at) < now)
    return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });

  if (typeof dc.min_order === "number" && total < Number(dc.min_order)) {
    return NextResponse.json(
      { valid: false, message: `Minimalna wartość zamówienia to ${Number(dc.min_order).toFixed(2)} zł.` },
      { status: 400 }
    );
  }

  // 3) jednorazowość per user
  if (userId) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)         // jeśli masz kolumnę code_id → zamień na .eq("code_id", dc.id)
      .eq("user_id", userId);
    if ((count ?? 0) > 0)
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
  }

  // 4) jednorazowość per email (obsługuje email_lower lub email)
  if (email) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .or(`email_lower.eq.${email},email.eq.${email}`);
    if ((count ?? 0) > 0)
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
  }

  // 5) globalny limit
  if (dc.max_uses !== null) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code);
    if ((count ?? 0) >= Number(dc.max_uses))
      return NextResponse.json({ valid: false, message: "Limit użyć kodu został wyczerpany." }, { status: 400 });
  }

  // OK
  return NextResponse.json({ valid: true, code: dc.code, type: dc.type, value: Number(dc.value) });
}
