"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import AddReservationModal from "@/components/admin/AddReservationModal";
import EditReservationButton from "@/components/admin/EditReservationButton";
import { 
  CalendarDays, Users, Phone, Clock, ChevronLeft, ChevronRight, 
  Plus, RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2,
  UtensilsCrossed, MessageSquare, Mail, Send, X
} from "lucide-react";

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  number_of_guests?: number;
  status: "pending" | "confirmed" | "cancelled";
  notes?: string;
  reservation_type?: string;
  created_at: string;
}

const formatTime = (time: string | null) => {
  if (!time) return "–";
  return time.slice(0, 5);
};

const getStatusConfig = (status: string, isDark: boolean) => {
  switch (status) {
    case "pending":
      return {
        label: "Oczekująca",
        bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
        text: isDark ? "text-amber-400" : "text-amber-700",
        border: isDark ? "border-amber-500/30" : "border-amber-300",
        icon: AlertCircle,
      };
    case "confirmed":
      return {
        label: "Potwierdzona",
        bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
        text: isDark ? "text-emerald-400" : "text-emerald-700",
        border: isDark ? "border-emerald-500/30" : "border-emerald-300",
        icon: CheckCircle,
      };
    case "cancelled":
      return {
        label: "Anulowana",
        bg: isDark ? "bg-red-500/20" : "bg-red-100",
        text: isDark ? "text-red-400" : "text-red-700",
        border: isDark ? "border-red-500/30" : "border-red-300",
        icon: XCircle,
      };
    default:
      return {
        label: status || "–",
        bg: isDark ? "bg-slate-500/20" : "bg-gray-100",
        text: isDark ? "text-slate-400" : "text-gray-600",
        border: isDark ? "border-slate-500/30" : "border-gray-300",
        icon: AlertCircle,
      };
  }
};

export default function ReservationsPage() {
  const supabase = createClientComponentClient();
  const { isDark } = useTheme();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservedDays, setReservedDays] = useState<Map<number, { pending: number; confirmed: number }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Modal odrzucenia
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  const formatDateOnly = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const loadReservations = useCallback(async () => {
    setLoading(true);
    const dateStr = formatDateOnly(selectedDate);

    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("reservation_date", dateStr)
      .order("reservation_time", { ascending: true });

    if (error) {
      console.error("Błąd pobierania rezerwacji:", error.message);
      setReservations([]);
    } else {
      setReservations((data as Reservation[]) || []);
    }
    setLoading(false);
  }, [supabase, selectedDate]);

  const loadMonthReservations = useCallback(async () => {
    const start = formatDateOnly(new Date(viewYear, viewMonth, 1));
    const end = formatDateOnly(new Date(viewYear, viewMonth + 1, 0));
    
    const { data, error } = await supabase
      .from("reservations")
      .select("reservation_date, status")
      .gte("reservation_date", start)
      .lte("reservation_date", end)
      .neq("status", "cancelled");

    if (!error && data) {
      const daysMap = new Map<number, { pending: number; confirmed: number }>();
      (data as { reservation_date: string; status: string }[]).forEach((r) => {
        const day = parseInt(r.reservation_date.slice(8, 10), 10);
        const current = daysMap.get(day) || { pending: 0, confirmed: 0 };
        if (r.status === "pending") current.pending++;
        else if (r.status === "confirmed") current.confirmed++;
        daysMap.set(day, current);
      });
      setReservedDays(daysMap);
    }
  }, [supabase, viewYear, viewMonth]);

  useEffect(() => {
    loadReservations();
    loadMonthReservations();
  }, [loadReservations, loadMonthReservations]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadReservations();
        loadMonthReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadReservations, loadMonthReservations]);

  const handleStatusChange = async (id: string, newStatus: "confirmed" | "cancelled", reason?: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/reservations/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          status: newStatus,
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Błąd zmiany statusu:", data.error);
      } else {
        loadReservations();
        loadMonthReservations();
      }
    } catch (error) {
      console.error("Błąd zmiany statusu:", error);
    } finally {
      setStatusLoading(false);
      setRejectModalOpen(false);
      setRejectingId(null);
      setRejectReason("");
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const confirmReject = () => {
    if (rejectingId) {
      handleStatusChange(rejectingId, "cancelled", rejectReason);
    }
  };

  // Kalendarz
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const weeks: (number | null)[][] = [];
  let d = 1 - offset;
  while (d <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let i = 0; i < 7; i++, d++) {
      week.push(d >= 1 && d <= daysInMonth ? d : null);
    }
    weeks.push(week);
  }

  // Grupowanie rezerwacji po godzinie
  const byHour: Record<string, Reservation[]> = {};
  reservations.forEach((r) => {
    const hhmm = formatTime(r.reservation_time);
    (byHour[hhmm] ||= []).push(r);
  });

  const headerDate = selectedDate.toLocaleDateString("pl-PL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Statystyki dnia
  const dayStats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === "pending").length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
    guests: reservations
      .filter((r) => r.status !== "cancelled")
      .reduce((sum, r) => sum + (r.party_size || r.number_of_guests || 0), 0),
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}>
            <CalendarDays className={`h-6 w-6 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Rezerwacje
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              Zarządzaj rezerwacjami stolików
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { loadReservations(); loadMonthReservations(); }}
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
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium"
          >
            <Plus className="h-4 w-4" />
            Nowa rezerwacja
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kalendarz */}
        <div className={`rounded-xl p-4 ${isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-white border border-gray-200"}`}>
          {/* Nawigacja miesiąca */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const prev = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(prev.getFullYear());
                setViewMonth(prev.getMonth());
              }}
              className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
            >
              <ChevronLeft className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
            </button>
            <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {new Date(viewYear, viewMonth).toLocaleDateString("pl-PL", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => {
                const next = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(next.getFullYear());
                setViewMonth(next.getMonth());
              }}
              className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
            >
              <ChevronRight className={`h-5 w-5 ${isDark ? "text-slate-400" : "text-gray-500"}`} />
            </button>
          </div>

          {/* Nagłówki dni */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((day) => (
              <div
                key={day}
                className={`text-center text-xs font-medium py-2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Siatka dni */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="h-10" />;
              }

              const isToday =
                day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
              const isSelected =
                day === selectedDate.getDate() &&
                viewMonth === selectedDate.getMonth() &&
                viewYear === selectedDate.getFullYear();
              const dayData = reservedDays.get(day);
              const hasPending = dayData && dayData.pending > 0;
              const hasConfirmed = dayData && dayData.confirmed > 0;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
                  className={`
                    h-10 rounded-lg text-sm font-medium relative transition
                    ${isSelected
                      ? isDark
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-500 text-white"
                      : isToday
                        ? isDark
                          ? "bg-slate-700 text-white"
                          : "bg-gray-200 text-gray-900"
                        : isDark
                          ? "hover:bg-slate-700 text-slate-300"
                          : "hover:bg-gray-100 text-gray-700"
                    }
                  `}
                >
                  {day}
                  {/* Wskaźniki rezerwacji */}
                  {(hasPending || hasConfirmed) && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {hasPending && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-amber-400"}`} />
                      )}
                      {hasConfirmed && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-emerald-400"}`} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className={`flex items-center gap-4 mt-4 pt-4 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Oczekujące</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Potwierdzone</span>
            </div>
          </div>
        </div>

        {/* Lista rezerwacji */}
        <div className="lg:col-span-2 space-y-4">
          {/* Nagłówek dnia */}
          <div className={`rounded-xl p-4 ${isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-white border border-gray-200"}`}>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
              {headerDate}
            </h2>
            
            {/* Statystyki dnia */}
            <div className="grid grid-cols-4 gap-3">
              <div className={`p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {dayStats.total}
                </div>
                <div className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Wszystkie</div>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
                <div className={`text-2xl font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  {dayStats.pending}
                </div>
                <div className={`text-xs ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>Oczekujące</div>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
                <div className={`text-2xl font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  {dayStats.confirmed}
                </div>
                <div className={`text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-600"}`}>Potwierdzone</div>
              </div>
              <div className={`p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}>
                <div className={`text-2xl font-bold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                  {dayStats.guests}
                </div>
                <div className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Gości</div>
              </div>
            </div>
          </div>

          {/* Lista rezerwacji */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`h-8 w-8 animate-spin ${isDark ? "text-slate-400" : "text-gray-400"}`} />
            </div>
          ) : Object.keys(byHour).length === 0 ? (
            <div className={`text-center py-12 rounded-xl ${isDark ? "bg-slate-800/50" : "bg-white border border-gray-200"}`}>
              <UtensilsCrossed className={`h-12 w-12 mx-auto mb-3 ${isDark ? "text-slate-600" : "text-gray-300"}`} />
              <p className={`text-lg ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Brak rezerwacji w tym dniu
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byHour)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([hour, list]) => (
                  <div key={hour}>
                    <div className={`flex items-center gap-2 mb-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">{hour}</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((r) => {
                        const statusConfig = getStatusConfig(r.status, isDark);
                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={r.id}
                            className={`rounded-xl p-4 border transition ${
                              isDark 
                                ? `bg-slate-800/60 ${statusConfig.border}` 
                                : `bg-white ${statusConfig.border}`
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                    {r.customer_name}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {statusConfig.label}
                                  </span>
                                </div>

                                <div className={`flex flex-wrap items-center gap-4 text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                                  <div className="flex items-center gap-1.5">
                                    <Users className="h-4 w-4" />
                                    <span>{r.party_size || r.number_of_guests || 1} os.</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-4 w-4" />
                                    <a href={`tel:${r.customer_phone}`} className="hover:underline">
                                      {r.customer_phone}
                                    </a>
                                  </div>
                                  {r.customer_email && (
                                    <div className="flex items-center gap-1.5">
                                      <Mail className="h-4 w-4" />
                                      <span>{r.customer_email}</span>
                                    </div>
                                  )}
                                  {r.reservation_type && r.reservation_type !== "stolik" && (
                                    <div className="flex items-center gap-1.5">
                                      <UtensilsCrossed className="h-4 w-4" />
                                      <span>{r.reservation_type}</span>
                                    </div>
                                  )}
                                </div>

                                {r.notes && (
                                  <div className={`mt-2 flex items-start gap-1.5 text-sm ${isDark ? "text-amber-400/80" : "text-amber-600"}`}>
                                    <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{r.notes}</span>
                                  </div>
                                )}
                              </div>

                              {/* Akcje */}
                              <div className="flex items-center gap-2">
                                {r.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(r.id, "confirmed")}
                                      disabled={statusLoading}
                                      className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition disabled:opacity-50"
                                      title="Potwierdź (wyśle e-mail)"
                                    >
                                      <CheckCircle className="h-5 w-5" />
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(r.id)}
                                      disabled={statusLoading}
                                      className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50"
                                      title="Odrzuć (wyśle e-mail)"
                                    >
                                      <XCircle className="h-5 w-5" />
                                    </button>
                                  </>
                                )}
                                <EditReservationButton
                                  reservation={r}
                                  onUpdated={loadReservations}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal dodawania */}
      {isAddOpen && (
        <AddReservationModal
          onClose={() => setIsAddOpen(false)}
          onCreated={() => {
            setIsAddOpen(false);
            loadReservations();
            loadMonthReservations();
          }}
        />
      )}

      {/* Modal odrzucenia rezerwacji */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setRejectModalOpen(false)}
          />
          <div className={`relative rounded-xl shadow-2xl w-full max-w-md overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
              <h2 className={`text-lg font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                <XCircle className="h-5 w-5 text-red-500" />
                Odrzuć rezerwację
              </h2>
              <button
                onClick={() => setRejectModalOpen(false)}
                className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                Klient otrzyma e-mail z informacją o odrzuceniu rezerwacji.
                Możesz dodać powód lub wiadomość (opcjonalnie).
              </p>

              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                  <MessageSquare className="h-4 w-4" />
                  Powód odrzucenia (opcjonalnie)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Np. Brak dostępnych stolików w wybranym terminie..."
                  className={`w-full rounded-lg px-4 py-3 transition resize-none ${
                    isDark
                      ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-red-500"
                      : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-red-500"
                  }`}
                />
              </div>

              {/* Szybkie powody */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Brak wolnych stolików",
                  "Restauracja zamknięta",
                  "Rezerwacja grupowa - prosimy o kontakt",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${
                      isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-end gap-3 px-6 py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
              <button
                onClick={() => setRejectModalOpen(false)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isDark 
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                Anuluj
              </button>
              <button
                onClick={confirmReject}
                disabled={statusLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {statusLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Odrzuć i wyślij e-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
