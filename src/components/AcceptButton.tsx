// src/components/AcceptButton.tsx
"use client";

import { useState } from "react";

interface AcceptButtonProps {
  orderId: string;
  selectedOption: "local" | "takeaway" | "delivery" | undefined;
  onOrderUpdated?: (orderId: string, updatedData: { status: string; deliveryTime: string }) => void;
}

export default function AcceptButton({
  orderId,
  selectedOption,
  onOrderUpdated,
}: AcceptButtonProps) {
  const [loading, setLoading] = useState(false);

  // Definicja zestawów przycisków w zależności od trybu odbioru
  const timeOptions: { label: string; minutes: number }[] =
    selectedOption === "takeaway"
      ? [
          { label: "15 min", minutes: 15 },
          { label: "25 min", minutes: 25 },
          { label: "30 min", minutes: 30 },
          { label: "45 min", minutes: 45 },
          { label: "1 h", minutes: 60 },
        ]
      : [
          { label: "30 min", minutes: 30 },
          { label: "1 h", minutes: 60 },
          { label: "1.5 h", minutes: 90 },
          { label: "2 h", minutes: 120 },
        ];

  const handleAccept = async (minutes: number) => {
    setLoading(true);
    try {
      const deliveryTime = new Date(Date.now() + minutes * 60000).toISOString();

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "accepted",
          deliveryTime,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("Błąd aktualizacji zamówienia:", payload.error ?? payload);
      } else {
        // przekazujemy rodzicowi id i nowe dane
        onOrderUpdated?.(orderId, { status: "accepted", deliveryTime });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {timeOptions.map(({ label, minutes }) => (
        <button
          key={label}
          onClick={() => handleAccept(minutes)}
          disabled={loading}
          className={`px-4 py-2 rounded-full font-semibold text-sm ${
            loading
              ? "bg-gray-300 text-gray-600"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
