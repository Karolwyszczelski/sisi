"use client";

import React, { useState, useEffect } from "react";
// Importuj przyciski – załóżmy, że je stworzyłeś analogicznie do AcceptButton
import AcceptButton from "./AcceptButton";
import EditOrderButton from "./EditButton";
import CancelOrderButton from "./CancelButton";

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: string;
  // Dodaj inne pola, np. delivery_time, jeśli potrzebujesz
}

export default function EmployeeClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Funkcja do pobierania bieżących zamówień (przykładowa implementacja)
  useEffect(() => {
    async function fetchOrders() {
      try {
        // Możesz stworzyć dedykowany endpoint API np. /api/orders/current
        // lub bezpośrednio korzystać z Supabase client (w przypadku client-side, pamiętaj jednak o bezpieczeństwie).
        const res = await fetch("/api/orders/current");
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders);
        } else {
          console.error("Błąd pobierania zamówień");
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Funkcja aktualizująca stan zamówień – np. po akceptacji lub anulowaniu zamówienia
  const handleOrderUpdated = (orderId: string) => {
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel Pracownika</h1>
      <p className="text-lg text-gray-700">
        Przyjmij bieżące zamówienia, ustaw czas odbioru i zarządzaj zamówieniami.
      </p>

      {loading ? (
        <p>Ładowanie zamówień...</p>
      ) : orders.length === 0 ? (
        <p>Brak bieżących zamówień.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="bg-white p-4 rounded shadow">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                  <p className="font-bold text-lg">{order.customer_name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    Kwota: <span className="font-medium">{order.total_price} zł</span>
                  </p>
                  <p className="text-sm">
                    Status: <span className="font-medium">{order.status}</span>
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col gap-2">
                  {/* Przycisk akceptacji z wyborem czasu odbioru */}
                  <AcceptButton
                    orderId={order.id}
                    onOrderUpdated={() => handleOrderUpdated(order.id)}
                  />

                  {/* Przycisk do edycji – np. otwiera modal do edycji szczegółów zamówienia */}
                  <EditOrderButton
                    orderId={order.id}
                    onOrderUpdated={() => handleOrderUpdated(order.id)}
                  />

                  {/* Przycisk do anulowania zamówienia */}
                  <CancelOrderButton
                    orderId={order.id}
                    onOrderUpdated={() => handleOrderUpdated(order.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
