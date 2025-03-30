// app/admin/AdminPanel/page.tsx
"use client";
import React from "react";
import ChartComponent from "@/components/ChartComponent";

export default function AdminPanel() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Statystyki zamówień</h2>
      <ChartComponent />
      {/* Możesz dodać kolejne sekcje: bieżące zamówienia, historia, rezerwacje itd. */}
    </div>
  );
}
