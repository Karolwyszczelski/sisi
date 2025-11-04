// src/app/api/promo/validate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // tylko backend
  { auth: { persistSession: false } }
);

function normPhone(p?: string | null) {
  return (p || "").replace(/\D/g, "");
}
function normEmail(e?: string | null) {
  return (e || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { 
    return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 }); 
  }

  const codeIn = String(body.code || "").trim();
  const total = Number(body.total || 0);
  const userId = body.userId || null;
  const email = normEmail(body.email);
  const phone = normPhone(body.phone);

  if (!codeIn) return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });

  // 1) pobierz kod (aktywny, w oknie czasowym)
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .ilike("code", codeIn)
    .eq("active", true)
    .maybeSingle();

  if (error || !data)
    return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });

  const now = new Date().toISOString();
  if (data.starts_at && data.starts_at > now)
    return NextResponse.json({ valid: false, message: "Kod jeszcze nie aktywny." }, { status: 400 });
  if (data.expires_at && data.expires_at < now)
    return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });

  if (typeof data.min_order === "number" && total < data.min_order) {
    return NextResponse.json({ valid: false, message: `Minimalna wartość zamówienia to ${Number(data.min_order).toFixed(2)} zł.` }, { status: 400 });
  }

  // 2) limit globalny (jeśli ustawiony)
  if (data.max_uses !== null && Number(data.used_count || 0) >= Number(data.max_uses)) {
    return NextResponse.json({ valid: false, message: "Kod został już wykorzystany." }, { status: 400 });
  }

  // 3) jednorazowość per użytkownik (userId/email/phone)
  //    jeśli chcesz, możesz dodać kolumnę "per_user_only boolean" i warunkować to zachowanie
  const code = data.code; // citext

  const { data: alreadyUsedByYou } = await supabase
    .from("discount_code_usages")
    .select("id")
    .or([
      userId ? `and(code.eq.${code},user_id.eq.${userId})` : "and(false)",
      email ? `and(code.eq.${code},email.eq.${email})` : "and(false)",
      phone ? `and(code.eq.${code},phone.eq.${phone})` : "and(false)",
    ].join(",")) // OR
    .limit(1)
    .maybeSingle();

  if (alreadyUsedByYou) {
    return NextResponse.json({ valid: false, message: "Ten kod został już przez Ciebie użyty." }, { status: 400 });
  }

  const type = data.type === "amount" ? "amount" : "percent";
  const value = Number(data.value || 0);
  if (value <= 0) return NextResponse.json({ valid: false, message: "Nieprawidłowa wartość kodu." }, { status: 400 });

  return NextResponse.json({ valid: true, code, type, value });
}
