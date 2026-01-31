export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient<Database>(url, key, { auth: { persistSession: false, detectSessionInUrl: false } });
};

function parseDate(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET() {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("discount_codes")
    .select(
      "id, code, type, value, active, public, auto_apply, min_order, max_uses, per_user_max_uses, used_count, starts_at, expires_at"
    )
    .order("code", { ascending: true });

  if (error) {
    console.error("[discount-codes] GET error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const autoApply = !!body.auto_apply;
  let rawCode: string = (body.code || "").trim();

  if (!rawCode) {
    if (autoApply) {
      // wewnętrzny kod dla promocji bez kodu (użytkownik go nie widzi)
      rawCode = `AUTO_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    } else {
      return NextResponse.json({ error: "Kod jest wymagany." }, { status: 400 });
    }
  }

  const code = rawCode.toUpperCase();
  const type: "amount" | "percent" = body.type === "amount" ? "amount" : "percent";
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Nieprawidłowa wartość rabatu." }, { status: 400 });
  }

  const min_order =
    body.min_order === "" || body.min_order == null
      ? null
      : Number(body.min_order);

  const max_uses =
    body.max_uses === "" || body.max_uses == null
      ? null
      : Number(body.max_uses);

  const per_user_max_uses =
    body.per_user_max_uses === "" || body.per_user_max_uses == null
      ? null
      : Number(body.per_user_max_uses);

  const starts_at = parseDate(body.starts_at);
  const expires_at = parseDate(body.expires_at);

  const active = Boolean(body.active ?? true);
  const isPublic = Boolean(body.public ?? true);

  const row: any = {
    code,
    type,
    value,
    active,
    public: isPublic,
    auto_apply: autoApply,
    min_order,
    max_uses,
    per_user_max_uses,
    starts_at,
    expires_at,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("discount_codes")
    .insert(row)
    .select(
      "id, code, type, value, active, public, auto_apply, min_order, max_uses, per_user_max_uses, used_count, starts_at, expires_at"
    )
    .single();

  if (error) {
    console.error("[discount-codes] POST error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
