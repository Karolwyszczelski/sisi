// src/app/api/promo/validate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const codeRaw = String(body.code || "").trim();
  const total = Number(body.total || 0);
  const userId: string | null = body.userId ? String(body.userId) : null;
  const emailLower: string | null = body.email ? String(body.email).toLowerCase() : null;

  if (!codeRaw) {
    return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });
  }

  const now = new Date().toISOString();

  // CITEXT => eq/ilike działa bez rozróżnienia wielkości
  const { data: dc, error: dcErr } = await supabase
    .from("discount_codes")
    .select("id, code, active, starts_at, expires_at, min_order, type, value, max_uses")
    .ilike("code", codeRaw)
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .maybeSingle();

  if (dcErr) {
    return NextResponse.json({ valid: false, message: "Błąd bazy." }, { status: 500 });
  }
  if (!dc) {
    return NextResponse.json({ valid: false, message: "Kod nieprawidłowy lub nieaktywny." }, { status: 404 });
  }

  if (typeof dc.min_order === "number" && total < Number(dc.min_order)) {
    return NextResponse.json(
      { valid: false, message: `Minimalna wartość zamówienia to ${Number(dc.min_order).toFixed(2)} zł.` },
      { status: 400 }
    );
  }

  // jednorazowość po użytkowniku
  if (userId) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .eq("user_id", userId);
    if ((count || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // jednorazowość po e-mailu (kolumna CITEXT: email_lower)
  if (emailLower) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .eq("email_lower", emailLower);
    if ((count || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // globalny limit
  if (dc.max_uses !== null) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code);
    if ((count || 0) >= Number(dc.max_uses)) {
      return NextResponse.json({ valid: false, message: "Limit użyć kodu został wyczerpany." }, { status: 400 });
    }
  }

  const type: "amount" | "percent" = dc.type === "amount" ? "amount" : "percent";
  const value = Number(dc.value || 0);
  if (value <= 0) {
    return NextResponse.json({ valid: false, message: "Nieprawidłowa wartość kodu." }, { status: 400 });
  }

  return NextResponse.json({ valid: true, code: dc.code, type, value });
}
