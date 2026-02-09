"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { useTheme } from "@/components/admin/ThemeContext";
import { 
  RefreshCw, Clock, MapPin, Phone, Package, Truck, ShoppingBag, 
  ChevronDown, ChevronUp, Search, X, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Loader2, History
} from "lucide-react";

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
  payment_method?: string;
  discount_amount?: number;
  promo_code?: string;
}

const APP_TZ = "Europe/Warsaw";

const fmtDateTimePL = (iso?: string | null) => {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "–";
  return new Date(t).toLocaleString("pl-PL", { timeZone: APP_TZ });
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

const getStatusConfig = (status: string, isDark: boolean) => {
  switch (status?.toLowerCase()) {
    case "new":
      return {
        label: "Nowe",
        bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
        text: isDark ? "text-blue-400" : "text-blue-700",
        icon: Loader2,
      };
    case "placed":
      return {
        label: "Złożone",
        bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
        text: isDark ? "text-amber-400" : "text-amber-700",
        icon: Clock,
      };
    case "accepted":
      return {
        label: "W realizacji",
        bg: isDark ? "bg-cyan-500/20" : "bg-cyan-100",
        text: isDark ? "text-cyan-400" : "text-cyan-700",
        icon: Loader2,
      };
    case "completed":
      return {
        label: "Zrealizowane",
        bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
        text: isDark ? "text-emerald-400" : "text-emerald-700",
        icon: CheckCircle,
      };
    case "cancelled":
      return {
        label: "Anulowane",
        bg: isDark ? "bg-red-500/20" : "bg-red-100",
        text: isDark ? "text-red-400" : "text-red-700",
        icon: XCircle,
      };
    default:
      return {
        label: status || "—",
        bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
        text: isDark ? "text-slate-400" : "text-gray-600",
        icon: Package,
      };
  }
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type FilterType = "all" | "in_progress" | "completed" | "cancelled";

export default function HistoryPage() {
  const supabase = createClientComponentClient<Database>();
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 15;

  const debouncedSearch = useDebouncedValue(search, 250);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Błąd pobierania historii:", error);
      setOrders([]);
    } else {
      setOrders((data as unknown as Order[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        const status = (o.status || "").toLowerCase();
        if (filter === "in_progress") return status === "accepted" || status === "new" || status === "placed";
        if (filter === "completed") return status === "completed";
        if (filter === "cancelled") return status === "cancelled";
        return true;
      })
      .filter((o) => {
        if (!debouncedSearch) return true;
        const term = debouncedSearch.toLowerCase();
        const name = o.customer_name || o.name || "";
        return (
          o.id?.toLowerCase().includes(term) ||
          name.toLowerCase().includes(term) ||
          (o.phone || "").includes(term) ||
          (o.selected_option || "").toLowerCase().includes(term)
        );
      });
  }, [orders, filter, debouncedSearch]);

  const summary = useMemo(() => ({
    all: orders.length,
    in_progress: orders.filter(o => ["new", "placed", "accepted"].includes((o.status || "").toLowerCase())).length,
    completed: orders.filter(o => (o.status || "").toLowerCase() === "completed").length,
    cancelled: orders.filter(o => (o.status || "").toLowerCase() === "cancelled").length,
  }), [orders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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

  const filterButtons: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: "all", label: "Wszystkie", count: summary.all, color: "slate" },
    { key: "in_progress", label: "W trakcie", count: summary.in_progress, color: "amber" },
    { key: "completed", label: "Zrealizowane", count: summary.completed, color: "emerald" },
    { key: "cancelled", label: "Anulowane", count: summary.cancelled, color: "red" },
  ];

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}>
            <History className={`h-6 w-6 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Historia zamówień
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              Przeglądaj wszystkie zamówienia
            </p>
          </div>
        </div>

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

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterButtons.map(({ key, label, count, color }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                isActive
                  ? isDark
                    ? `bg-${color === "slate" ? "slate-700" : color + "-500/20"} text-white border border-${color}-500/50`
                    : `bg-${color === "slate" ? "gray-800" : color + "-500"} text-white`
                  : isDark
                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700/50"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <span>{label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive
                  ? isDark ? "bg-white/20" : "bg-white/30"
                  : isDark ? "bg-slate-700" : "bg-gray-100"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className={`relative mb-6 ${isDark ? "" : ""}`}>
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isDark ? "text-slate-500" : "text-gray-400"}`} />
        <input
          type="text"
          placeholder="Szukaj po kliencie, ID, telefonie..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`w-full pl-12 pr-10 py-3 rounded-xl transition ${
            isDark 
              ? "bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:border-slate-600" 
              : "bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300"
          } focus:outline-none`}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Results count */}
      <div className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
        Znaleziono {filtered.length} zamówień
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className={`h-8 w-8 animate-spin rounded-full border-2 ${
            isDark ? "border-slate-600 border-t-slate-400" : "border-gray-300 border-t-gray-600"
          }`} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-12 rounded-xl ${isDark ? "bg-slate-800/50" : "bg-white border border-gray-200"}`}>
          <Package className={`h-12 w-12 mx-auto mb-3 ${isDark ? "text-slate-600" : "text-gray-300"}`} />
          <p className={`text-lg ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            Brak zamówień pasujących do filtrów
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((o) => {
            const isExpanded = expandedOrders.has(o.id);
            const items = parseItems(o.items);
            const OptionIcon = getOptionIcon(o.selected_option);
            const customerName = o.customer_name || o.name || "—";
            const statusConfig = getStatusConfig(o.status, isDark);
            const StatusIcon = statusConfig.icon;

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
                      <div className={`p-2 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>
                        <OptionIcon className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
                      </div>
                      
                      {/* Main info */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {customerName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
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
                      {/* Price */}
                      <div className={`font-bold text-lg ${
                        o.status === "cancelled" 
                          ? isDark ? "text-red-400 line-through" : "text-red-500 line-through"
                          : isDark ? "text-emerald-400" : "text-emerald-600"
                      }`}>
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
                          Dane zamówienia
                        </h4>
                        
                        <div className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                          <span className="font-medium">ID:</span> {o.id}
                        </div>

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

                        {o.payment_method && (
                          <div className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                            <span className="font-medium">Płatność:</span> {o.payment_method}
                          </div>
                        )}

                        {o.promo_code && (
                          <div className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}>
                            <span className="font-medium">Kod rabatowy:</span> {o.promo_code}
                            {o.discount_amount && ` (-${Number(o.discount_amount).toFixed(2)} zł)`}
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
                        
                        <div className="space-y-2 max-h-64 overflow-auto">
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

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className={`flex flex-wrap items-center justify-between gap-4 mt-6 p-4 rounded-xl ${
          isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-white border border-gray-200"
        }`}>
          <div className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            Pokazywane: {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} z {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition ${
                isDark 
                  ? "bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:hover:bg-slate-700" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:hover:bg-gray-100"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Poprzednia
            </button>
            
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isDark ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-900"
            }`}>
              {page} / {totalPages}
            </div>
            
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition ${
                isDark 
                  ? "bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:hover:bg-slate-700" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:hover:bg-gray-100"
              }`}
            >
              Następna
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
