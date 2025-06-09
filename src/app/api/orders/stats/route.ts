// src/app/api/orders/stats/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getSessionAndRole } from "@/lib/serverAuth";

export async function GET(request: Request) {
  // 1. Sprawdź sesję i rolę
  const { session, role } = await getSessionAndRole(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Utwórz Supabase Client powiązany z requestem (RLS będzie działać)
  const supabase = createRouteHandlerClient<Database>({ request });

  try {
    // 3. Parametry: ostatnie X dni (domyślnie 7)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 4. Pobierz wszystkie zamówienia od "since"
    const { data: allOrders, error } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", since.toISOString());

    if (error) {
      console.error("Błąd pobierania orders:", error);
      throw error;
    }

    // 5. Grupowanie zamówień per dzień
    const ordersPerDay: Record<string, number> = {};
    allOrders?.forEach((o) => {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      ordersPerDay[day] = (ordersPerDay[day] ?? 0) + 1;
    });

    // 6. Średni czas realizacji (zakładamy pole fulfillment_time w minutach)
    let totalTime = 0;
    let countTime = 0;
    allOrders?.forEach((o) => {
      if (o.fulfillment_time != null) {
        totalTime += o.fulfillment_time;
        countTime++;
      }
    });
    const avgFulfillmentTime = countTime > 0 ? Math.round(totalTime / countTime) : 0;

    // 7. Najpopularniejsze produkty (zakładamy pole product_name)
    const popularProducts: Record<string, number> = {};
    allOrders?.forEach((o) => {
      const prod = o.product_name ?? "Inne";
      popularProducts[prod] = (popularProducts[prod] ?? 0) + 1;
    });

    // 8. Zwróć wynik
    return NextResponse.json(
      {
        ordersPerDay,
        avgFulfillmentTime,
        popularProducts,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Błąd w GET /api/orders/stats:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
