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
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 }); }

  const codeRaw = String(body.code || "").trim();
  const total = Number(body.total || 0);
  const userId = body.userId ? String(body.userId) : null;
  const emailLower = body.email ? String(body.email).toLowerCase() : null;

  if (!codeRaw) {
    return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });
  }

  // discount_codes.code = CITEXT → eq działa case-insensywnie
  const { data: dc, error: dcErr } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("active", true)
    .eq("code", codeRaw)
    .maybeSingle();

  if (dcErr || !dc) {
    return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (dc.starts_at && dc.starts_at > now) return NextResponse.json({ valid: false, message: "Kod jeszcze nieaktywny." }, { status: 400 });
  if (dc.expires_at && dc.expires_at < now) return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });
  if (typeof dc.min_order === "number" && total < dc.min_order) {
    return NextResponse.json({ valid: false, message: `Minimalna wartość zamówienia to ${Number(dc.min_order).toFixed(2)} zł.` }, { status: 400 });
  }

  // 1) per-user
  if (userId) {
    const { count: c1, error: e1 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .eq("user_id", userId);
    if (!e1 && (c1 || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // 2) per-email (case-insensitive, bez lower())
  if (emailLower) {
    const { count: c2, error: e2 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .ilike("email", emailLower); // brak wildcardów → równość bez rozróżniania wielkości
    if (!e2 && (c2 || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // 3) globalny limit po faktycznych zużyciach
  if (dc.max_uses !== null) {
    const { count: cAll, error: e3 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code);
    if (!e3 && (cAll || 0) >= Number(dc.max_uses)) {
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
