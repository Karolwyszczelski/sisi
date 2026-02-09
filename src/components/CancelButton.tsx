// src/components/CancelButton.tsx
"use client";

import React, { useState } from "react";

interface CancelButtonProps {
  orderId: string;
  // teraz przyjmujemy też opcjonalne updatedData
  onOrderUpdated: (orderId: string, updatedData?: { status: string }) => void;
}

export default function CancelButton({
  orderId,
  onOrderUpdated,
}: CancelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Na pewno anulować to zamówienie?")) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const payload = await res.json();

      if (!res.ok) {
        console.error("Błąd anulowania zamówienia:", payload.error ?? payload);
        alert("Coś poszło nie tak przy anulowaniu: " + (payload.error ?? ""));
        return;
      }

      // powiadamiamy rodzica o zmianie statusu
      onOrderUpdated(orderId, { status: "cancelled" });
    } catch (err) {
      console.error("Błąd anulowania zamówienia:", err);
      alert("Błąd sieci podczas anulowania zamówienia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className={`h-10 px-4 rounded-lg font-semibold text-sm transition-colors ${
        loading
          ? "bg-slate-700 text-slate-500"
          : "bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/30"
      }`}
    >
      {loading ? "Anulowanie..." : "Anuluj"}
    </button>
  );
}
