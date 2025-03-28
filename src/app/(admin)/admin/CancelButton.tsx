"use client";

import { useState } from 'react';

interface CancelButtonProps {
  orderId: string;
  onOrderUpdated?: (data: any) => void;
}

export default function CancelButton({ orderId, onOrderUpdated }: CancelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Błąd anulowania zamówienia:', result.error);
      } else {
        onOrderUpdated && onOrderUpdated(result.data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="px-4 py-2 bg-red-500 text-white rounded"
    >
      Anuluj
    </button>
  );
}
