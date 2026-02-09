export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

export interface OrderSettings {
  orders_enabled: boolean;
  local_enabled: boolean;
  takeaway_enabled: boolean;
  delivery_enabled: boolean;
}

const DEFAULT_SETTINGS: OrderSettings = {
  orders_enabled: true,
  local_enabled: true,
  takeaway_enabled: true,
  delivery_enabled: true,
};

// GET - pobierz ustawienia zamówień
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("order_settings")
      .select("*")
      .single();

    if (error || !data) {
      // Jeśli nie ma jeszcze wiersza, zwróć domyślne
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      orders_enabled: data.orders_enabled ?? true,
      local_enabled: data.local_enabled ?? true,
      takeaway_enabled: data.takeaway_enabled ?? true,
      delivery_enabled: data.delivery_enabled ?? true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

// PATCH - aktualizuj ustawienia zamówień
export async function PATCH(req: NextRequest) {
  try {
    const { session, role } = await getSessionAndRole();
    if (!session || (role !== "admin" && role !== "employee")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const supabase = getSupabase();

    // Sprawdź czy istnieje wiersz
    const { data: existing } = await supabase
      .from("order_settings")
      .select("id")
      .single();

    const updateData: Partial<OrderSettings> = {};
    if (typeof body.orders_enabled === "boolean") updateData.orders_enabled = body.orders_enabled;
    if (typeof body.local_enabled === "boolean") updateData.local_enabled = body.local_enabled;
    if (typeof body.takeaway_enabled === "boolean") updateData.takeaway_enabled = body.takeaway_enabled;
    if (typeof body.delivery_enabled === "boolean") updateData.delivery_enabled = body.delivery_enabled;

    let result;
    if (existing?.id) {
      result = await supabase
        .from("order_settings")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("order_settings")
        .insert({ ...DEFAULT_SETTINGS, ...updateData })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
