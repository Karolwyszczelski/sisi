// src/app/api/orders/current/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: Request) {
  try {
    const { session, role } = await getSessionAndRole();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // Admin/employee: pełne dane + relacje (bez RLS)
    if (role === "admin" || role === "employee") {
      const { data, count, error } = await supabaseAdmin
        .from("orders")
        .select("*, order_items(*, products(*))", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return NextResponse.json({ orders: data ?? [], totalCount: count ?? 0 });
    }

    // Klient: prosty widok (RLS), bez joinów żeby nie blokowały
    const supabaseUser = createRouteHandlerClient<Database>({ cookies });
    const { data, count, error } = await supabaseUser
      .from("orders")
      .select("*", { count: "exact" })
      .eq("user_id", session.user.id)
      .in("status", ["new", "placed", "accepted"])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ orders: data ?? [], totalCount: count ?? 0 });
  } catch (e: any) {
    console.error("[orders.current] error:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
