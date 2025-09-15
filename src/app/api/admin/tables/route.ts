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

const TableSchema = z.object({
  table_number: z.string().min(1),
  name: z.string().optional().default(""),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  seats: z.number().int().positive(),
});

export async function GET() {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .select("*")
    .order("table_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables: data ?? [] });
}

export async function POST(req: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = TableSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  // dla zgodności z kolumną number_of_seats:
  const row = { ...parsed.data, number_of_seats: parsed.data.seats };

  const { data, error } = await supabaseAdmin
    .from("restaurant_tables")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}
