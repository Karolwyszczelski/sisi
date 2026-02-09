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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

  const updates: any = {};

  if (typeof body.code === "string") {
    const code = body.code.trim();
    if (!code) {
      return NextResponse.json({ error: "Kod nie może być pusty." }, { status: 400 });
    }
    updates.code = code.toUpperCase();
  }

  if (body.type != null) {
    updates.type = body.type === "amount" ? "amount" : "percent";
  }

  if (body.value != null) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ error: "Nieprawidłowa wartość rabatu." }, { status: 400 });
    }
    updates.value = v;
  }

  if (body.min_order !== undefined) {
    updates.min_order =
      body.min_order === "" || body.min_order == null ? null : Number(body.min_order);
  }

  if (body.max_uses !== undefined) {
    updates.max_uses =
      body.max_uses === "" || body.max_uses == null ? null : Number(body.max_uses);
  }

  if (body.per_user_max_uses !== undefined) {
    updates.per_user_max_uses =
      body.per_user_max_uses === "" || body.per_user_max_uses == null
        ? null
        : Number(body.per_user_max_uses);
  }

  if (body.starts_at !== undefined) {
    updates.starts_at = parseDate(body.starts_at);
  }

  if (body.expires_at !== undefined) {
    updates.expires_at = parseDate(body.expires_at);
  }

  if (body.active !== undefined) {
    updates.active = Boolean(body.active);
  }

  if (body.public !== undefined) {
    updates.public = Boolean(body.public);
  }

  if (body.auto_apply !== undefined) {
    updates.auto_apply = Boolean(body.auto_apply);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("discount_codes")
    .update(updates)
    .eq("id", params.id)
    .select(
      "id, code, type, value, active, public, auto_apply, min_order, max_uses, per_user_max_uses, used_count, starts_at, expires_at"
    )
    .single();

  if (error) {
    console.error("[discount-codes] PATCH error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

// DELETE = trwałe usunięcie kodu rabatowego
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await getSupabaseAdmin()
    .from("discount_codes")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[discount-codes] DELETE error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
