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
  try { body = await req.json(); } catch {
    return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 });
  }

  const code = String(body.code || "").trim();
  const total = Number(body.total || 0);
  const userId = body.userId ? String(body.userId) : null;
  const emailLower = body.email ? String(body.email).toLowerCase() : null;

  if (!code) return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .ilike("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });

  const now = new Date().toISOString();
  if (data.starts_at && data.starts_at > now) return NextResponse.json({ valid: false, message: "Kod jeszcze nieaktywny." }, { status: 400 });
  if (data.expires_at && data.expires_at < now) return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });

  if (typeof data.min_order === "number" && total < data.min_order) {
    return NextResponse.json({ valid: false, message: `Minimalna wartość zamówienia to ${Number(data.min_order).toFixed(2)} zł.` }, { status: 400 });
  }

  // 🔒 PER-USER / PER-EMAIL — od razu uprzedzamy użytkownika
  if (userId) {
    const { data: r1 } = await supabase
      .from("discount_redemptions")
      .select("id")
      .eq("code", data.code)
      .eq("user_id", userId)
      .limit(1);
    if (r1 && r1.length) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }
  if (emailLower) {
    const { data: r2 } = await supabase
      .from("discount_redemptions")
      .select("id")
      .eq("code", data.code)
      .eq("email_lower", emailLower)
      .limit(1);
    if (r2 && r2.length) {
      return NextResponse.json({ valid: false, message: "Kod został już przez Ciebie wykorzystany." }, { status: 400 });
    }
  }

  // (opcjonalny) globalny CAP tylko jeśli faktycznie chcesz go używać
  if (data.max_uses !== null && Number(data.used_count || 0) >= Number(data.max_uses)) {
    return NextResponse.json({ valid: false, message: "Limit użyć kodu został wyczerpany." }, { status: 400 });
  }

  const type = data.type === "amount" ? "amount" : "percent";
  const value = Number(data.value || 0);
  if (value <= 0) return NextResponse.json({ valid: false, message: "Nieprawidłowa wartość kodu." }, { status: 400 });

  return NextResponse.json({ valid: true, code: data.code, type, value });
}
