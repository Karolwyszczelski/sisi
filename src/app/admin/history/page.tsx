// src/app/admin/history/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: "completed" | "cancelled";
  selected_option?: "local" | "takeaway" | "delivery";
}

export default function HistoryPage() {
  const supabase = createClientComponentClient<Database>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_name, total_price, created_at, status, selected_option")
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Błąd pobierania historii zamówień:", error);
        setOrders([]);
      } else {
        setOrders(data ?? []);
      }
      setLoading(false);
    }

    loadHistory();
  }, [supabase]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Historia zamówień</h1>

      {loading ? (
        <p className="text-gray-600">Ładowanie historii…</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-600">Brak zrealizowanych lub anulowanych zamówień.</p>
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
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} className="border-b">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2">
                    {new Date(o.created_at).toLocaleString("pl-PL")}
                  </td>
                  <td className="px-4 py-2">{o.customer_name}</td>
                  <td className="px-4 py-2">{o.total_price} zł</td>
                  <td className="px-4 py-2">
                    {o.selected_option === "local"
                      ? "Na miejscu"
                      : o.selected_option === "takeaway"
                      ? "Na wynos"
                      : "Dostawa"}
                  </td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      o.status === "completed" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {o.status === "completed" ? "Zrealizowane" : "Anulowane"}
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
