"use client";

import { useState } from 'react';

interface AcceptButtonProps {
  orderId: string;
  onOrderUpdated?: (data: any) => void;
}

export default function AcceptButton({ orderId, onOrderUpdated }: AcceptButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async (deliveryTime: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          deliveryTime, // np. "30 min", "1h", itp.
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        console.error('Błąd aktualizacji zamówienia:', result.error);
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
        onClick={() => handleAccept('30 min')}
        disabled={loading}
        className="px-3 py-1 bg-green-500 text-white rounded"
      >
        30 min
      </button>
      <button 
        onClick={() => handleAccept('1h')}
        disabled={loading}
        className="px-3 py-1 bg-green-500 text-white rounded"
      >
        1h
      </button>
      <button 
        onClick={() => handleAccept('1.5h')}
        disabled={loading}
        className="px-3 py-1 bg-green-500 text-white rounded"
      >
        1.5h
      </button>
      <button 
        onClick={() => handleAccept('2h')}
        disabled={loading}
        className="px-3 py-1 bg-green-500 text-white rounded"
      >
        2h
      </button>
    </div>
  );
}
