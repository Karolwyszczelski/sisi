// src/app/admin/current-orders/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: string;
  address: string;
  phone: string;
  selected_option?: "local" | "takeaway" | "delivery";
  deliveryTime?: string;
}

// === START INSERT: TZ helpers ===
const APP_TZ = "Europe/Warsaw";

const fmtDateTimePL = (iso?: string | null) => {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  return new Date(t).toLocaleString("pl-PL", { timeZone: APP_TZ });
};

const fmtTimePL = (iso?: string | null) => {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  return new Date(t).toLocaleTimeString("pl-PL", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
};
// === END INSERT: TZ helpers ===


export default function CurrentOrdersPage() {
  const supabase = createClientComponentClient<Database>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Błąd pobierania bieżących zamówień:", error);
        setOrders([]);
      } else {
        setOrders(data ?? []);
      }
      setLoading(false);
    }

    load();
  }, [supabase]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Bieżące zamówienia</h1>

      {loading ? (
        <p className="text-gray-600">Ładowanie…</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-600">Brak zamówień w realizacji.</p>
      ) : (
        <div className="overflow-auto bg-white rounded shadow">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Klient</th>
                <th className="px-4 py-2">Kwota</th>
                <th className="px-4 py-2">Opcja</th>
                <th className="px-4 py-2">Czas odbioru</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} className="border-b">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2">
                    {fmtDateTimePL(o.created_at)}
                  </td>
                  <td className="px-4 py-2">{o.customer_name || (o as any).name || "—"}</td>
                  <td className="px-4 py-2">{o.total_price} zł</td>
                  <td className="px-4 py-2">
                    {o.selected_option === "local"
                      ? "Na miejscu"
                      : o.selected_option === "takeaway"
                      ? "Na wynos"
                      : "Dostawa"}
                  </td>
                  <td className="px-4 py-2">
                    {fmtTimePL(o.deliveryTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
