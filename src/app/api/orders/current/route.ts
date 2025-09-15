// src/app/api/orders/current/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

const supabaseAdmin = createClient(
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

    const supabase =
      role === "admin" || role === "employee"
        ? supabaseAdmin
        : createRouteHandlerClient<Database>({ cookies });

    let query = supabase
      .from("orders")
      .select(
        `
        id, created_at, status,
        name, customer_name, client_name, phone,
        items,
        selected_option, total_price, delivery_cost,
        street, flat_number, city, address,
        client_delivery_time, deliveryTime, delivery_time,
        payment_method, payment_status
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (role !== "admin" && role !== "employee") {
      query = query
        .eq("user_id", session.user.id)
        .in("status", ["new", "placed", "accepted"]);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({ orders: data ?? [], totalCount: count ?? 0 });
  } catch (e: any) {
    console.error("[orders.current] error:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
