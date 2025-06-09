"use client";

import React, { useState, useEffect, useRef } from "react"
import AcceptButton from "./AcceptButton";
import EditOrderButton from "@/components/EditOrderButton";
import CancelButton from "@/components/CancelButton";
import CountdownTimer from "@/components/CountdownTimer";
import productsData from "@/data/product.json";

/** Typ zamówienia */
interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  status: "new" | "placed" | "accepted" | "cancelled" | "completed";
  deliveryTime?: string;
  client_delivery_time?: string;
  delivery_cost: o.delivery_cost,
  street: o.street,
  flat_number: o.flat_number,
  city: o.city,
  postal_code: o.postal_code,
  address: string;
  phone: string;
  items: any; // Zawiera pełny JSON produktów
  selected_option?: "local" | "takeaway" | "delivery";
}

/** Zwraca etykietę sposobu odbioru */
function getOptionLabel(option?: "local" | "takeaway" | "delivery") {
  if (option === "local") return "NA MIEJSCU";
  if (option === "takeaway") return "NA WYNOS";
  if (option === "delivery") return "DOSTAWA";
  return "BRAK";
}

/**
 * Próbuje sparsować dane produktów (oczekujemy, że są zapisane jako pełny JSON)
 *
 * Obsługuje:
 * - Jeśli dane są już tablicą → zwraca je
 * - Jeśli dane są obiektem i mają klucz "items" jako tablicę → zwraca te produkty
 * - Jeśli dane są pojedynczym obiektem → zwraca jako jednoelementową tablicę
 * - Jeśli dane są stringiem zaczynającym się od "[" → parsuje JSON
 * - W przeciwnym razie zwraca pustą tablicę
 */
function parseProducts(itemsData: any): any[] {
  if (!itemsData) return [];
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData === "object") {
    if (Array.isArray(itemsData.items)) return itemsData.items;
    return [itemsData];
  }
  if (typeof itemsData === "string") {
    const trimmed = itemsData.trim();
    if (trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        console.error("Błąd parsowania JSON:", err);
        return [];
      }
    }
    return trimmed.split(",").map((prod) => ({
      name: prod.trim(),
      quantity: 1,
      price: 0,
    }));
  }
  return [];
}

/** Szuka szczegółów produktu w product.json */
function findProductDetails(productName: string): any | null {
  for (const category of productsData) {
    if (category.subcategories) {
      for (const subcat of category.subcategories) {
        if (subcat.items) {
          for (const item of subcat.items) {
            if (item.name === productName) return item;
          }
        }
      }
    }
    if (category.items) {
      for (const item of category.items) {
        if (item.name === productName) return item;
      }
    }
  }
  return null;
}

/** Zwraca klasę obramowania wg statusu zamówienia */
function getBorderClass(status: Order["status"]): string {
  switch (status) {
    case "new":
    case "placed":
      return "border-2 border-blue-500";
    case "accepted":
      return "border-2 border-green-500";
    case "cancelled":
      return "border-2 border-red-500";
    case "completed":
      return "border-2 border-gray-500";
    default:
      return "border-2 border-gray-300";
  }
}

/** Modal wyświetlający szczegóły produktu (opis, składniki, dodatki) */
interface ProductDetailsModalProps {
  product: any;
  onClose: () => void;
}
function ProductDetailsModal({ product, onClose }: ProductDetailsModalProps) {
  const title =
    product.quantity && product.quantity > 1
      ? `${product.name} x${product.quantity}`
      : product.name;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white text-black p-6 rounded-lg max-w-md w-full border border-gray-300 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        {product.description && (
          <p className="mb-2">
            <strong>Opis:</strong> {product.description}
          </p>
        )}
        {product.ingredients && product.ingredients.length > 0 && (
          <div>
            <strong>Składniki bazowe:</strong>
            <ul className="list-disc list-inside mt-2">
              {product.ingredients.map((ing: string, i: number) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
        )}
        {product.addons && product.addons.length > 0 && (
          <div className="mt-4">
            <strong>Dodatki:</strong>
            <ul className="list-disc list-inside mt-2">
              {product.addons.map((addon: string, i: number) => (
                <li key={i}>{addon}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 bg-red-600 hover:bg-red-500 text-white py-1 px-4 rounded-full"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}

/** Komponent wyświetlający pojedynczy produkt zamówienia */
interface ProductItemProps {
  prod: any; // { name, quantity, price, addons, extraMeatCount, meatType }
}
const ProductItem: React.FC<ProductItemProps> = ({ prod }) => {
  return (
    <div className="border p-2 rounded-full mb-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold">
          {prod.name} – {prod.price} zł
        </span>
        <span className="text-sm">Ilość: {prod.quantity}</span>
      </div>
      <div className="mt-2">
        <strong>Dodatki:</strong>{" "}
        {prod.addons && prod.addons.length > 0 ? (
          <ul className="list-disc list-inside ml-4">
            {prod.addons.map((addon: string, i: number) => (
              <li key={i}>{addon}</li>
            ))}
          </ul>
        ) : (
          <span className="ml-2">Brak</span>
        )}
      </div>
      <div className="mt-2">
        <strong>Dodatkowe mięso:</strong>{" "}
        <span>{prod.extraMeatCount || 0} por.</span>
      </div>
    </div>
  );
};

/** Funkcja renderująca szczegóły zamówienia wraz z produktami */
function renderOrderDetailsInner(
  order: Order,
  setSelectedProduct: (prod: any) => void
): JSX.Element {
  // Używamy order.items zamiast order.products
  const parsedProducts = parseProducts(order.items);
  return (
    <div className="text-sm mt-2">
      <p>
        <strong>Kwota:</strong> {" "}
        {order.total_price} zł
      </p>
      <p>
        <strong>Adres:</strong>{" "}
        {order.street}
        {order.flat_number ? `, nr. ${order.flat_number}` : ""}
        {order.city ? `, ${order.city}` : ""}
      </p>
      <p>
        <strong>Telefon:</strong> {order.phone}
      </p>
      <div className="mt-2">
         <strong>Produkty:</strong> {order.total_price.toFixed(2)} zł
      
      {order.delivery_cost !== undefined && (
        <p>
          <strong>Dostawa:</strong> {order.delivery_cost.toFixed(2)} zł
        </p>
      )}
      <p>
        <strong>Razem:</strong>{" "}
        {(order.total_price + (order.delivery_cost || 0)).toFixed(2)} zł
      </p>
        {parsedProducts.length === 0 ? (
          <span> brak</span>
        ) : (
          <ul className="space-y-2 mt-1">
            {parsedProducts.map((prod, i) => (
              <li key={i}>
                <ProductItem prod={prod} />
                <button
                  onClick={() => {
                    const details = findProductDetails(prod.name);
                    if (details) {
                      setSelectedProduct({ ...details, ...prod });
                    }
                  }}
                  className="text-sm text-blue-500 underline hover:text-blue-400 mt-1 rounded-full"
                >
                  Szczegóły
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function renderOrderDetails(order: Order, setSelectedProduct: (prod: any) => void): JSX.Element {
  return renderOrderDetailsInner(order, setSelectedProduct);
}

/** MENU_PRODUCTS – lista produktów z pliku product.json */
const MENU_PRODUCTS = (() => {
  return (function flattenProducts(data: any[]): { name: string; price: number }[] {
    let products: { name: string; price: number }[] = [];
    data.forEach((category) => {
      if (category.subcategories) {
        category.subcategories.forEach((subcat: any) => {
          if (subcat.items) {
            products = products.concat(
              subcat.items.map((item: any) => ({
                name: item.name,
                price: item.price,
              }))
            );
          }
        });
      }
      if (category.items) {
        products = products.concat(
          category.items.map((item: any) => ({
            name: item.name,
            price: item.price,
          }))
        );
      }
    });
    return products;
  })(productsData);
})();

export default function EmployeeClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Paginacja
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 10;
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filtry i sortowanie
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOption, setFilterOption] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Audio notyfikacji
  const prevNewOrdersCount = useRef<number>(0);
  const newOrderAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    newOrderAudio.current = new Audio("/new-order.mp3");
  }, []);

  // Funkcje paginacji
  function handlePrevPage() {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  }
  function handleNextPage() {
    if (currentPage < Math.ceil(totalCount / ordersPerPage))
      setCurrentPage((prev) => prev + 1);
  }

  // Fetch zamówień
  async function fetchOrders() {
    try {
      const offset = (currentPage - 1) * ordersPerPage;
      const res = await fetch(`/api/orders/current?limit=${ordersPerPage}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Otrzymane zamówienia:", data.orders);
        setOrders(data.orders);
        setTotalCount(data.totalCount);

        const currentNewOrders = data.orders.filter(
          (order: Order) => order.status === "new" || order.status === "placed"
        ).length;
        if (currentNewOrders > prevNewOrdersCount.current && newOrderAudio.current) {
          newOrderAudio.current.play().catch((err) => console.error("Audio error:", err));
        }
        prevNewOrdersCount.current = currentNewOrders;
      } else {
        console.error("Błąd pobierania zamówień", res.status, res.statusText);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [currentPage]);

  const handleOrderUpdated = (orderId: string, updatedData?: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, ...updatedData } : order
      )
    );
  };

  async function handleCompleteOrder(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        handleOrderUpdated(orderId, { status: "completed" });
        fetchOrders();
      } else {
        console.error("Błąd aktualizacji zamówienia na 'completed'");
      }
    } catch (err) {
      console.error("Błąd przy aktualizacji zamówienia:", err);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const statusMatch = filterStatus === "all" ? true : order.status === filterStatus;
    const optionMatch = filterOption === "all" ? true : order.selected_option === filterOption;
    return statusMatch && optionMatch;
  });

  function sortByDate(a: Order, b: Order) {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === "desc" ? -diff : diff;
  }

  const newOrders = filteredOrders.filter(
    (order) => order.status === "new" || order.status === "placed"
  );
  const currentOrders = filteredOrders.filter(
    (order) => order.status === "accepted"
  );
  const historyOrders = filteredOrders.filter(
    (order) => order.status === "cancelled" || order.status === "completed"
  );

  const sortedNewOrders = [...newOrders].sort(sortByDate);
  const sortedCurrentOrders = [...currentOrders].sort(sortByDate);
  const sortedHistoryOrders = [...historyOrders].sort(sortByDate);

  /** Górna część karty – opis zamówienia */
  function renderOrderTop(order: Order): JSX.Element {
    return (
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        {/* wyświetlamy preferowany czas klienta dla dostawy */}
        {order.selected_option === "delivery" && order.client_delivery_time && (
          <div className="flex items-center space-x-2">
            <label className="text-sm font-semibold">Preferowany czas klienta:</label>
            <span className="text-sm px-2 py-1 border border-gray-300 rounded bg-gray-100">
             {order.client_delivery_time}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xl font-bold">{getOptionLabel(order.selected_option)}</span>
          <span className="text-sm font-semibold">
            Status:{" "}
            <span className={order.status === "accepted" ? "text-green-600" : "text-yellow-600"}>
              {order.status.toUpperCase()}
            </span>
          </span>
        </div>
        <div className="text-base text-gray-600 font-bold">
          {new Date(order.created_at).toLocaleString()}
        </div>
        {order.status === "accepted" && order.deliveryTime && (
          <div className="text-sm text-green-600 font-bold">
            <CountdownTimer
              targetTime={order.deliveryTime}
              onComplete={() => handleCompleteOrder(order.id)}
            />
          </div>
        )}
      </div>
    );
  }

  /** Renderuje szczegóły zamówienia wraz z produktami */
  function renderOrderDetails(order: Order): JSX.Element {
    return renderOrderDetailsInner(order, setSelectedProduct);
  }

  /** Akcje dla nowych zamówień – przyciski dodające czas, Edytuj i Anuluj */
  function renderNewOrderActions(order: Order): JSX.Element {
    return (
      <div className="flex flex-col sm:flex-row sm:justify-center gap-2 mt-4">
        <div className="flex gap-2">
          {[
            { label: "+30 MIN", minutes: 30 },
            { label: "+1 GODZ", minutes: 60 },
            { label: "+1,5 GODZ", minutes: 90 },
            { label: "+2 GODZ", minutes: 120 },
          ].map((btn) => (
            <button
              key={btn.minutes}
              onClick={async () => {
                const baseTime = new Date();
                const newTime = new Date(baseTime.getTime() + btn.minutes * 60000).toISOString();
                try {
                  const res = await fetch(`/api/orders/${order.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "accepted", deliveryTime: newTime }),
                  });
                  if (res.ok) {
                    const result = await res.json();
                    const updatedDeliveryTime = Array.isArray(result.data)
                      ? result.data[0].deliveryTime
                      : result.data.deliveryTime;
                    handleOrderUpdated(order.id, {
                      status: "accepted",
                      deliveryTime: updatedDeliveryTime,
                    });
                    fetchOrders();
                  } else {
                    console.error(`Błąd przyjmowania zamówienia z czasem ${btn.label}`);
                  }
                } catch (err) {
                  console.error(`Błąd przyjmowania zamówienia z czasem ${btn.label}:`, err);
                }
              }}
              className="w-28 h-10 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold text-sm"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-4">
          <EditOrderButton
            orderId={order.id}
            currentProducts={parseProducts(order.items)}
            currentSelectedOption={order.selected_option || "local"}
            onOrderUpdated={(id, updatedData) => {
              handleOrderUpdated(id, updatedData);
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
    );
  }

  /** Akcje dla zamówień w realizacji – przyciski: Cancel, dodawanie czasu, Edytuj oraz "Zrealizowany" */
  function renderInProgressActions(order: Order): JSX.Element {
    return (
      <div className="flex flex-col sm:flex-row sm:justify-center gap-2 mt-4">
        <div className="flex gap-2">
          <CancelButton
            orderId={order.id}
            onOrderUpdated={(id: string) => {
              handleOrderUpdated(id, { status: "cancelled" });
              fetchOrders();
            }}
          />
        </div>
        <div className="flex gap-2 mt-2 sm:mt-0">
          {[
            { label: "+15 MIN", minutes: 15 },
            { label: "+30 MIN", minutes: 30 },
          ].map((btn) => (
            <button
              key={btn.minutes}
              onClick={async () => {
                const baseTime = order.deliveryTime ? new Date(order.deliveryTime) : new Date();
                const newTime = new Date(baseTime.getTime() + btn.minutes * 60000).toISOString();
                try {
                  const res = await fetch(`/api/orders/${order.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deliveryTime: newTime }),
                  });
                  if (res.ok) {
                    const result = await res.json();
                    const updatedDeliveryTime = Array.isArray(result.data)
                      ? result.data[0].deliveryTime
                      : result.data.deliveryTime;
                    handleOrderUpdated(order.id, { deliveryTime: updatedDeliveryTime });
                    fetchOrders();
                  } else {
                    console.error(`Błąd dodawania ${btn.label}`);
                  }
                } catch (err) {
                  console.error(`Błąd dodawania ${btn.label}:`, err);
                }
              }}
              className="w-28 h-10 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold text-sm"
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2 sm:mt-0">
          <EditOrderButton
            orderId={order.id}
            currentProducts={parseProducts(order.items)}
            currentSelectedOption={order.selected_option || "local"}
            onOrderUpdated={(id, updatedData) => {
              handleOrderUpdated(id, updatedData);
              fetchOrders();
            }}
          />
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/orders/${order.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "completed" }),
                });
                if (res.ok) {
                  handleOrderUpdated(order.id, { status: "completed" });
                  fetchOrders();
                } else {
                  console.error("Błąd zmiany statusu na 'completed'");
                }
              } catch (err) {
                console.error("Błąd aktualizacji zamówienia:", err);
              }
            }}
            className="w-32 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold text-sm"
          >
            Zrealizowany
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 space-y-6">
      <header className="mb-4 flex flex-col items-center space-y-4">
        <h1 className="text-3xl font-bold">Panel Pracownika</h1>
        <div className="flex flex-col sm:flex-row sm:justify-center gap-4">
          <button
            onClick={fetchOrders}
            className="bg-green-600 hover:bg-green-500 text-white py-1 px-4 rounded-full"
          >
            Odśwież zamówienia
          </button>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-1 border border-gray-300 rounded-full bg-gray-200 text-black"
            >
              <option value="all">Wszystkie</option>
              <option value="new">Nowe</option>
              <option value="placed">Złożone</option>
              <option value="accepted">Akceptowane</option>
              <option value="cancelled">Anulowane</option>
              <option value="completed">Zakończone</option>
            </select>
            <label className="text-sm ml-2">Odbiór:</label>
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value)}
              className="p-1 border border-gray-300 rounded-full bg-gray-200 text-black"
            >
              <option value="all">Wszystkie</option>
              <option value="local">Na miejscu</option>
              <option value="takeaway">Na wynos</option>
              <option value="delivery">Dostawa</option>
            </select>
            <label className="text-sm ml-2">Sortuj:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="p-1 border border-gray-300 rounded-full bg-gray-200 text-black"
            >
              <option value="desc">Najnowsze</option>
              <option value="asc">Najstarsze</option>
            </select>
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-gray-600">Ładowanie zamówień...</p>
      ) : (
        <>
          <div className="space-y-8">
            {/* Sekcja: Nowe zamówienia */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 border-b border-gray-300 pb-2">
                Nowe zamówienia
              </h2>
              {sortedNewOrders.length === 0 ? (
                <p className="text-center text-gray-600">Brak nowych zamówień.</p>
              ) : (
                <ul className="space-y-4">
                  {sortedNewOrders.map((order) => (
                    <li
                      key={order.id}
                      className={`bg-white text-black p-6 rounded-xl ${getBorderClass(
                        order.status
                      )} shadow-md hover:shadow-xl transition-all`}
                    >
                      {renderOrderTop(order)}
                      {renderOrderDetails(order)}
                      {renderNewOrderActions(order)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Sekcja: Zamówienia w realizacji */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 border-b border-gray-300 pb-2">
                Zamówienia w realizacji
              </h2>
              {sortedCurrentOrders.length === 0 ? (
                <p className="text-center text-gray-600">Brak zamówień w realizacji.</p>
              ) : (
                <ul className="space-y-4">
                  {sortedCurrentOrders.map((order) => (
                    <li
                      key={order.id}
                      className={`bg-white text-black p-6 rounded-xl ${getBorderClass(order.status)} shadow-md hover:shadow-xl transition-all`}
                    >
                      {renderOrderTop(order)}
                      {renderOrderDetails(order)}
                      {renderInProgressActions(order)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Sekcja: Historia */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 border-b border-gray-300 pb-2">
                Historia
              </h2>
              {sortedHistoryOrders.length === 0 ? (
                <p className="text-center text-gray-600">Brak historii zamówień.</p>
              ) : (
                <ul className="space-y-4">
                  {sortedHistoryOrders.map((order) => (
                    <li
                      key={order.id}
                      className={`bg-white text-black p-6 rounded-xl ${getBorderClass(order.status)} shadow-md hover:shadow-xl transition-all`}
                    >
                      {renderOrderTop(order)}
                      {renderOrderDetails(order)}
                      {order.status === "cancelled" && (
                        <div className="flex justify-center mt-4">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/orders/${order.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "new" }),
                              });
                              if (res.ok) {
                                handleOrderUpdated(order.id, { status: "new" });
                                fetchOrders();
                              } else {
                                console.error("Błąd przywracania zamówienia");
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm"
                          >
                            Przywróć
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Przycisk "Dodaj produkt" */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowAddProductModal(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-full"
            >
              Dodaj produkt
            </button>
          </div>

          {/* Modal dodawania produktu */}
          {showAddProductModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
              <div className="bg-white p-6 rounded-full max-w-md w-full shadow-lg">
                <h4 className="text-2xl font-bold mb-4">Wybierz produkt</h4>
                <ul className="space-y-2">
                  {MENU_PRODUCTS.map((prod) => (
                    <li key={prod.name}>
                      <button
                        onClick={() => {
                          const newProd = {
                            name: prod.name,
                            price: prod.price,
                            quantity: 1,
                            addons: [],
                            extraMeatCount: 0,
                            meatType: "wołowina",
                          };
                          // Aktualizujemy lokalny stan zamówienia poprzez modyfikację pola items
                          const orderToUpdate = orders[0];
                          // Używamy orderToUpdate.items zamiast orderToUpdate.products
                          const currentProducts = parseProducts(orderToUpdate?.items || "[]");
                          currentProducts.push(newProd);
                          setShowAddProductModal(false);
                          fetchOrders();
                        }}
                        className="block w-full text-left px-3 py-2 border-b hover:bg-gray-100 rounded-full"
                      >
                        {prod.name} - {prod.price} zł
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="mt-2 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full w-full"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {/* Kontrola paginacji */}
          <div className="flex justify-center items-center space-x-4 mt-6">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full disabled:opacity-50"
            >
              Poprzednia
            </button>
            <span className="text-gray-600">
              Strona {currentPage} z {Math.ceil(totalCount / ordersPerPage)}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= Math.ceil(totalCount / ordersPerPage)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full disabled:opacity-50"
            >
              Następna
            </button>
          </div>
        </>
      )}

      {/* Modal szczegółów produktu */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
