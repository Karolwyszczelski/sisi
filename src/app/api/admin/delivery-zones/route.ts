export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ZoneSchema = z.object({
  min_distance_km: z.number().nonnegative(),
  max_distance_km: z.number().nonnegative(),
  min_order_value: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  free_over: z.number().nonnegative().nullable().optional(),
  eta_min_minutes: z.number().int().nonnegative(),
  eta_max_minutes: z.number().int().nonnegative(),
  cost_fixed: z.number().nonnegative().default(0),
  cost_per_km: z.number().nonnegative().default(0),
});

export async function GET() {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .select("*")
    .order("min_distance_km", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

export async function POST(req: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ZoneSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
