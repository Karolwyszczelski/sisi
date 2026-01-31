export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSessionAndRole } from "@/lib/serverAuth";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

// Schemat zgodny z formularzem DeliveryZonesForm
const Zone = z.object({
  id: z.string().uuid().optional(),
  min_distance_km: z.number(),
  max_distance_km: z.number(),
  min_order_value: z.number(),
  cost: z.number(),
  free_over: z.number().nullable().optional(),
  eta_min_minutes: z.number(),
  eta_max_minutes: z.number(),
  cost_fixed: z.number(),
  cost_per_km: z.number(),
});

export async function GET() {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from("delivery_zones")
    .select("*")
    .order("min_distance_km");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

export async function POST(req: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json();
  const parsed = Zone.safeParse({
    ...json,
    min_distance_km: Number(json.min_distance_km),
    max_distance_km: Number(json.max_distance_km),
    min_order_value: Number(json.min_order_value),
    cost: Number(json.cost),
    free_over: json.free_over === null || json.free_over === "" ? null : Number(json.free_over),
    eta_min_minutes: Number(json.eta_min_minutes),
    eta_max_minutes: Number(json.eta_max_minutes),
    cost_fixed: Number(json.cost_fixed),
    cost_per_km: Number(json.cost_per_km),
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.format() }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("delivery_zones")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
