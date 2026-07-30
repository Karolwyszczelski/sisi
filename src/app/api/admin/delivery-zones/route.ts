export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSessionAndRole } from "@/lib/serverAuth";
import {
  type DeliveryZonePricing,
  validateDeliveryZones,
} from "@/lib/deliveryPricing";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

// Schemat zgodny z formularzem DeliveryZonesForm
const Zone = z.object({
  id: z.string().uuid().optional(),
  min_distance_km: z.number().int().nonnegative(),
  max_distance_km: z.number().int().nonnegative(),
  min_order_value: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  free_over: z.number().nonnegative().nullable().optional(),
  eta_min_minutes: z.number().int().nonnegative(),
  eta_max_minutes: z.number().int().nonnegative(),
  cost_fixed: z.number().nonnegative(),
  cost_per_km: z.number().nonnegative(),
  pricing_type: z.enum(["flat", "per_km"]).default("per_km"),
  destination_city: z.string().trim().min(1).max(100).nullable().optional(),
  active: z.boolean().default(true),
}).refine((zone) => zone.max_distance_km >= zone.min_distance_km, {
  message: "Maksymalny kilometr nie może być mniejszy od minimalnego.",
  path: ["max_distance_km"],
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
    pricing_type: json.pricing_type ?? "per_km",
    destination_city:
      json.destination_city == null ||
      String(json.destination_city).trim() === ""
        ? null
        : String(json.destination_city).trim(),
    active: json.active ?? true,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.format() }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("delivery_zones")
    .select("*");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  const zoneValidationErrors = validateDeliveryZones([
    ...((existing ?? []) as DeliveryZonePricing[]),
    parsed.data,
  ]);
  if (zoneValidationErrors.length) {
    return NextResponse.json(
      { error: zoneValidationErrors.join(" ") },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("delivery_zones")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
