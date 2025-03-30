"use client";

import React, { useState } from "react";

interface EditOrderButtonProps {
  orderId: string;
  onOrderUpdated: () => void;
}

export default function EditOrderButton({ orderId, onOrderUpdated }: EditOrderButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: newCustomerName }),
      });
      if (res.ok) {
        // Po udanej edycji wywołujemy callback, by zaktualizować stan
        onOrderUpdated();
        setShowModal(false);
      } else {
        const result = await res.json();
        console.error("Błąd edycji zamówienia:", result.error);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
      >
        Edytuj
      </button>
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded">
            <h3 className="text-xl font-bold mb-4">Edytuj zamówienie</h3>
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Nowa nazwa klienta"
              className="border p-2 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleSave} className="bg-green-500 text-white py-2 px-4 rounded">
                Zapisz
              </button>
              <button onClick={() => setShowModal(false)} className="bg-gray-500 text-white py-2 px-4 rounded">
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
