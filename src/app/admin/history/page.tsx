"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

type OrderStatus = string;
interface OrderRaw {
  [key: string]: any;
}

const statusLabel = (status: OrderStatus) => {
  switch (status) {
    case "new":
      return "Nowe";
    case "placed":
      return "Złożone";
    case "accepted":
      return "W trakcie";
    case "cancelled":
      return "Anulowane";
    case "completed":
      return "Zrealizowane";
    default:
      return status ? status.toUpperCase() : "—";
  }
};

const statusColor = (status: OrderStatus) => {
  switch (status) {
    case "new":
    case "placed":
      return "bg-yellow-100 text-yellow-800";
    case "accepted":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "completed":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getCustomerName = (o: OrderRaw) => {
  return (
    o.customer_name ||
    o.customer ||
    o.client_name ||
    o.name ||
    o.user_name ||
    "—"
  );
};

const getOptionLabel = (opt?: string) => {
  if (opt === "local") return "Na miejscu";
  if (opt === "takeaway") return "Na wynos";
  if (opt === "delivery") return "Dostawa";
  return "—";
};

/** Hook do media query */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** debounce helper */
function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function HistoryPage() {
  const supabase = createClientComponentClient<Database>();
  const [orders, setOrders] = useState<OrderRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "in_progress" | "completed" | "cancelled"
  >("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  // fetch
  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Błąd pobierania historii zamówień:", error);
          try {
            console.error(
              "Rozpisany error:",
              JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
            );
          } catch {}
          setLoadError(error.message || "Nieznany błąd z Supabase");
          setOrders([]);
        } else {
          setOrders((data ?? []) as OrderRaw[]);
        }
      } catch (e: any) {
        console.error("Wyjątek podczas fetchowania historii:", e);
        setLoadError(e?.message || "Nieoczekiwany błąd");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [supabase]);

  // filters
  const debouncedSearch = useDebouncedValue(search, 250);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        const status: string = (o.status || "").toString().toLowerCase();
        if (filter === "in_progress" && status !== "accepted") return false;
        if (filter === "completed" && status !== "completed") return false;
        if (filter === "cancelled" && status !== "cancelled") return false;
        return true;
      })
      .filter((o) => {
        if (!debouncedSearch) return true;
        const term = debouncedSearch.toLowerCase();
        return (
          (o.id && o.id.toString().toLowerCase().includes(term)) ||
          getCustomerName(o).toLowerCase().includes(term) ||
          (o.selected_option || "").toString().toLowerCase().includes(term)
        );
      });
  }, [orders, filter, debouncedSearch]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // summary
  const summary = useMemo(() => {
    const counts = {
      all: orders.length,
      in_progress: orders.filter((o) => ((o.status || "").toString().toLowerCase() === "accepted")).length,
      completed: orders.filter((o) => ((o.status || "").toString().toLowerCase() === "completed")).length,
      cancelled: orders.filter((o) => ((o.status || "").toString().toLowerCase() === "cancelled")).length,
    };
    return counts;
  }, [orders]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* header + summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Historia zamówień</h1>
          <p className="text-sm text-gray-500 mt-1">
            Przeglądaj zamówienia z podziałem na statusy, szukaj po kliencie, ID lub opcji.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { key: "all", label: "Wszystkie", count: summary.all },
            { key: "in_progress", label: "W trakcie", count: summary.in_progress },
            { key: "completed", label: "Zrealizowane", count: summary.completed },
            { key: "cancelled", label: "Anulowane", count: summary.cancelled },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setFilter(s.key as any);
                setPage(1);
              }}
              className={`px-3 py-1 flex items-center gap-2 rounded-full text-sm font-medium shadow-sm transition ${
                filter === s.key
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{s.label}</span>
              <span className="bg-gray-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                {s.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* search + mobile filter bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Szukaj po kliencie, ID, opcji..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {search && (
              <button
                aria-label="Wyczyść"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="text-sm flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as any);
                setPage(1);
              }}
              className="border rounded px-3 py-1"
            >
              <option value="all">Wszystkie</option>
              <option value="in_progress">W trakcie</option>
              <option value="completed">Zrealizowane</option>
              <option value="cancelled">Anulowane</option>
            </select>
          </div>
          <div className="text-sm flex items-center gap-2">
            <span className="font-medium">Pokaż:</span>
            <span className="text-sm">{filtered.length} wyników</span>
          </div>
        </div>
      </div>

      {/* error / empty / content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-pulse bg-gray-200 rounded w-48 h-6 mb-2" />
          <div className="inline-block animate-pulse bg-gray-200 rounded w-64 h-4" />
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          <p className="font-semibold">Nie udało się załadować historii:</p>
          <p className="text-sm">{loadError}</p>
          <p className="text-xs mt-1">
            Sprawdź uprawnienia i konfigurację tabeli "orders".
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          Brak zamówień pasujących do wybranego filtra lub wyszukiwania.
        </div>
      ) : isMobile ? (
        // mobile card list
        <div className="space-y-4">
          {paginated.map((o, i) => {
            const statusRaw = (o.status || "").toString().toLowerCase();
            return (
              <div
                key={o.id || i}
                className="bg-white rounded-xl shadow p-4 flex flex-col gap-3 border"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <div className="text-sm text-gray-500">
                      #{o.id || "—"}
                    </div>
                    <div className="font-semibold text-lg">
                      {getCustomerName(o)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleString("pl-PL")
                        : "—"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm font-medium">
                      {o.total_price !== undefined
                        ? Number(o.total_price).toFixed(2) + " zł"
                        : "—"}
                    </div>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(
                        statusRaw
                      )}`}
                    >
                      {statusLabel(statusRaw)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="font-medium">Opcja:</span>{" "}
                    {getOptionLabel(o.selected_option)}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    {statusLabel(statusRaw)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // desktop table
        <div className="overflow-auto bg-white rounded shadow">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Klient</th>
                <th className="px-4 py-3 text-left">Kwota</th>
                <th className="px-4 py-3 text-left">Opcja</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((o, i) => {
                const statusRaw = (o.status || "").toString().toLowerCase();
                return (
                  <tr
                    key={o.id || i}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 align-top">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 align-top">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleString("pl-PL")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {getCustomerName(o)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {o.total_price !== undefined
                        ? Number(o.total_price).toFixed(2) + " zł"
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {getOptionLabel(o.selected_option)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                          statusRaw
                        )}`}
                      >
                        {statusLabel(statusRaw)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* pagination controls */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <div className="text-sm text-gray-600">
            Pokazywane: {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} z {filtered.length}
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
            >
              Poprzednia
            </button>
            <div className="text-sm">
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 text-sm"
            >
              Następna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
