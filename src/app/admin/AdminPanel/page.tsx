// src/app/admin/AdminPanel/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { ShoppingCart, Clock, CheckCircle, DollarSign } from "lucide-react";
import ChartComponent from "@/components/ChartComponent";
import OrdersTable from "@/components/admin/OrdersTable";
import ReservationsTable from "@/components/admin/ReservationsTable";

interface Summary {
  totalToday: number;
  pending: number;
  completed: number;
  revenueToday: number;
}

export default function AdminPanel() {
  const supabase = createClientComponentClient();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        // 1) Zamówienia dziś
        const today = new Date().toISOString().slice(0, 10);
        const { count: totalToday, error: err1 } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${today}T00:00:00Z`);
        if (err1) throw err1;

        // 2) Zamówienia w toku (pending)
        const { count: pending, error: err2 } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        if (err2) throw err2;

        // 3) Zamówienia zrealizowane (completed)
        const { count: completed, error: err3 } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed");
        if (err3) throw err3;

        // 4) Przychód dziś – zakładam, że Twój RPC zwraca tablicę [{ sum: number }]
        const { data: revenueData, error: err4 } = await supabase.rpc< { sum: number }[] >("revenue_today");
        if (err4) throw err4;
        const revenueToday = revenueData && revenueData.length > 0 ? revenueData[0].sum : 0;

        setSummary({
          totalToday: totalToday ?? 0,
          pending: pending ?? 0,
          completed: completed ?? 0,
          revenueToday,
        });
      } catch (err: any) {
        console.error("Błąd ładowania podsumowania:", err);
        setError(err.message || "Nieznany błąd");
      }
    }

    loadSummary();
  }, [supabase]);

  if (error) {
    return (
      <div className="text-center text-red-600 py-20">
        Wystąpił błąd: {error}
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-20">Ładowanie danych…</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-bold">Panel Administracyjny</h1>

      {/* Karty podsumowania */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          Icon={ShoppingCart}
          label="Zamówienia dziś"
          value={summary.totalToday}
          iconColor="text-blue-500"
        />
        <SummaryCard
          Icon={Clock}
          label="W toku"
          value={summary.pending}
          iconColor="text-yellow-500"
        />
        <SummaryCard
          Icon={CheckCircle}
          label="Zrealizowane"
          value={summary.completed}
          iconColor="text-green-500"
        />
        <SummaryCard
          Icon={DollarSign}
          label="Przychód dziś"
          value={`${summary.revenueToday} zł`}
          iconColor="text-teal-500"
        />
      </div>

      {/* Wykres sprzedaży */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Trendy sprzedaży (ostatnie 7 dni)</h2>
        <ChartComponent />
      </div>

      {/* Tabele z danymi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PanelSection title="Ostatnie zamówienia">
          <OrdersTable limit={5} />
        </PanelSection>
        <PanelSection title="Nadchodzące rezerwacje">
          <ReservationsTable limit={5} />
        </PanelSection>
      </div>
    </div>
  );
}

/** Pomocniczy komponent do karty podsumowania */
function SummaryCard({
  Icon,
  label,
  value,
  iconColor,
}: {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded shadow p-4 flex items-center">
      <Icon className={`w-8 h-8 mr-3 ${iconColor}`} />
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

/** Pomocniczy wrapper dla sekcji panelu */
function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}
