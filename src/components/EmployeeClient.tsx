"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import EditOrderButton from "@/components/EditOrderButton";
import CancelButton from "@/components/CancelButton";

interface Order {
  id: string;
  customer_name?: string;
  total_price: number;
  created_at: string;
  status: "new" | "placed" | "accepted" | "cancelled" | "completed";
  clientDelivery?: string;
  deliveryTime?: string;
  address?: string;
  street?: string;
  flat_number?: string;
  city?: string;
  phone?: string;
  items?: any;
  order_items?: any;
  selected_option?: "local" | "takeaway" | "delivery";
}

const getOptionLabel = (opt?: Order["selected_option"]) => {
  if (opt === "local") return "NA MIEJSCU";
  if (opt === "takeaway") return "NA WYNOS";
  if (opt === "delivery") return "DOSTAWA";
  return "BRAK";
};

const getBorderClass = (status: Order["status"]) => {
  switch (status) {
    case "new":
    case "placed":
      return "ring-2 ring-yellow-400";
    case "accepted":
      return "ring-2 ring-blue-500";
    case "cancelled":
      return "ring-2 ring-red-500";
    case "completed":
      return "ring-2 ring-gray-300";
    default:
      return "ring-2 ring-gray-300";
  }
};

const parseProducts = (itemsData: any): any[] => {
  if (!itemsData) return [];
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData === "object") {
    if (Array.isArray(itemsData.order_items)) return itemsData.order_items;
    if (Array.isArray(itemsData.items)) return itemsData.items;
    return [itemsData];
  }
  if (typeof itemsData === "string") {
    try {
      const parsed = JSON.parse(itemsData);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return itemsData
      .split(",")
      .map((n: string) => ({ name: n.trim(), quantity: 1, price: 0 }));
  }
  return [];
};

const ProductItem: React.FC<{ prod: any }> = ({ prod }) => (
  <div className="border p-3 rounded-lg mb-2 bg-gray-50">
    <div className="flex justify-between">
      <div className="font-semibold truncate">
        {prod.name} –{" "}
        {typeof prod.price === "number"
          ? prod.price.toFixed(2)
          : prod.price ?? prod.unit_price}{" "}
        zł
      </div>
      <div className="text-sm">Ilość: {prod.quantity}</div>
    </div>
    {prod.addons && (
      <div className="mt-1 text-xs">
        <strong>Dodatki:</strong>{" "}
        {Array.isArray(prod.addons) ? prod.addons.join(", ") : prod.addons}
      </div>
    )}
    {prod.extraMeatCount && (
      <div className="mt-1 text-xs">
        <strong>Dodatkowe mięso:</strong> {prod.extraMeatCount} por.
      </div>
    )}
    {prod.note && (
      <div className="mt-1 text-xs italic">Notatka: {prod.note}</div>
    )}
  </div>
);

const ProductDetailsModal: React.FC<{ product: any; onClose(): void }> = ({
  product,
  onClose,
}) => {
  const title =
    product.quantity && product.quantity > 1
      ? `${product.name} x${product.quantity}`
      : product.name;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 px-4">
      <div className="bg-white p-6 rounded-xl max-w-md w-full border shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        {product.description && (
          <p className="mb-2">
            <strong>Opis:</strong> {product.description}
          </p>
        )}
        {product.ingredients && product.ingredients.length > 0 && (
          <div>
            <strong>Składniki:</strong>
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
              {product.addons.map((a: string, i: number) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white py-2 px-6 rounded-full font-medium"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

// prosty licznik odliczający do targetTime
const InlineCountdown: React.FC<{
  targetTime: string;
  onComplete?: () => void;
}> = ({ targetTime, onComplete }) => {
  const [remaining, setRemaining] = useState<number>(() => {
    const diff = new Date(targetTime).getTime() - Date.now();
    return Math.max(0, diff);
  });

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
      if (diff <= 0) {
        onComplete?.();
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetTime, onComplete]);

  const fmt = () => {
    if (remaining <= 0) return "00:00";
    const totalSec = Math.floor(remaining / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="inline-flex items-center gap-1 bg-gray-800 text-white text-xs px-2 py-1 rounded-full font-mono">
      <span className="font-semibold">{fmt()}</span>
    </div>
  );
};

// === AcceptButtonCustom ===
interface AcceptButtonCustomProps {
  order: Order;
  onAccept: (minutes: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

const AcceptButtonCustom: React.FC<AcceptButtonCustomProps> = ({
  order,
  onAccept,
  onEditStart,
  onEditEnd,
}) => {
  const isDelivery = order.selected_option === "delivery";
  const pickupOptions = [15, 30, 45, 60];
  const deliveryOptions = [30, 60, 90, 120];
  const options = isDelivery ? deliveryOptions : pickupOptions;

  const [open, setOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(options[0]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (order.deliveryTime && order.deliveryTime !== "asap") {
      const diff = Math.round(
        (new Date(order.deliveryTime).getTime() - Date.now()) / 60000
      );
      if (diff > 0) {
        let candidate = options.reduce((prev, curr) =>
          Math.abs(curr - diff) < Math.abs(prev - diff) ? curr : prev
        );
        if (candidate < 0) candidate = options[0];
        setSelectedMinutes(candidate);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.deliveryTime]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleAccept = async (mins: number) => {
    onEditStart?.();
    await onAccept(mins);
    setSelectedMinutes(mins);
    setOpen(false);
    onEditEnd?.();
  };

  return (
    <div className="relative inline-block" ref={(el) => (containerRef.current = el)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-full px-4 py-2 font-semibold relative shadow"
        aria-label="Akceptuj zamówienie"
      >
        <span>
          Akceptuj (
          {selectedMinutes >= 60
            ? `${selectedMinutes / 60}h`
            : `${selectedMinutes} min`}
          )
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-150 ${open ? "rotate-180" : "rotate-0"}`}
        >
          <path
            d="M5 7L10 12L15 7"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-max bg-white border rounded shadow-lg z-50 min-w-[150px]">
          {options.map((m) => (
            <button
              key={m}
              onClick={() => handleAccept(m)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex justify-between"
            >
              <span>{m >= 60 ? `${m / 60}h` : `${m} min`}</span>
              {selectedMinutes === m && <span className="text-green-600 font-bold">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
// === koniec AcceptButtonCustom ===

export default function EmployeeClient() {
  const supabase = createClientComponentClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const ordersPerPage = 10;
  const [totalCount, setTotalCount] = useState<number>(0);

  const [filterStatus, setFilterStatus] = useState<"all" | Order["status"]>("all");
  const [filterOption, setFilterOption] = useState<"all" | Order["selected_option"]>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const prevNewCount = useRef<number>(0);
  const newOrderAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    newOrderAudio.current = new Audio("/new-order.mp3");
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      if (!editingOrderId) setLoading(true);
      const offset = (currentPage - 1) * ordersPerPage;
      const res = await fetch(`/api/orders/current?limit=${ordersPerPage}&offset=${offset}`);
      if (!res.ok) {
        if (res.status === 401) return;
        console.error("Błąd pobierania zamówień:", res.statusText);
        return;
      }
      const { orders: raw, totalCount: tc } = await res.json();
      const mapped: Order[] = raw.map((o: any) => ({
        id: o.id,
        customer_name: o.customer_name,
        total_price: o.total_price,
        created_at: o.created_at,
        status: o.status,
        clientDelivery: o.delivery_time ?? o.clientDelivery,
        deliveryTime: o.employee_delivery_time ?? o.deliveryTime,
        address:
          o.selected_option === "delivery"
            ? `${o.street || ""}${o.flat_number ? `, nr ${o.flat_number}` : ""}${o.city ? `, ${o.city}` : ""}`
            : o.address || "",
        street: o.street,
        flat_number: o.flat_number,
        city: o.city,
        phone: o.phone,
        items: o.items ?? o.order_items ?? [],
        selected_option: o.selected_option,
      }));

      setTotalCount(tc ?? 0);
      setOrders((prev) => {
        const byId = new Map(prev.map((o) => [o.id, o]));
        mapped.forEach((o) => {
          byId.set(o.id, o);
        });
        return Array.from(byId.values()).sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return sortOrder === "desc" ? tb - ta : ta - tb;
        });
      });

      const newCount = mapped.filter((o) => o.status === "new" || o.status === "placed").length;
      if (newCount > prevNewCount.current && newOrderAudio.current) {
        newOrderAudio.current.play().catch(() => {});
      }
      prevNewCount.current = newCount;
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      if (!editingOrderId) setLoading(false);
    }
  }, [currentPage, editingOrderId, sortOrder]);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const updatedRaw = payload.new as any;
        const updated: Order = {
          id: updatedRaw.id,
          customer_name: updatedRaw.customer_name,
          total_price: updatedRaw.total_price,
          created_at: updatedRaw.created_at,
          status: updatedRaw.status,
          clientDelivery: updatedRaw.delivery_time ?? updatedRaw.clientDelivery,
          deliveryTime: updatedRaw.employee_delivery_time ?? updatedRaw.deliveryTime,
          address:
            updatedRaw.selected_option === "delivery"
              ? `${updatedRaw.street || ""}${updatedRaw.flat_number ? `, nr ${updatedRaw.flat_number}` : ""}${updatedRaw.city ? `, ${updatedRaw.city}` : ""}`
              : updatedRaw.address || "",
          street: updatedRaw.street,
          flat_number: updatedRaw.flat_number,
          city: updatedRaw.city,
          phone: updatedRaw.phone,
          items: updatedRaw.items ?? updatedRaw.order_items ?? [],
          selected_option: updatedRaw.selected_option,
        };
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === updated.id);
          if (idx === -1) return [updated, ...prev];
          if (editingOrderId === updated.id) {
            return prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
          }
          return prev.map((o) => (o.id === updated.id ? updated : o));
        });
        if ((updated.status === "new" || updated.status === "placed") && newOrderAudio.current) {
          newOrderAudio.current.play().catch(() => {});
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders, supabase, editingOrderId]);

  useEffect(() => {
    if (editingOrderId) return;
    const iv = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(iv);
  }, [fetchOrders, editingOrderId]);

  const updateOrderLocal = (id: string, upd: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...upd } : o)));
  };

  const completeOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        updateOrderLocal(id, { status: "completed" });
      } else {
        console.error("Nie udało się zakończyć zamówienia");
      }
    } catch (e) {
      console.error("Błąd completeOrder:", e);
    }
  };

  const acceptAndSend = async (order: Order, minutes: number) => {
    const dt = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      setEditingOrderId(order.id);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "accepted",
          employee_delivery_time: dt,
        }),
      });
      if (!res.ok) return;
      updateOrderLocal(order.id, { status: "accepted", deliveryTime: dt });

      const humanTime = new Date(dt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });

      await fetch("/api/twilio/send-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          delivery_time: dt,
          friendly_time: humanTime,
        }),
      });

      await fetch("/api/dotykacka/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });

      fetchOrders();
    } catch (e) {
      console.error("acceptAndSend error:", e);
    } finally {
      setEditingOrderId(null);
    }
  };

  const extendTime = async (order: Order, minutes: number) => {
    const base =
      order.deliveryTime && !isNaN(Date.parse(order.deliveryTime))
        ? new Date(order.deliveryTime)
        : new Date();
    const dt = new Date(base.getTime() + minutes * 60000).toISOString();
    try {
      setEditingOrderId(order.id);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_delivery_time: dt }),
      });
      if (!res.ok) return;
      updateOrderLocal(order.id, { deliveryTime: dt });

      const humanTime = new Date(dt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });

      await fetch("/api/twilio/send-time-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          delivery_time: dt,
          friendly_time: humanTime,
        }),
      });

      fetchOrders();
    } catch (e) {
      console.error("extendTime error:", e);
    } finally {
      setEditingOrderId(null);
    }
  };

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (filterStatus === "all" ? true : o.status === filterStatus))
      .filter((o) => (filterOption === "all" ? true : o.selected_option === filterOption))
      .sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? tb - ta : ta - tb;
      });
  }, [orders, filterStatus, filterOption, sortOrder]);

  const newList = useMemo(() => filtered.filter((o) => o.status === "new" || o.status === "placed"), [filtered]);
  const currList = useMemo(() => filtered.filter((o) => o.status === "accepted"), [filtered]);
  const histList = useMemo(
    () => filtered.filter((o) => o.status === "cancelled" || o.status === "completed"),
    [filtered]
  );

  const handleOrderUpdated = (orderId: string, updatedData?: Partial<Order>) => {
    if (updatedData) {
      updateOrderLocal(orderId, updatedData);
    } else {
      fetchOrders();
    }
  };

  return (
    <div className="min-h-screen p-4 space-y-6 bg-white text-black">
      {/* FILTRY */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 flex-wrap">
          <select
            className="border p-2 rounded shadow-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | Order["status"])}
          >
            <option value="all">Wszystkie statusy</option>
            <option value="new">Nowe</option>
            <option value="placed">Złożone</option>
            <option value="accepted">W trakcie</option>
            <option value="cancelled">Anulowane</option>
            <option value="completed">Zrealizowane</option>
          </select>
          <select
            className="border p-2 rounded shadow-sm"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value as "all" | Order["selected_option"])}
          >
            <option value="all">Wszystkie opcje</option>
            <option value="local">Na miejscu</option>
            <option value="takeaway">Na wynos</option>
            <option value="delivery">Dostawa</option>
          </select>
          <button
            type="button"
            className="border p-2 rounded shadow-sm"
            onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
          >
            {sortOrder === "desc" ? "Najnowsze" : "Najstarsze"}
          </button>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            className="bg-green-600 text-white px-4 py-2 rounded shadow"
            onClick={() => fetchOrders()}
            disabled={loading}
          >
            Odśwież
          </button>
        </div>
      </div>

      {/* NOWE */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Nowe zamówienia</h2>
        {loading && !editingOrderId && <p className="text-center text-gray-600">Ładowanie...</p>}
        <ul className="space-y-4">
          {newList.length === 0 && (
            <li>
              <p className="text-center text-gray-600">Brak nowych zamówień.</p>
            </li>
          )}
          {newList.map((o) => (
            <li key={o.id} className={`p-6 rounded-xl shadow-md relative ${getBorderClass(o.status)} bg-white`}>
              <div className="flex flex-col md:flex-row items-start justify-between mb-4 border-b pb-2 gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                      {o.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm flex flex-wrap gap-2">
                    <div>
                      <strong>Klient:</strong> {o.customer_name || "—"}
                    </div>
                    <div>
                      <strong>Czas (klient):</strong>{" "}
                      {o.clientDelivery === "asap"
                        ? "Jak najszybciej"
                        : o.clientDelivery
                        ? new Date(o.clientDelivery).toLocaleTimeString()
                        : "-"}
                    </div>
                  </div>
                </div>
                <div className="text-base text-gray-600 font-bold whitespace-nowrap flex flex-col items-end gap-1">
                  <div>{new Date(o.created_at).toLocaleString()}</div>
                  {o.deliveryTime && o.status === "accepted" && (
                    <InlineCountdown targetTime={o.deliveryTime} onComplete={() => completeOrder(o.id)} />
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Kwota:</strong> {o.total_price.toFixed(2)} zł
                  </p>
                  {o.selected_option === "delivery" && o.address && (
                    <p className="text-sm">
                      <strong>Adres:</strong> {o.address}
                    </p>
                  )}
                  {o.phone && (
                    <p className="text-sm">
                      <strong>Telefon:</strong> {o.phone}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <strong>Produkty:</strong>
                  {(!o.items || parseProducts(o.items).length === 0) ? (
                    <span> brak</span>
                  ) : (
                    <ul className="space-y-2 mt-1">
                      {parseProducts(o.items).map((p: any, i: number) => (
                        <li key={i}>
                          <ProductItem prod={p} />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProduct({ ...p });
                              setEditingOrderId(o.id);
                            }}
                            className="text-sm text-blue-600 underline hover:text-blue-500 mt-1"
                          >
                            Szczegóły
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <AcceptButtonCustom
                  order={o}
                  onAccept={(minutes) => {
                    setEditingOrderId(o.id);
                    acceptAndSend(o, minutes).finally(() => setEditingOrderId(null));
                  }}
                  onEditStart={() => setEditingOrderId(o.id)}
                  onEditEnd={() => setEditingOrderId(null)}
                />
                <EditOrderButton
                  orderId={o.id}
                  currentProducts={parseProducts(o.items)}
                  currentSelectedOption={o.selected_option || "local"}
                  onOrderUpdated={handleOrderUpdated}
                  onEditStart={() => setEditingOrderId(o.id)}
                  onEditEnd={() => setEditingOrderId(null)}
                />
                <CancelButton orderId={o.id} onOrderUpdated={() => fetchOrders()} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* W REALIZACJI */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Zamówienia w realizacji</h2>
        <ul className="space-y-4">
          {currList.length === 0 && (
            <li>
              <p className="text-center text-gray-600">Brak zamówień w realizacji.</p>
            </li>
          )}
          {currList.map((o) => (
            <li key={o.id} className={`p-6 rounded-xl shadow-md relative ${getBorderClass(o.status)} bg-white`}>
              <div className="flex flex-col md:flex-row items-start justify-between mb-4 border-b pb-2 gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                    <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                      AKCEPTOWANE
                    </span>
                  </div>
                  <div className="text-sm flex flex-wrap gap-2">
                    <div>
                      <strong>Klient:</strong> {o.customer_name || "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 md:mt-0 flex flex-col items-end gap-2">
                  {o.deliveryTime === "asap" ? (
                    <div className="text-sm font-medium">Jak najszybciej</div>
                  ) : (
                    o.deliveryTime && (
                      <InlineCountdown
                        targetTime={o.deliveryTime}
                        onComplete={() => completeOrder(o.id)}
                      />
                    )
                  )}
                  <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Kwota:</strong> {o.total_price.toFixed(2)} zł
                  </p>
                  {o.selected_option === "delivery" && o.address && (
                    <p className="text-sm">
                      <strong>Adres:</strong> {o.address}
                    </p>
                  )}
                  {o.phone && (
                    <p className="text-sm">
                      <strong>Telefon:</strong> {o.phone}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <strong>Produkty:</strong>
                  {(!o.items || parseProducts(o.items).length === 0) ? (
                    <span> brak</span>
                  ) : (
                    <ul className="space-y-2 mt-1">
                      {parseProducts(o.items).map((p: any, i: number) => (
                        <li key={i}>
                          <ProductItem prod={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <CancelButton orderId={o.id} onOrderUpdated={() => fetchOrders()} />
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => extendTime(o, m)}
                    className="w-28 h-10 bg-green-600 hover:bg-green-500 text-white rounded-full font-semibold text-sm"
                  >
                    {m >= 60 ? `${m / 60} H` : `${m} MIN`}
                  </button>
                ))}
                <EditOrderButton
                  orderId={o.id}
                  currentProducts={parseProducts(o.items)}
                  currentSelectedOption={o.selected_option || "local"}
                  onOrderUpdated={handleOrderUpdated}
                  onEditStart={() => setEditingOrderId(o.id)}
                  onEditEnd={() => setEditingOrderId(null)}
                />
                <button
                  type="button"
                  onClick={() => completeOrder(o.id)}
                  className="w-32 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold text-sm"
                >
                  Zrealizowany
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* HISTORIA */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-300 pb-2">Historia</h2>
        <ul className="space-y-4">
          {histList.length === 0 && (
            <li>
              <p className="text-center text-gray-600">Brak historii zamówień.</p>
            </li>
          )}
          {histList.map((o) => (
            <li key={o.id} className={`p-6 rounded-xl shadow-md relative ${getBorderClass(o.status)} bg-white`}>
              <div className="flex flex-col md:flex-row items-start justify-between mb-4 border-b pb-2 gap-4">
                <div>
                  <h3 className="text-xl font-bold">{getOptionLabel(o.selected_option)}</h3>
                  <p className="text-sm">
                    Status:{" "}
                    <span className={o.status === "completed" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {o.status.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div className="text-base text-gray-600 font-bold whitespace-nowrap">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Kwota:</strong> {o.total_price.toFixed(2)} zł
                  </p>
                  {o.selected_option === "delivery" && o.address && (
                    <p className="text-sm">
                      <strong>Adres:</strong> {o.address}
                    </p>
                  )}
                  {o.phone && (
                    <p className="text-sm">
                      <strong>Telefon:</strong> {o.phone}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <strong>Produkty:</strong>
                  {(!o.items || parseProducts(o.items).length === 0) ? (
                    <span> brak</span>
                  ) : (
                    <ul className="space-y-2 mt-1">
                      {parseProducts(o.items).map((p: any, i: number) => (
                        <li key={i}>
                          <ProductItem prod={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {o.status === "cancelled" && (
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/orders/${o.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "new" }),
                      });
                      updateOrderLocal(o.id, { status: "new" });
                      fetchOrders();
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
      </section>

      {/* MODAL SZCZEGÓŁY */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => {
            setSelectedProduct(null);
            setEditingOrderId(null);
          }}
        />
      )}

      {/* PAGINACJA */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-6">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          Poprzednia
        </button>
        <span className="text-gray-600">
          Strona {currentPage} z {Math.ceil(totalCount / ordersPerPage)}
        </span>
        <button
          type="button"
          onClick={() =>
            setCurrentPage((p) =>
              p < Math.ceil(totalCount / ordersPerPage) ? p + 1 : p
            )
          }
          disabled={currentPage >= Math.ceil(totalCount / ordersPerPage)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          Następna
        </button>
      </div>
    </div>
  );
}
