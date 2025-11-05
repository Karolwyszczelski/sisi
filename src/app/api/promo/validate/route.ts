// src/app/api/promo/validate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // SERVICE ROLE
  { auth: { persistSession: false } }
);

// bezpieczny parser timestamp( tz | no tz )
function parsePgTs(v?: string | null): Date | null {
  if (!v) return null;
  // jeśli brak strefy, traktuj jako UTC
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(v);
  const iso = hasTZ ? v : v.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isFinite(+d) ? d : null;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, message: "Invalid JSON" }, { status: 400 });
  }

  const code = String(body.code || "").trim();
  const total = Number(body.total || 0);
  const userId = body.userId ? String(body.userId) : null;
  const emailLower = body.email ? String(body.email).toLowerCase() : null;

  if (!code) {
    return NextResponse.json({ valid: false, message: "Brak kodu." }, { status: 400 });
  }

  // CITEXT → zwykłe .eq wystarczy, bez ILIKE
  const { data: dc, error: dcErr } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("active", true)
    .eq("code", code)
    .maybeSingle();

  if (dcErr || !dc) {
    return NextResponse.json({ valid: false, message: "Kod nieprawidłowy." }, { status: 404 });
  }

  // okno czasowe i minimum
  const now = new Date();
  const startsAt = parsePgTs(dc.starts_at);
  const expiresAt = parsePgTs(dc.expires_at);

  if (startsAt && startsAt > now) {
    return NextResponse.json({ valid: false, message: "Kod jeszcze nieaktywny." }, { status: 400 });
  }
  if (expiresAt && expiresAt < now) {
    return NextResponse.json({ valid: false, message: "Kod wygasł." }, { status: 400 });
  }

  const minOrder = dc.min_order === null ? null : Number(dc.min_order);
  if (minOrder !== null && total < minOrder) {
    return NextResponse.json(
      { valid: false, message: `Minimalna wartość zamówienia to ${minOrder.toFixed(2)} zł.` },
      { status: 400 }
    );
  }

  // jednorazowość po user_id
  if (userId) {
    const { count: c1, error: e1 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .eq("user_id", userId);

    if (e1) {
      return NextResponse.json({ valid: false, message: "Błąd weryfikacji użytkownika." }, { status: 500 });
    }
    if ((c1 || 0) > 0) {
      return NextResponse.json(
        { valid: false, message: "Kod został już przez Ciebie wykorzystany." },
        { status: 400 }
      );
    }
  }

  // jednorazowość po e-mailu, obsłuż zarówno email_lower jak i email
  if (emailLower) {
    const orExpr = `email.eq.${emailLower},email_lower.eq.${emailLower}`;
    const { count: c2, error: e2 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code)
      .or(orExpr);

    if (e2) {
      return NextResponse.json({ valid: false, message: "Błąd weryfikacji e-mail." }, { status: 500 });
    }
    if ((c2 || 0) > 0) {
      return NextResponse.json(
        { valid: false, message: "Kod został już przez Ciebie wykorzystany." },
        { status: 400 }
      );
    }
  }

  // limit globalny (NULL lub 0 = bez limitu)
  const maxUses = dc.max_uses === null ? null : Number(dc.max_uses);
  if (maxUses && maxUses > 0) {
    const { count: cAll, error: e3 } = await supabase
      .from("discount_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code", dc.code);

    if (e3) {
      return NextResponse.json({ valid: false, message: "Błąd weryfikacji limitu." }, { status: 500 });
    }
    if ((cAll || 0) >= maxUses) {
      return NextResponse.json(
        { valid: false, message: "Limit użyć kodu został wyczerpany." },
        { status: 400 }
      );
    }
  }

  // wartość kodu
  const type: "amount" | "percent" = dc.type === "amount" ? "amount" : "percent";
  const value = Number(dc.value || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ valid: false, message: "Nieprawidłowa wartość kodu." }, { status: 400 });
  }

  return NextResponse.json({ valid: true, code: dc.code, type, value });
}
