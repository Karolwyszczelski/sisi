"use client";

import { useState } from "react";

interface AcceptButtonProps {
  orderId: string;
  onOrderUpdated?: (data: Partial<any>) => void;
}

export default function AcceptButton({ orderId, onOrderUpdated }: AcceptButtonProps) {
  const [loading, setLoading] = useState(false);

  const minutesMap: Record<string, number> = {
    "30 min": 30,
    "1h": 60,
    "1.5h": 90,
    "2h": 120,
  };

  const handleAccept = async (timeLabel: string) => {
    setLoading(true);
    try {
      const minutes = minutesMap[timeLabel] || 30;
      const targetTimestamp = new Date(new Date().getTime() + minutes * 60000).toISOString();

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "accepted",
          deliveryTime: targetTimestamp,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        console.error("Błąd aktualizacji zamówienia:", result.error);
      } else {
        const result = await res.json();
        // Jeśli result.data to tablica, wyciągamy pierwszy element
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          onOrderUpdated && onOrderUpdated(result.data[0]);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => handleAccept("30 min")} disabled={loading} className="px-3 py-1 bg-green-500 text-white rounded">
        30 min
      </button>
      <button onClick={() => handleAccept("1h")} disabled={loading} className="px-3 py-1 bg-green-500 text-white rounded">
        1h
      </button>
      <button onClick={() => handleAccept("1.5h")} disabled={loading} className="px-3 py-1 bg-green-500 text-white rounded">
        1.5h
      </button>
      <button onClick={() => handleAccept("2h")} disabled={loading} className="px-3 py-1 bg-green-500 text-white rounded">
        2h
      </button>
    </div>
  );
}
