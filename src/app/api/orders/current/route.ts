// src/app/api/orders/current/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

export async function GET(request: Request) {
  // 1) autoryzacja + rola
  const { session, role } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) klient Supabase z dostępem do cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // 3) paginacja
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // 4) bazowe zapytanie
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // 5) jeśli to klient, to tylko jego “new” i “placed”
  if (role === "client") {
    query = query
      .eq("user_id", session.user.id)
      .in("status", ["new", "placed"]);
  }
  // jeśli admin/employee – **nie** filtrujemy po statusie

  // 6) wykonujemy range(…)
  const { data: orders, count, error } = await query.range(
    offset,
    offset + limit - 1
  );

  if (error) {
    console.error("Błąd pobierania zamówień:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }

  // 7) zwracamy
  return NextResponse.json({
    orders: orders ?? [],
    totalCount: count ?? 0,
  });
}
