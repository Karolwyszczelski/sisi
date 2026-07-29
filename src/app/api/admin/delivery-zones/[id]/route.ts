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

const Patch = z.object({
  min_distance_km: z.number().int().nonnegative().optional(),
  max_distance_km: z.number().int().nonnegative().optional(),
  min_order_value: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  free_over: z.number().nonnegative().nullable().optional(),
  eta_min_minutes: z.number().int().nonnegative().optional(),
  eta_max_minutes: z.number().int().nonnegative().optional(),
  cost_fixed: z.number().nonnegative().optional(),
  cost_per_km: z.number().nonnegative().optional(),
  pricing_type: z.enum(["flat", "per_km"]).optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json();
  const prepared = Object.fromEntries(
    Object.entries(json).map(([key, value]) => {
      if (key === "pricing_type" || key === "active") return [key, value];
      return [
        key,
        value === ""
          ? null
          : value === null
            ? null
            : Number.isFinite(Number(value))
              ? Number(value)
              : value,
      ];
    }),
  );
  const parsed = Patch.safeParse(prepared);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.format() }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("delivery_zones")
    .select("*");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const candidateZones = ((existing ?? []) as DeliveryZonePricing[]).map(
    (zone) => (zone.id === id ? { ...zone, ...parsed.data } : zone),
  );
  const zoneValidationErrors = validateDeliveryZones(candidateZones);
  if (zoneValidationErrors.length) {
    return NextResponse.json(
      { error: zoneValidationErrors.join(" ") },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("delivery_zones")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("delivery_zones")
    .select("*");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const candidateZones = ((existing ?? []) as DeliveryZonePricing[]).filter(
    (zone) => zone.id !== id,
  );
  const zoneValidationErrors = validateDeliveryZones(candidateZones);
  if (zoneValidationErrors.length) {
    return NextResponse.json(
      {
        error: `Nie można usunąć strefy: ${zoneValidationErrors.join(" ")}`,
      },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
