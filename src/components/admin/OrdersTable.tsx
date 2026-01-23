// src/components/admin/OrdersTable.tsx
"use client";
import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

const APP_TZ = "Europe/Warsaw";


export default function OrdersTable({ limit }: { limit?: number }) {
  const supabase = createClientComponentClient();
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("orders")
      .select("id, customer_name, total_price, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 10)
      .then(({ data }) => setOrders(data || []));
  }, []);
  return (
    <table className="w-full text-left">
      <thead>
        <tr>
          <th>ID</th>
          <th>Klient</th>
          <th>Kwota</th>
          <th>Status</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id} className="border-t">
            <td><Link href={`/admin/order/${o.id}`}>{o.id}</Link></td>
            <td>{o.customer_name}</td>
            <td>{o.total_price} zł</td>
            <td>{o.status}</td>
            <td>{new Date(o.created_at).toLocaleString("pl-PL", { timeZone: APP_TZ })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
