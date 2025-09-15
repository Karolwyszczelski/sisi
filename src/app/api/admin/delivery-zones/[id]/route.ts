export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSessionAndRole } from "@/lib/serverAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const Patch = z.object({
  min_distance_km: z.number().optional(),
  max_distance_km: z.number().optional(),
  min_order_value: z.number().optional(),
  cost: z.number().optional(),
  free_over: z.number().nullable().optional(),
  eta_min_minutes: z.number().optional(),
  eta_max_minutes: z.number().optional(),
  cost_fixed: z.number().optional(),
  cost_per_km: z.number().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json();
  const prepared = Object.fromEntries(
    Object.entries(json).map(([k, v]) => [
      k,
      v === "" ? null : v === null ? null : Number.isFinite(Number(v)) ? Number(v) : v,
    ])
  );
  const parsed = Patch.safeParse(prepared);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation", details: parsed.error.format() }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("delivery_zones")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin.from("delivery_zones").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
