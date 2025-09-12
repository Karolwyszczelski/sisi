// src/app/api/orders/current/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import type { Database } from "@/types/supabase";

export async function GET(request: Request) {
  // 1) autoryzacja + rola (Twoja logika - zostaje)
  const { session, role } = await getSessionAndRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) klient Supabase z dostępem do cookies() (Twoja logika - zostaje)
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // 3) paginacja (Twoja logika - zostaje)
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // --- POCZĄTEK MOJEJ POPRAWKI ---
  // 4) bazowe zapytanie z POPRAWIONYM selectem
  let query = supabase
    .from("orders")
    // ZMIANA: Zamiast "*" prosimy o wszystkie pola z 'orders' ORAZ
    // wszystkie powiązane 'order_items', a w nich wszystkie
    // powiązane 'products'. To jest serce tej poprawki.
    .select(`
        *,
        order_items (
          *,
          products (
            *
          )
        )
      `, { count: "exact" })
    .order("created_at", { ascending: false });
  // --- KONIEC MOJEJ POPRAWKI ---

  // 5) jeśli to klient, to tylko jego zamówienia (Twoja logika - zostaje)
  if (role === "client") {
    query = query
      .eq("user_id", session.user.id)
      .in("status", ["new", "placed", "accepted", "pending"]); // Dodałem 'accepted' i 'pending' dla klienta
  }
  // jeśli admin/employee – nie filtrujemy po statusie, widzą wszystko

  // 6) wykonujemy range(…) (Twoja logika - zostaje)
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

  // 7) zwracamy (Twoja logika - zostaje)
  return NextResponse.json({
    orders: orders ?? [],
    totalCount: count ?? 0,
  });
}