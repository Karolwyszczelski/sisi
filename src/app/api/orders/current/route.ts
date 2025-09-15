// src/app/api/orders/current/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

export async function GET(request: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createRouteHandlerClient<Database>({ cookies });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  let query = supabase
    .from("orders")
    .select(
      `
      id, created_at, status,
      name, customer_name, client_name, phone,
      items, order_items,
      selected_option, total_price, delivery_cost,
      street, flat_number, city, address,
      client_delivery_time, delivery_time,
      payment_method, payment_status
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (role === "client") {
    // bez "pending" – to jest payment_status, nie status zamówienia
    query = query.eq("user_id", session.user.id).in("status", ["new", "placed", "accepted"]);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], totalCount: count ?? 0 });
}
