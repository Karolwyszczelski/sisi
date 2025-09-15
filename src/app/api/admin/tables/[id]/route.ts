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

const PatchSchema = z.object({
  table_number: z.string().min(1).optional(),
  name: z.string().optional(),
  x: z.number().int().nonnegative().optional(),
  y: z.number().int().nonnegative().optional(),
  seats: z.number().int().positive().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const upd: any = { ...parsed.data };
  if (upd.seats !== undefined) upd.number_of_seats = upd.seats;

  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .update(upd)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin.from("restaurant_tables").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
