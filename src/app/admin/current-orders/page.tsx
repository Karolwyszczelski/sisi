// src/app/admin/current-orders/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { useTheme } from "@/components/admin/ThemeContext";
import { RefreshCw, Clock, MapPin, Phone, Package, Truck, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  addons?: string[];
  note?: string;
}

interface Order {
  id: string;
  customer_name?: string;
  name?: string;
  total_price: number;
  created_at: string;
  status: string;
  address?: string;
  street?: string;
  city?: string;
  flat_number?: string;
  phone?: string;
  selected_option?: "local" | "takeaway" | "delivery";
  delivery_time?: string;
  client_delivery_time?: string;
  items?: OrderItem[] | string;
  order_note?: string;
}

// === TZ helpers ===
const APP_TZ = "Europe/Warsaw";

const fmtDateTimePL = (iso?: string | null) => {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  return new Date(t).toLocaleString("pl-PL", { timeZone: APP_TZ });
};

const fmtTimePL = (iso?: string | null) => {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  return new Date(t).toLocaleTimeString("pl-PL", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatClientDeliveryTime = (val: string | null | undefined): string => {
  if (!val) return "–";
  if (val === "asap") return "Jak najszybciej";
  // HH:mm format
  if (/^\d{1,2}:\d{2}$/.test(val)) return val;
  // Try parsing as JSON
  try {
    const parsed = JSON.parse(val);
    if (parsed?.client_delivery_time) {
      if (parsed.client_delivery_time === "asap") return "Jak najszybciej";
      return parsed.client_delivery_time;
    }
  } catch {}
  // ISO date
  const t = Date.parse(val);
  if (!Number.isNaN(t)) return fmtTimePL(val);
  return val;
};

const parseItems = (items: OrderItem[] | string | undefined): OrderItem[] => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    return JSON.parse(items);
  } catch {
    return [];
  }
};

const getOptionIcon = (opt?: string) => {
  if (opt === "local") return MapPin;
  if (opt === "takeaway") return ShoppingBag;
  return Truck;
};

const getOptionLabel = (opt?: string) => {
  if (opt === "local") return "Na miejscu";
  if (opt === "takeaway") return "Na wynos";
  return "Dostawa";
};

const getStatusBadge = (status: string, isDark: boolean) => {
  const base = "px-2 py-0.5 rounded-full text-xs font-medium";
  switch (status) {
    case "new":
      return `${base} ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"}`;
    case "placed":
      return `${base} ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`;
    case "accepted":
      return `${base} ${isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"}`;
    default:
      return `${base} ${isDark ? "bg-slate-500/20 text-slate-400" : "bg-gray-100 text-gray-600"}`;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "new": return "Nowe";
    case "placed": return "Złożone";
    case "accepted": return "W realizacji";
    default: return status;
  }
};

export default function CurrentOrdersPage() {
  const supabase = createClientComponentClient<Database>();
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["new", "placed", "accepted"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Błąd pobierania bieżących zamówień:", error);
      setOrders([]);
    } else {
      setOrders((data as unknown as Order[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
    
    // Realtime subscription
    const channel = supabase
      .channel("current-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadOrders]);

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getFullAddress = (o: Order) => {
    const parts = [o.street, o.flat_number && `m. ${o.flat_number}`, o.city, o.address].filter(Boolean);
    return parts.join(", ") || "–";
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          Bieżące zamówienia
        </h1>
        <button
          onClick={loadOrders}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            isDark 
              ? "bg-slate-800 hover:bg-slate-700 text-slate-300" 
              : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
          } disabled:opacity-50`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Nowe", status: "new", color: "blue" },
          { label: "Złożone", status: "placed", color: "amber" },
          { label: "W realizacji", status: "accepted", color: "green" },
        ].map(({ label, status, color }) => {
          const count = orders.filter(o => o.status === status).length;
          return (
            <div
              key={status}
              className={`rounded-xl p-4 ${
                isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-white border border-gray-200"
              }`}
            >
              <div className={`text-2xl font-bold ${
                isDark 
                  ? color === "blue" ? "text-blue-400" : color === "amber" ? "text-amber-400" : "text-green-400"
                  : color === "blue" ? "text-blue-600" : color === "amber" ? "text-amber-600" : "text-green-600"
              }`}>
                {count}
              </div>
              <div className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className={`h-8 w-8 animate-spin rounded-full border-2 ${
            isDark ? "border-slate-600 border-t-slate-400" : "border-gray-300 border-t-gray-600"
          }`} />
        </div>
      ) : orders.length === 0 ? (
        <div className={`text-center py-12 rounded-xl ${isDark ? "bg-slate-800/50" : "bg-white border border-gray-200"}`}>
          <Package className={`h-12 w-12 mx-auto mb-3 ${isDark ? "text-slate-600" : "text-gray-300"}`} />
          <p className={`text-lg ${isDark ? "text-slate-400" : "text-gray-500"}`}>Brak zamówień w realizacji</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const isExpanded = expandedOrders.has(o.id);
            const items = parseItems(o.items);
            const OptionIcon = getOptionIcon(o.selected_option);
            const customerName = o.customer_name || o.name || "—";

            return (
              <div
                key={o.id}
                className={`rounded-xl overflow-hidden transition ${
                  isDark ? "bg-slate-800/60 border border-slate-700/50" : "bg-white border border-gray-200"
                }`}
              >
                {/* Order header */}
                <div
                  className={`p-4 cursor-pointer ${isDark ? "hover:bg-slate-700/30" : "hover:bg-gray-50"}`}
                  onClick={() => toggleExpand(o.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Option icon */}
                      <div className={`p-2 rounded-lg ${
                        isDark ? "bg-slate-700/50" : "bg-gray-100"
                      }`}>
                        <OptionIcon className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                      </div>
                      
                      {/* Main info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {customerName}
                          </span>
                          <span className={getStatusBadge(o.status, isDark)}>
                            {getStatusLabel(o.status)}
                          </span>
                        </div>
                        <div className={`text-sm flex items-center gap-3 mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          <span>{fmtDateTimePL(o.created_at)}</span>
                          <span>•</span>
                          <span>{getOptionLabel(o.selected_option)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Delivery time */}
                      <div className={`flex items-center gap-1.5 text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                        <Clock className="h-4 w-4" />
                        <span>{formatClientDeliveryTime(o.client_delivery_time)}</span>
                      </div>

                      {/* Price */}
                      <div className={`font-bold text-lg ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                        {Number(o.total_price).toFixed(2)} zł
                      </div>

                      {/* Expand icon */}
                      {isExpanded ? (
                        <ChevronUp className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
                      ) : (
                        <ChevronDown className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-400"}`} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className={`px-4 pb-4 border-t ${isDark ? "border-slate-700/50" : "border-gray-100"}`}>
                    <div className="grid md:grid-cols-2 gap-4 pt-4">
                      {/* Left column - Customer info */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                          Dane klienta
                        </h4>
                        
                        {o.phone && (
                          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${o.phone}`} className="hover:underline">{o.phone}</a>
                          </div>
                        )}

                        {o.selected_option === "delivery" && (
                          <div className={`flex items-start gap-2 text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{getFullAddress(o)}</span>
                          </div>
                        )}

                        {o.order_note && (
                          <div className={`p-3 rounded-lg text-sm ${
                            isDark ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            <strong>Uwagi:</strong> {o.order_note}
                          </div>
                        )}
                      </div>

                      {/* Right column - Items */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                          Produkty ({items.length})
                        </h4>
                        
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className={`flex justify-between items-start p-2 rounded-lg ${
                                isDark ? "bg-slate-700/30" : "bg-gray-50"
                              }`}
                            >
                              <div>
                                <div className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                                  {item.quantity}x {item.name}
                                </div>
                                {item.addons && item.addons.length > 0 && (
                                  <div className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                                    + {item.addons.join(", ")}
                                  </div>
                                )}
                                {item.note && (
                                  <div className={`text-xs mt-0.5 italic ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                                    &bdquo;{item.note}&rdquo;
                                  </div>
                                )}
                              </div>
                              <div className={`font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                                {(Number(item.price) * item.quantity).toFixed(2)} zł
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
