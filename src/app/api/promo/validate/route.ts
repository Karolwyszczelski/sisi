export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // tylko backend
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } 
  catch { return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 }); }

  const rawCode = String(body.code || "").trim();
  const code = rawCode; // jeśli nie masz CITEXT, zamień linijkę na: const code = rawCode;
  const total = Number(body.total || 0);
  const userId = body.userId ? String(body.userId) : null;
  const emailLower = body.email ? String(body.email).toLowerCase() : null;

  if (!code) return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });

  // 1) Pobierz kod
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("active", true)
    // jeśli masz CITEXT na kolumnie 'code', użyj eq. Jeśli nie, zmień na .ilike("code", code)
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });
  }

  // 2) Okno czasowe i minimum
  const now = new Date().toISOString();
  if (data.starts_at && data.starts_at > now) {
    return NextResponse.json({ valid: false, message: "Kod jeszcze nieaktywny." }, { status: 400 });
  }
  if (data.expires_at && data.expires_at < now) {
    return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });
  }
  if (typeof data.min_order === "number" && total < data.min_order) {
    return NextResponse.json(
      { valid: false, message: `Minimalna wartość zamówienia to ${Number(data.min_order).toFixed(2)} zł.` },
      { status: 400 }
    );
  }

  // 3) Jednorazowość dla zalogowanego
  if (userId) {
    const { count: usedByUser, error: e1 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", data.code)
      .eq("user_id", userId);
    if (!e1 && (usedByUser || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // 4) Jednorazowość dla niezalogowanego po emailu (case-insensitive, bez kolumny email_lower)
  if (emailLower) {
    const { count: usedByEmail, error: e2 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", data.code)
      .filter("lower(email)", "eq", emailLower);
    if (!e2 && (usedByEmail || 0) > 0) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // 5) Limit globalny po realnych zużyciach (nie po used_count)
  if (data.max_uses !== null) {
    const { count: totalUsed, error: e3 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", data.code);
    if (!e3 && (totalUsed || 0) >= Number(data.max_uses)) {
      return NextResponse.json({ valid: false, message: "Limit użyć kodu został wyczerpany." }, { status: 400 });
    }
  }

  // 6) Wartość
  const type: "amount" | "percent" = data.type === "amount" ? "amount" : "percent";
  const value = Number(data.value || 0);
  if (value <= 0) return NextResponse.json({ valid: false, message: "Nieprawidłowa wartość kodu." }, { status: 400 });

  return NextResponse.json({ valid: true, code: data.code, type, value });
}
