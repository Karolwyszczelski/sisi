export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy initialization - klient tworzony dopiero przy pierwszym użyciu
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

// GET – odczyt układu
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("table_layout")
    .select("id,name,active,plan,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { layout: data ?? { id: 1, name: "default", active: true, plan: [] } },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

// POST – zapis układu + synchronizacja tabeli restaurant_tables (do rezerwacji)
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const name = String(body?.name ?? "default");
  const active = body?.active !== false;
  const rawPlan: any[] = Array.isArray(body?.plan) ? body.plan : [];

  // normalizacja
  const plan = rawPlan.map((t) => ({
    id: String(t.id ?? crypto.randomUUID()),
    label: String(t.label ?? t.name ?? "Stół"),
    x: Math.max(0, Math.round(Number(t.x ?? 0))),
    y: Math.max(0, Math.round(Number(t.y ?? 0))),
    w: Math.max(44, Math.round(Number(t.w ?? 90))),
    h: Math.max(44, Math.round(Number(t.h ?? 90))),
    rotation: Math.round(Number(t.rotation ?? t.rot ?? 0)),
    capacity: Math.max(1, Math.round(Number(t.capacity ?? t.seats ?? 2))),
    active: Boolean(t.active ?? true),
  }));

  // zapis layoutu (id=1)
  const { data: layout, error: upErr } = await supabase
    .from("table_layout")
    .upsert({ id: 1, name, active, plan }, { onConflict: "id" })
    .select("id,name,active,plan,updated_at")
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // synchronizacja restaurant_tables (żeby rezerwacje miały do czego się podpiąć)
  const ids = plan.map((t) => t.id);

  // upsert wszystkich z planu
  if (plan.length) {
    const toUpsert = plan.map((t) => ({
      id: t.id,
      label: t.label,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      rotation: t.rotation,
      capacity: t.capacity,
      active: t.active,
    }));
    const { error: uErr } = await supabase
      .from("restaurant_tables")
      .upsert(toUpsert, { onConflict: "id" });
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
  }

  // usuń z restaurant_tables te, których nie ma już w planie
  const { data: existing } = await supabase
    .from("restaurant_tables")
    .select("id");
  const toDelete =
    (existing ?? []).map((r: any) => r.id).filter((id: string) => !ids.includes(id));
  if (toDelete.length) {
    await supabase.from("restaurant_tables").delete().in("id", toDelete);
  }

  return NextResponse.json({ layout }, { status: 200 });
}
