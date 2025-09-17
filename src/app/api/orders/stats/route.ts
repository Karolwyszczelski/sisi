// Force dynamic – zawsze świeże
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getSessionAndRole } from "@/lib/serverAuth";

type Row = Database["public"]["Tables"]["orders"]["Row"];

// ===== helpers =====
const dayKeyPL = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const startOfTodayPLISO = () => {
  const now = new Date();
  const z = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  z.setHours(0, 0, 0, 0);
  return new Date(z.getTime() - z.getTimezoneOffset() * 60_000).toISOString();
};

function collectStrings(val: any): string[] {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(collectStrings).filter(Boolean);
  if (typeof val === "object") {
    const prefer = ["name", "title", "label", "product_name", "menu_item_name", "item_name", "nazwa", "nazwa_pl"];
    const out: string[] = [];
    for (const k of prefer) if (typeof (val as any)[k] === "string") out.push((val as any)[k]);
    for (const v of Object.values(val)) if (typeof v === "object") out.push(...collectStrings(v));
    return out;
  }
  return [];
}

function extractProductNames(items: any): string[] {
  try {
    const data = typeof items === "string" ? JSON.parse(items) : items;
    const arr = Array.isArray(data) ? data : [data];
    const names = new Set<string>();
    for (const it of arr) for (const s of collectStrings(it)) if (s && s.length <= 80) names.add(s);
    return Array.from(names);
  } catch {
    if (typeof items === "string") return items.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }
}

// ===== route =====
export async function GET(request: Request) {
  // 1) Auth
  const { session, role } = await getSessionAndRole(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && role !== "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2) Supabase (na cookies usera)
  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    // 3) Zakres
    const { searchParams } = new URL(request.url);
    const days = Math.max(1, parseInt(searchParams.get("days") || "30", 10));
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();

    // 4) Pobierz zamówienia – fallback gdy brak kolumny updated_at
    let rows: (Row & { updated_at?: string | null })[] = [];
    let r1 = await supabase
      .from("orders")
      .select("id, created_at, updated_at, status, total_price, payment_status, items, deliveryTime, client_delivery_time")
      .gte("created_at", sinceISO);

    if (r1.error) {
      const r2 = await supabase
        .from("orders")
        .select("id, created_at, status, total_price, payment_status, items, deliveryTime, client_delivery_time")
        .gte("created_at", sinceISO);
      if (r2.error) throw r2.error;
      rows = (r2.data as any) ?? [];
    } else {
      rows = (r1.data as any) ?? [];
    }

    // 5) Agregacje
    const ordersPerDay: Record<string, number> = {};
    const avgAcc: Record<string, { sum: number; cnt: number }> = {};
    const popularProducts: Record<string, number> = {};

    let todayOrders = 0;
    let todayRevenue = 0;
    let monthOrders = 0;
    let monthRevenue = 0;
    let newOrders = 0;
    let currentOrders = 0;

    const todayKey = dayKeyPL(now);
    const ym = todayKey.slice(0, 7);

    for (const o of rows) {
      const day = dayKeyPL(new Date(o.created_at!));
      ordersPerDay[day] = (ordersPerDay[day] ?? 0) + 1;

      // średni czas realizacji (min)
      let minutes: number | null = null;
      if (o.status === "completed" && o.updated_at) {
        minutes = Math.max(0, Math.round((+new Date(o.updated_at) - +new Date(o.created_at!)) / 60000));
      } else if ((o as any).deliveryTime) {
        minutes = Math.max(0, Math.round((+new Date((o as any).deliveryTime) - +new Date(o.created_at!)) / 60000));
      } else if ((o as any).client_delivery_time) {
        minutes = Math.max(0, Math.round((+new Date((o as any).client_delivery_time) - +new Date(o.created_at!)) / 60000));
      }
      if (minutes != null && Number.isFinite(minutes)) {
        const a = avgAcc[day] ?? { sum: 0, cnt: 0 };
        a.sum += minutes; a.cnt += 1;
        avgAcc[day] = a;
      }

      // popularne produkty
      for (const n of extractProductNames((o as any).items)) {
        popularProducts[n] = (popularProducts[n] ?? 0) + 1;
      }

      // KPI (przychód: paid lub completed)
      const paidish = o.payment_status === "paid" || o.status === "completed";
      const price = Number(o.total_price) || 0;

      if (day === todayKey) {
        todayOrders++;
        if (paidish) todayRevenue += price;
      }
      if (day.startsWith(ym)) {
        monthOrders++;
        if (paidish) monthRevenue += price;
      }

      if (o.status === "new" || o.status === "placed" || o.status === "pending") newOrders++;
      if (o.status === "accepted") currentOrders++;
    }

    const avgFulfillmentTime: Record<string, number> = {};
    for (const [d, { sum, cnt }] of Object.entries(avgAcc)) {
      if (cnt > 0) avgFulfillmentTime[d] = Math.round(sum / cnt);
    }

    // Rezerwacje dziś – jeśli tabela istnieje
    let todayReservations = 0;
    try {
      const { count } = await supabase
        .from("reservations")
        .select("id", { head: true, count: "exact" })
        .gte("created_at", startOfTodayPLISO());
      todayReservations = count ?? 0;
    } catch { /* opcjonalna tabela */ }

    // średnia miesięczna z mapy
    const monthAvgs = Object.entries(avgFulfillmentTime).filter(([d]) => d.startsWith(ym));
    const monthAvgFulfillment =
      monthAvgs.length ? Math.round(monthAvgs.reduce((s, [, v]) => s + (v || 0), 0) / monthAvgs.length) : undefined;

    const kpis = {
      todayOrders,
      todayRevenue,
      todayReservations,
      monthOrders,
      monthRevenue,
      monthAvgFulfillment,
      newOrders,
      currentOrders,
      reservations: todayReservations,
    };

    return new NextResponse(
      JSON.stringify({ ordersPerDay, avgFulfillmentTime, popularProducts, kpis }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Błąd w GET /api/orders/stats:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
