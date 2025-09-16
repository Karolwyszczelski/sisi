// Force dynamic – zawsze świeże
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getSessionAndRole } from "@/lib/serverAuth";

type Row = Database["public"]["Tables"]["orders"]["Row"];

// Bezpieczny parser items → nazwy produktów
function collectStrings(val: any): string[] {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(collectStrings).filter(Boolean);
  if (typeof val === "object") {
    const prefer = ["name","title","label","product_name","menu_item_name","item_name","nazwa","nazwa_pl"];
    const out: string[] = [];
    for (const k of prefer) {
      if (typeof (val as any)[k] === "string") out.push((val as any)[k]);
    }
    // zagnieżdżenia
    for (const v of Object.values(val)) {
      if (typeof v === "object") out.push(...collectStrings(v));
    }
    return out;
  }
  return [];
}

function extractProductNames(items: any): string[] {
  try {
    const data = typeof items === "string" ? JSON.parse(items) : items;
    const arr = Array.isArray(data) ? data : [data];
    const names = new Set<string>();
    for (const it of arr) {
      const c = collectStrings(it);
      for (const s of c) if (s && s.length <= 80) names.add(s);
    }
    return Array.from(names);
  } catch {
    // fallback: csv
    if (typeof items === "string") return items.split(",").map(s => s.trim()).filter(Boolean);
    return [];
  }
}

export async function GET(request: Request) {
  // 1) Auth
  const { session, role } = await getSessionAndRole(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && role !== "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) Supabase client (auth cookies!)
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    // 3) Zakres czasu
    const { searchParams } = new URL(request.url);
    const days = Math.max(1, parseInt(searchParams.get("days") || "7", 10));
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 4) Minimalny select
    const { data: rows, error } = await supabase
      .from("orders")
      .select("id, created_at, updated_at, status, total_price, payment_status, items, deliveryTime, client_delivery_time")
      .gte("created_at", since.toISOString());

    if (error) throw error;

    const ordersPerDay: Record<string, number> = {};
    const avgMapAcc: Record<string, { sum: number; cnt: number }> = {};
    const popularProducts: Record<string, number> = {};

    let todayOrders = 0;
    let todayRevenue = 0;
    let monthOrders = 0;
    let monthRevenue = 0;
    let newOrders = 0;
    let currentOrders = 0;

    const todayKey = now.toISOString().slice(0, 10);
    const ym = todayKey.slice(0, 7);

    for (const o of (rows ?? [])) {
      const day = new Date(o.created_at!).toISOString().slice(0, 10);

      // 5) Orders per day
      ordersPerDay[day] = (ordersPerDay[day] ?? 0) + 1;

      // 6) Avg fulfillment per day (minuty)
      // Preferuj rzeczywisty czas: updated_at - created_at jeśli completed; jeśli brak, użyj deliveryTime/client_delivery_time jako proxy.
      let minutes: number | null = null;
      if (o.status === "completed" && o.updated_at) {
        minutes = Math.max(0, Math.round((+new Date(o.updated_at) - +new Date(o.created_at!)) / 60000));
      } else if (o.deliveryTime) {
        minutes = Math.max(0, Math.round((+new Date(o.deliveryTime) - +new Date(o.created_at!)) / 60000));
      } else if ((o as any).client_delivery_time) {
        minutes = Math.max(0, Math.round((+new Date((o as any).client_delivery_time) - +new Date(o.created_at!)) / 60000));
      }
      if (minutes != null && Number.isFinite(minutes)) {
        const acc = avgMapAcc[day] ?? { sum: 0, cnt: 0 };
        acc.sum += minutes; acc.cnt += 1;
        avgMapAcc[day] = acc;
      }

      // 7) Popular products
      const names = extractProductNames(o.items);
      for (const n of names) {
        popularProducts[n] = (popularProducts[n] ?? 0) + 1;
      }

      // 8) KPIs (przychody liczone dla opłaconych lub completed)
      const isPaidish = o.payment_status === "paid" || o.status === "completed";
      const price = Number(o.total_price) || 0;

      if (day === todayKey) {
        todayOrders += 1;
        if (isPaidish) todayRevenue += price;
      }
      if (day.startsWith(ym)) {
        monthOrders += 1;
        if (isPaidish) monthRevenue += price;
      }

      // live counters
      if (o.status === "new" || o.status === "placed") newOrders += 1;
      if (o.status === "accepted") currentOrders += 1;
    }

    const avgFulfillmentTime: Record<string, number> = {};
    for (const [d, { sum, cnt }] of Object.entries(avgMapAcc)) {
      if (cnt > 0) avgFulfillmentTime[d] = Math.round(sum / cnt);
    }

    const kpis = {
      todayOrders,
      todayRevenue,
      monthOrders,
      monthRevenue,
      monthAvgFulfillment: undefined as number | undefined,
      newOrders,
      currentOrders,
      reservations: 0, // jeśli w przyszłości będziesz liczyć z tabeli rezerwacji – tutaj podłącz
    };

    // Oszacuj średnią miesięczną z mapy (jeśli są dane)
    const monthAvgs = Object.entries(avgFulfillmentTime).filter(([d]) => d.startsWith(ym));
    if (monthAvgs.length) {
      const sum = monthAvgs.reduce((s, [, v]) => s + (v || 0), 0);
      kpis.monthAvgFulfillment = Math.round(sum / monthAvgs.length);
    }

    return new NextResponse(
      JSON.stringify({ ordersPerDay, avgFulfillmentTime, popularProducts, kpis }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: any) {
    console.error("Błąd w GET /api/orders/stats:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
