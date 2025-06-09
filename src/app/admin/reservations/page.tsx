// src/app/admin/reservations/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AddReservationModal from "@/components/admin/AddReservationModal";
import EditReservationButton from "@/components/admin/EditReservationButton";

interface Reservation {
  id: string;
  customer_name: string;
  reservation_date: string; // "YYYY-MM-DD"
  reservation_time: string; // "HH:MM:SS"
  party_size: number;
  phone: string;
}

export default function ReservationsPage() {
  const supabase = createClientComponentClient();

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservedDays, setReservedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);

  // Formatuje wybraną datę do "YYYY-MM-DD"
  const formatDateOnly = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Ładowanie rezerwacji dla selectedDate
  useEffect(() => {
    (async () => {
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
        setReservations(data as Reservation[]);
      }
      setLoading(false);
    })();
    (async () => {
    const start = formatDateOnly(new Date(viewYear, viewMonth, 1));
    const end   = formatDateOnly(new Date(viewYear, viewMonth + 1, 0));
    const { data: all, error: errAll } = await supabase
      .from("reservations")
     .select("reservation_date")
      .gte("reservation_date", start)
      .lte("reservation_date", end);
    if (!errAll && all) {
      const daysSet = new Set<number>();
      all.forEach((r: Reservation) => {
        daysSet.add(parseInt(r.reservation_date.slice(8, 10), 10));
      });
      setReservedDays(daysSet);
    }
  })();
  }, [selectedDate, supabase]);

  // Budowa siatki kalendarza
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow   = new Date(viewYear, viewMonth, 1).getDay();
  const offset     = (firstDow + 6) % 7; // przesunięcie, żeby pon. było na index 0
  const weeks: (number | null)[][] = [];
  let d = 1 - offset;
  while (d <= daysInMonth) {
    const week: (number|null)[] = [];
    for (let i = 0; i < 7; i++, d++) {
      week.push(d >= 1 && d <= daysInMonth ? d : null);
    }
    weeks.push(week);
  }

  // Grupa rezerwacji wg HH:MM
  const byHour: Record<string, Reservation[]> = {};
  reservations.forEach(r => {
    const hhmm = r.reservation_time.slice(0, 5); // "HH:MM"
    (byHour[hhmm] ||= []).push(r);
  });

  const headerDate = selectedDate.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Rezerwacje</h1>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          + Nowa rezerwacja
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ─── kalendarz ─── */}
        <aside className="lg:w-1/3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                const prev = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(prev.getFullYear());
                setViewMonth(prev.getMonth());
              }}
              className="px-2 py-1 hover:bg-gray-200 rounded"
            >
              «
            </button>
            <span className="font-semibold">
              {new Date(viewYear, viewMonth).toLocaleDateString(undefined, {
                month: "long", year: "numeric"
              })}
            </span>
            <button
              onClick={() => {
                const next = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(next.getFullYear());
                setViewMonth(next.getMonth());
              }}
              className="px-2 py-1 hover:bg-gray-200 rounded"
            >
              »
            </button>
          </div>
          <table className="w-full table-fixed text-center border-collapse">
            <thead>
              <tr className="text-gray-600">
                {["pon","wt","śr","czw","pt","sob","nd"].map(d => (
                  <th key={d} className="py-1">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    const isToday =
                      day === today.getDate() &&
                      viewMonth === today.getMonth() &&
                      viewYear === today.getFullYear();
                    const isSel =
                      day === selectedDate.getDate() &&
                      viewMonth === selectedDate.getMonth() &&
                      viewYear === selectedDate.getFullYear();
                    return (
                      <td
                        key={di}
                        onClick={() => day && setSelectedDate(new Date(viewYear, viewMonth, day))}
                        className={`
                          h-10 align-top cursor-pointer
                          ${day ? "hover:bg-gray-100" : ""}
                          ${isSel ? "bg-blue-100 font-bold" : ""}
                        `}
                      >
                        <span className={
                          reservedDays.has(day ?? -1)
                            ? "text-red-600"
                            : isToday
                              ? "text-red-500"
                              : "text-gray-800"
                        }>
                          {day || ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </aside>

        {/* ─── lista rezerwacji ─── */}
        <section className="flex-1">
          <h2 className="text-xl font-semibold mb-4">
            Rezerwacje na {headerDate}
          </h2>

          {loading ? (
            <p className="text-gray-600">Ładowanie…</p>
          ) : (
            Object.keys(byHour).length === 0 ? (
              <p className="text-gray-600">Brak rezerwacji w tym dniu.</p>
            ) : (
              Object.entries(byHour).map(([hour, list]) => (
                <div key={hour} className="mb-6">
                  <h3 className="text-lg font-medium mb-2">{hour}</h3>
                  <ul className="space-y-2">
                    {list.map(r => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between p-4 bg-white rounded shadow"
                      >
                        <div>
                          <p className="font-semibold">{r.customer_name}</p>
                          <p className="text-sm text-gray-500">
                            {r.party_size} os. • {r.phone}
                          </p>
                        </div>
                        <EditReservationButton
                          reservation={r}
                          onUpdated={() => setSelectedDate(new Date(selectedDate))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )
          )}
        </section>
      </div>

      {/* ─── modal dodawania ─── */}
      {isAddOpen && (
        <AddReservationModal
          onClose={() => setIsAddOpen(false)}
          onCreated={() => {
            setIsAddOpen(false);
            // odśwież listę
            setSelectedDate(new Date(selectedDate));
          }}
        />
      )}
    </div>
  );
}
