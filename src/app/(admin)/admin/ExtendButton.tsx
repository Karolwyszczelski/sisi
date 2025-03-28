"use client";

import { useState } from 'react';

interface ExtendButtonProps {
  orderId: string;
  onOrderUpdated?: (data: any) => void;
}

export default function ExtendButton({ orderId, onOrderUpdated }: ExtendButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExtend = async (newDeliveryTime: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'extended',
          deliveryTime: newDeliveryTime,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Błąd wydłużenia czasu dostawy:', result.error);
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
    <div className="flex gap-2">
      <button
        onClick={() => handleExtend('15 min')}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        +15 min
      </button>
      <button
        onClick={() => handleExtend('30 min')}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        +30 min
      </button>
    </div>
  );
}
