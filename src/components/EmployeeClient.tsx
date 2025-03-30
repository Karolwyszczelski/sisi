"use client";

import React, { useState, useEffect } from "react";
import AcceptButton from "./AcceptButton";
import EditOrderButton from "./EditOrderButton";
import CancelButton from "./CancelButton";
import CountdownTimer from "./CountdownTimer";

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: "new" | "placed" | "accepted" | "cancelled" | "completed";
  deliveryTime?: string; // ISO timestamp, obecny gdy status === "accepted"
  address: string;
  phone: string;
  products: string; // Możesz zmienić typ np. na array, jeżeli chcesz bardziej rozbudowaną strukturę
}

export default function EmployeeClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Funkcja pobierająca zamówienia z API
  async function fetchOrders() {
    try {
      const res = await fetch("/api/orders/current");
      if (res.ok) {
        const data = await res.json();
        console.log("Otrzymane zamówienia:", data.orders);
        setOrders(data.orders);
      } else {
        console.error("Błąd pobierania zamówień", res.status, res.statusText);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Pierwsze pobranie i polling co 5 sekund
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Callback aktualizujący stan zamówienia
  const handleOrderUpdated = (orderId: string, updatedData?: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, ...updatedData } : order
      )
    );
  };

  // Filtrowanie zamówień według statusu:
  // Zamówienia "new" oraz "placed" traktujemy jako nowe.
  const newOrders = orders.filter(
    (order) => order.status === "new" || order.status === "placed"
  );
  const currentOrders = orders.filter((order) => order.status === "accepted");
  const historyOrders = orders.filter(
    (order) => order.status === "cancelled" || order.status === "completed"
  );

  // Funkcja pomocnicza do renderowania szczegółów zamówienia
  const renderOrderDetails = (order: Order) => (
    <div className="text-sm">
      <p>
        <strong>Kwota:</strong> {order.total_price} zł
      </p>
      <p>
        <strong>Adres:</strong> {order.address}
      </p>
      <p>
        <strong>Telefon:</strong> {order.phone}
      </p>
      <p>
        <strong>Produkty:</strong> {order.products}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel Pracownika</h1>

      {loading ? (
        <p>Ładowanie zamówień...</p>
      ) : (
        <div className="space-y-8">
          {/* Sekcja: Nowe zamówienia */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Nowe zamówienia</h2>
            {newOrders.length === 0 ? (
              <p>Brak nowych zamówień.</p>
            ) : (
              <ul className="space-y-4">
                {newOrders.map((order) => (
                  <li key={order.id} className="bg-white p-4 rounded shadow">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                      <div>
                        <p className="font-bold text-lg">
                          {order.customer_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                        {renderOrderDetails(order)}
                        <p className="text-sm">
                          <strong>Status:</strong>{" "}
                          <span className="font-medium">{order.status}</span>
                        </p>
                      </div>
                      <div className="mt-4 md:mt-0 flex flex-col gap-2">
                        {(order.status === "new" ||
                          order.status === "placed") && (
                          <AcceptButton
                            orderId={order.id}
                            onOrderUpdated={(data: Partial<Order>) => {
                              handleOrderUpdated(order.id, {
                                ...data,
                                status: "accepted",
                              });
                              fetchOrders();
                            }}
                          />
                        )}
                        <EditOrderButton
                          orderId={order.id}
                          onOrderUpdated={() => {
                            handleOrderUpdated(order.id);
                            fetchOrders();
                          }}
                        />
                        <CancelButton
                          orderId={order.id}
                          onOrderUpdated={(id: string) => {
                            handleOrderUpdated(id, { status: "cancelled" });
                            fetchOrders();
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Sekcja: Zamówienia w realizacji */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              Zamówienia w realizacji
            </h2>
            {currentOrders.length === 0 ? (
              <p>Brak zamówień w realizacji.</p>
            ) : (
              <ul className="space-y-4">
                {currentOrders.map((order) => (
                  <li key={order.id} className="bg-white p-4 rounded shadow">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                      <div>
                        <p className="font-bold text-lg">
                          {order.customer_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                        {renderOrderDetails(order)}
                        <p className="text-sm">
                          <strong>Status:</strong>{" "}
                          <span className="font-medium">{order.status}</span>
                        </p>
                        {order.deliveryTime && (
                          <div className="mt-2">
                            <span>Czas do dostawy: </span>
                            <CountdownTimer targetTime={order.deliveryTime} />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 md:mt-0 flex flex-col gap-2">
                        <EditOrderButton
                          orderId={order.id}
                          onOrderUpdated={() => {
                            handleOrderUpdated(order.id);
                            fetchOrders();
                          }}
                        />
                        <button
                          onClick={async () => {
                            // Jeśli deliveryTime nie jest ustawione, używamy bieżącego czasu
                            const baseTime = order.deliveryTime
                              ? new Date(order.deliveryTime)
                              : new Date();
                            const newTime = new Date(
                              baseTime.getTime() + 15 * 60000
                            ).toISOString();
                            const res = await fetch(`/api/orders/${order.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ deliveryTime: newTime }),
                            });
                            if (res.ok) {
                              const result = await res.json();
                              handleOrderUpdated(order.id, {
                                deliveryTime: result.data.deliveryTime,
                              });
                              fetchOrders();
                            } else {
                              console.error("Błąd dodawania 15 min");
                            }
                          }}
                          className="px-4 py-2 bg-yellow-500 text-white rounded"
                        >
                          +15 min
                        </button>
                        <CancelButton
                          orderId={order.id}
                          onOrderUpdated={(id: string) => {
                            handleOrderUpdated(id, { status: "cancelled" });
                            fetchOrders();
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

         {/* Sekcja: Historia */}
<section>
  <h2 className="text-2xl font-semibold mb-4">Historia</h2>
  {historyOrders.length === 0 ? (
    <p>Brak historii zamówień.</p>
  ) : (
    <ul className="space-y-4">
      {historyOrders.map((order) => (
        <li key={order.id} className="bg-gray-200 p-4 rounded shadow">
          <div>
            <p className="font-bold text-lg">{order.customer_name}</p>
            {renderOrderDetails(order)}
            <p className="text-sm">
              <strong>Status:</strong>{" "}
              <span className="font-medium">{order.status}</span>
            </p>
          </div>
          {order.status === "cancelled" && (
            <button
              onClick={async () => {
                // Przywracamy zamówienie do statusu "new"
                const res = await fetch(`/api/orders/${order.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "new" }),
                });
                if (res.ok) {
                  const result = await res.json();
                  handleOrderUpdated(order.id, { status: "new" });
                  fetchOrders();
                } else {
                  console.error("Błąd przywracania zamówienia");
                }
              }}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Przywróć
            </button>
          )}
        </li>
      ))}
    </ul>
  )}
</section>
        </div>
      )}
    </div>
  );
}
