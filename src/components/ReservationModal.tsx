"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { isOpen: boolean; onClose: () => void; id?: string };

export default function ReservationModal({ isOpen, onClose, id }: Props) {
  // sloty 11:30–22:00 co 90 min
  const SLOT_DURATION_MIN = 90;
  const START_HOUR = 11;
  const START_MIN = 30;
  const END_HOUR = 22;
  const SLOT_COUNT =
    Math.floor(((END_HOUR * 60) - (START_HOUR * 60 + START_MIN)) / SLOT_DURATION_MIN) + 1;
  const MAX_PER_SLOT = 5;

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [countsPerDay, setCountsPerDay] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [countsPerSlot, setCountsPerSlot] = useState<Record<string, number>>({});
  const [selectedTime, setSelectedTime] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!currentMonth) return;
    (async () => {
      const from = startOfMonth(currentMonth).toISOString();
      const to = endOfMonth(currentMonth).toISOString();
      const { data } = await supabase
        .from("reservations")
        .select("reservation_date")
        .gte("reservation_date", from)
        .lte("reservation_date", to);

      const perDay: Record<string, number> = {};
      data?.forEach((r: any) => {
        const d = r.reservation_date;
        perDay[d] = (perDay[d] || 0) + 1;
      });
      setCountsPerDay(perDay);
    })();
  }, [currentMonth]);

  useEffect(() => {
    if (!selectedDate) { setCountsPerSlot({}); return; }
    (async () => {
      const day = format(selectedDate, "yyyy-MM-dd");
      const { data } = await supabase
        .from("reservations")
        .select("reservation_time")
        .eq("reservation_date", day);

      const perSlot: Record<string, number> = {};
      data?.forEach((r: any) => {
        perSlot[r.reservation_time] = (perSlot[r.reservation_time] || 0) + 1;
      });
      setCountsPerSlot(perSlot);
      setSelectedTime("");
      setGuestCount(1);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setErrorMsg(null);
    })();
  }, [selectedDate]);

  const generateSlots = () => {
    if (!selectedDate) return [];
    const list: string[] = [];
    let d = new Date(selectedDate);
    d.setHours(START_HOUR, START_MIN, 0, 0);
    for (let i = 0; i < SLOT_COUNT; i++) {
      list.push(format(d, "HH:mm"));
      d = new Date(d.getTime() + SLOT_DURATION_MIN * 60000);
    }
    const now = new Date();
    if (isSameDay(now, selectedDate)) {
      const nowStr = format(now, "HH:mm");
      return list.filter((t) => t >= nowStr);
    }
    return list;
  };

  const modifiers = {
    past: (day: Date) => day < new Date(),
    free: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      const c = countsPerDay[key] || 0;
      return c < MAX_PER_SLOT * SLOT_COUNT;
    },
    partial: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      const c = countsPerDay[key] || 0;
      return c > 0 && c < MAX_PER_SLOT * SLOT_COUNT;
    },
    full: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      return countsPerDay[key] >= MAX_PER_SLOT * SLOT_COUNT;
    },
    selected: (day: Date) =>
      selectedDate ? format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd") : false,
  } as const;

  const modifiersClassNames = {
    past: "text-gray-300",
    free: "bg-green-200 hover:bg-green-300",
    partial: "bg-yellow-200 hover:bg-yellow-300",
    full: "bg-red-200 text-red-700 cursor-not-allowed",
    selected: "bg-black text-white",
  } as const;

  const isValid = Boolean(selectedDate && selectedTime && customerName.trim() && customerPhone.trim());

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setErrorMsg(null);
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reservations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(selectedDate!, "yyyy-MM-dd"),
          time: selectedTime,
          guests: guestCount,
          name: customerName,
          phone: customerPhone,
          note: notes,
        }),
      });
      const jr = await res.json();
      if (!res.ok) throw new Error(jr.error || "Błąd zapisu");
      alert("Rezerwacja zapisana.");
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Nie udało się zapisać rezerwacji.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      id={id || "reservation-modal"}
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        className="relative z-[71] bg-white text-black w-full max-w-md max-h-[90vh] rounded-2xl overflow-y-auto shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-4 z-20 text-gray-500 hover:text-gray-800"
          aria-label="Zamknij"
        >
          <X size={22} />
        </button>

        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Rezerwacja stolika</h2>
          </div>

          <div className="p-6 space-y-4">
            <DayPicker
              mode="single"
              className="rounded-lg shadow-inner bg-gray-50"
              captionLayout="dropdown"
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={pl}
              fromDate={new Date()}
              modifiers={modifiers as any}
              modifiersClassNames={modifiersClassNames as any}
            />

            {selectedDate && (
              <>
                <label className="block font-medium">Godzina</label>
                <select
                  className="w-full border rounded py-2 px-3"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                >
                  <option value="">— wybierz godzinę —</option>
                  {generateSlots().map((slot) => (
                    <option
                      key={slot}
                      value={slot}
                      disabled={(countsPerSlot[slot] || 0) >= MAX_PER_SLOT}
                    >
                      {slot}{" "}
                      {(countsPerSlot[slot] || 0) >= MAX_PER_SLOT
                        ? "(pełny)"
                        : `(${countsPerSlot[slot] || 0}/${MAX_PER_SLOT})`}
                    </option>
                  ))}
                </select>
              </>
            )}

            {selectedTime && (
              <>
                <label className="block font-medium">Liczba gości</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="border rounded w-24 py-1 px-2"
                />
              </>
            )}

            {selectedTime && (
              <>
                <label className="block font-medium">Twoje dane</label>
                <input
                  type="text"
                  placeholder="Imię i nazwisko"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border rounded py-2 px-3 mb-2"
                />
                <input
                  type="tel"
                  placeholder="Telefon"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border rounded py-2 px-3"
                />
              </>
            )}

            {selectedTime && (
              <>
                <label className="block font-medium">Uwagi</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded py-2 px-3"
                  placeholder="Dodatkowe informacje..."
                />
              </>
            )}

            {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-yellow-500 text-black py-2 rounded font-semibold disabled:opacity-50 hover:bg-yellow-400 transition"
            >
              {loading ? "Wysyłanie..." : "Zarezerwuj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
