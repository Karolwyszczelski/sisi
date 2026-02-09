// src/components/EditReservationButton.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Pencil, X, Clock, Users, UtensilsCrossed, Loader2, AlertCircle } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";

interface TableWithConflict {
  id: string;
  table_number: number;
  seats: number;
  label: string;
  hasConflict: boolean;
}

export default function EditReservationButton({
  reservation,
  onUpdated,
}: {
  reservation: {
    id: string;
    reservation_date: string;
    reservation_time: string;
    number_of_guests?: number;
    party_size?: number;
  };
  onUpdated?(): void;
}) {
  const supabase = createClientComponentClient();
  const { isDark } = useTheme();

  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(reservation.reservation_time?.slice(0, 5) || "");
  const [partySize, setPartySize] = useState(reservation.party_size || reservation.number_of_guests || 1);

  const [tables, setTables] = useState<TableWithConflict[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Pobierz stoliki i sprawdź konflikty
  const fetchTablesWithConflicts = async () => {
    setLoadingTables(true);
    try {
      // 1. Pobierz wszystkie aktywne stoliki
      const { data: allTables } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, seats, label")
        .eq("active", true)
        .order("table_number", { ascending: true });

      if (!allTables) {
        setTables([]);
        return;
      }

      // 2. Pobierz rezerwacje na ten sam dzień (bez aktualnej rezerwacji)
      const { data: reservationsOnDay } = await supabase
        .from("reservations")
        .select("id, reservation_time")
        .eq("reservation_date", reservation.reservation_date)
        .neq("id", reservation.id)
        .neq("status", "cancelled");

      // 3. Pobierz przypisania stolików dla tych rezerwacji
      const reservationIds = reservationsOnDay?.map(r => r.id) || [];
      const { data: assignments } = await supabase
        .from("table_assignments")
        .select("table_id, reservation_id")
        .in("reservation_id", reservationIds.length > 0 ? reservationIds : ["none"]);

      // 4. Sprawdź konflikt czasowy (±2 godziny)
      const currentTimeMinutes = timeToMinutes(time);
      
      const conflictingTableIds = new Set<string>();
      
      reservationsOnDay?.forEach(res => {
        const resTimeMinutes = timeToMinutes(res.reservation_time?.slice(0, 5) || "");
        const timeDiff = Math.abs(currentTimeMinutes - resTimeMinutes);
        
        // Jeśli różnica czasu < 2h, to jest konflikt
        if (timeDiff < 120) {
          const assignment = assignments?.find(a => a.reservation_id === res.id);
          if (assignment?.table_id) {
            conflictingTableIds.add(assignment.table_id);
          }
        }
      });

      // 5. Oznacz stoliki z konfliktami
      const tablesWithConflicts: TableWithConflict[] = allTables.map(t => ({
        ...t,
        hasConflict: conflictingTableIds.has(t.id),
      }));

      setTables(tablesWithConflicts);

      // 6. Pobierz aktualne przypisanie
      const { data: currentAssign } = await supabase
        .from("table_assignments")
        .select("table_id")
        .eq("reservation_id", reservation.id)
        .single();

      if (currentAssign?.table_id) {
        setSelectedTable(currentAssign.table_id);
      }
    } catch (e) {
      console.error("Błąd pobierania stolików:", e);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTablesWithConflicts();
    }
  }, [open, time]); // Odśwież przy zmianie godziny

  // Sprawdź konflikt przy wyborze stolika
  useEffect(() => {
    if (selectedTable) {
      const table = tables.find(t => t.id === selectedTable);
      if (table?.hasConflict) {
        setConflictWarning(`Stolik ${table.table_number} jest zajęty o podobnej godzinie!`);
      } else {
        setConflictWarning(null);
      }
    } else {
      setConflictWarning(null);
    }
  }, [selectedTable, tables]);

  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error: resErr } = await supabase
      .from("reservations")
      .update({
        reservation_time: time,
        number_of_guests: partySize,
        party_size: partySize,
      })
      .eq("id", reservation.id);
    
    if (resErr) {
      console.error("Błąd aktualizacji rezerwacji:", resErr.message);
      setSaving(false);
      return;
    }

    if (selectedTable) {
      await supabase
        .from("table_assignments")
        .upsert({
          reservation_id: reservation.id,
          table_id: selectedTable,
        }, { onConflict: "reservation_id" });
    } else {
      await supabase
        .from("table_assignments")
        .delete()
        .eq("reservation_id", reservation.id);
    }

    setSaving(false);
    setOpen(false);
    onUpdated?.();
  };

  const handleCancel = async () => {
    const { error } = await supabase
      .from("reservations")
      .update({ 
        status: "cancelled",
        cancelled_at: new Date().toISOString() 
      })
      .eq("id", reservation.id);
    if (error) {
      console.error("Błąd anulowania:", error.message);
    } else {
      setOpen(false);
      onUpdated?.();
    }
  };

  const inputClass = `w-full rounded-lg px-3 py-2 transition ${
    isDark
      ? "bg-slate-700 border border-slate-600 text-white focus:border-emerald-500"
      : "bg-white border border-gray-300 text-gray-900 focus:border-emerald-500"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`p-2 rounded-lg transition ${
          isDark 
            ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
            : "bg-gray-100 hover:bg-gray-200 text-gray-600"
        }`}
        title="Edytuj"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className={`relative rounded-xl shadow-2xl w-full max-w-sm overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
              <h4 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Edytuj rezerwację
              </h4>
              <button
                onClick={() => setOpen(false)}
                className={`p-1.5 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className={labelClass}>
                  <Clock className="h-4 w-4" />
                  Godzina
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Users className="h-4 w-4" />
                  Liczba osób
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={partySize}
                  onChange={(e) => setPartySize(+e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <UtensilsCrossed className="h-4 w-4" />
                  Stolik
                </label>
                {loadingTables ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    <span className={isDark ? "text-slate-400" : "text-gray-500"}>Ładowanie...</span>
                  </div>
                ) : (
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— brak przypisania —</option>
                    {tables.map((t) => (
                      <option 
                        key={t.id} 
                        value={t.id}
                        disabled={t.hasConflict}
                        className={t.hasConflict ? "text-red-400" : ""}
                      >
                        Stolik {t.table_number} ({t.seats} os.)
                        {t.hasConflict ? " ⚠️ zajęty" : ""}
                      </option>
                    ))}
                  </select>
                )}

                {/* Conflict warning */}
                {conflictWarning && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-400">{conflictWarning}</span>
                  </div>
                )}

                {/* Info o wolnych stolikach */}
                {tables.length > 0 && (
                  <p className={`mt-2 text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                    {tables.filter(t => !t.hasConflict).length} z {tables.length} stolików wolnych o tej godzinie
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between px-5 py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
              <button
                onClick={handleCancel}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
              >
                Anuluj rezerwację
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    isDark 
                      ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  Zamknij
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Zapisz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
