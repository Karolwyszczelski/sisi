// components/CancelButton.tsx
"use client";

import { useState } from "react";

interface CancelButtonProps {
  orderId: string;
  onOrderUpdated?: (orderId: string) => void;
}

export default function CancelButton({ orderId, onOrderUpdated }: CancelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const responseText = await res.text();
      let result = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (err) {
          console.error("Błąd parsowania JSON:", responseText);
          throw new Error("Niepoprawny format JSON w odpowiedzi");
        }
      }

      if (!res.ok) {
        console.error("Błąd anulowania zamówienia:", result["error"] || result);
        return;
      }

      onOrderUpdated && onOrderUpdated(orderId);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCancel} disabled={loading} className="px-4 py-2 bg-red-500 text-white rounded">
      Anuluj
    </button>
  );
}
