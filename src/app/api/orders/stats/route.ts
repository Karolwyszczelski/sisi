import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tworzymy klienta Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  try {
    // 1) Zliczanie zamówień per day (ordersPerDay)
    //    Zakładamy, że w tabeli orders mamy kolumnę created_at (typ timestamptz)
    //    i chcesz np. ostatnie 7 dni.
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Ponieważ w Supabase do grupowania trzeba używać RPC lub zapytania SQL, uprośćmy:
    // a) Pobieramy wszystkie w przedziale i potem grupujemy w JS,
    //    (jeżeli nie jest to za duży wolumen).
    const { data: allOrders, error: err1 } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", sevenDaysAgo.toISOString());

    if (err1) throw new Error("Błąd pobierania orders: " + err1.message);

    // Grupowanie per day
    const ordersPerDay: Record<string, number> = {};
    allOrders?.forEach((ord) => {
      // ord.created_at – w Supabase to jest string UTC lub data
      const dayStr = new Date(ord.created_at).toISOString().slice(0, 10);
      if (!ordersPerDay[dayStr]) ordersPerDay[dayStr] = 0;
      ordersPerDay[dayStr]++;
    });

    // 2) Średni czas realizacji (avgFulfillmentTime)
    //    Jeżeli w tabeli jest fulfillment_time (minuty?), zlicz i uśrednij
    let totalTime = 0;
    let countTime = 0;
    allOrders?.forEach((ord) => {
      if (ord.fulfillment_time) {
        totalTime += ord.fulfillment_time;
        countTime++;
      }
    });
    const avg = countTime ? Math.round(totalTime / countTime) : 0;

    // Zwracamy w formie obiektu np. z kluczem "2025-03-29": X
    // Tylko 1 klucz w tym przykładzie – możesz chcieć cały tydzień
    const avgFulfillmentTime: Record<string, number> = {};
    const dayKey = new Date().toISOString().slice(0, 10);
    avgFulfillmentTime[dayKey] = avg;

    // 3) Najpopularniejsze produkty (popularProducts)
    //    Jeśli w tabeli "orders" mamy np. product_name lub jest relacja do order_items
    //    Tutaj dla uproszczenia: product_name w orders.
    const popularProducts: Record<string, number> = {};
    allOrders?.forEach((ord) => {
      const prod = ord.product_name || "Inne";
      if (!popularProducts[prod]) popularProducts[prod] = 0;
      popularProducts[prod]++;
    });

    // finalny obiekt
    const result = {
      ordersPerDay,
      avgFulfillmentTime,
      popularProducts,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Błąd w GET /api/orders/stats:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
