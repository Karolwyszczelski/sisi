// src/components/ReservationCalendarModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  onClose(): void;
}

export default function ReservationCalendarModal({ onClose }: Props) {
  // ustawienia slotów
  const SLOT_DURATION_MIN = 90;
  const START_HOUR = 11;
  const START_MIN = 30;
  const END_HOUR = 22;
  const SLOT_COUNT =
    Math.floor(((END_HOUR * 60) - (START_HOUR * 60 + START_MIN)) / SLOT_DURATION_MIN) + 1;
  const MAX_PER_SLOT = 5;

  // stany
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [countsPerDay, setCountsPerDay] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [countsPerSlot, setCountsPerSlot] = useState<Record<string, number>>({});
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [guestCount, setGuestCount] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // 1) fetch rezerwacji miesiąca → kolorowanie dni
  useEffect(() => {
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
        const d = r.reservation_date; // "YYYY-MM-DD"
        perDay[d] = (perDay[d] || 0) + 1;
      });
      setCountsPerDay(perDay);
    })();
  }, [currentMonth]);

  // 2) fetch sloty dnia
  useEffect(() => {
    if (!selectedDate) {
      setCountsPerSlot({});
      return;
    }
    (async () => {
      const day = format(selectedDate, "yyyy-MM-dd");
      const { data } = await supabase
        .from("reservations")
        .select("reservation_time")
        .eq("reservation_date", day);
      const perSlot: Record<string, number> = {};
      data?.forEach((r: any) => {
        const t = r.reservation_time; // "HH:MM"
        perSlot[t] = (perSlot[t] || 0) + 1;
      });
      setCountsPerSlot(perSlot);
      // reset wyborów
      setSelectedTime("");
      setGuestCount(1);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    })();
  }, [selectedDate]);

  // 3) generuj listę slotów
  const generateSlots = () => {
    if (!selectedDate) return [];
    const arr: string[] = [];
    let d = new Date(selectedDate);
    d.setHours(START_HOUR, START_MIN, 0, 0);
    for (let i = 0; i < SLOT_COUNT; i++) {
      arr.push(format(d, "HH:mm"));
      d = new Date(d.getTime() + SLOT_DURATION_MIN * 60000);
    }
    return arr;
  };

  // 4) kolorowanie dni + wyszarzanie przeszłych
  const modifiers = {
    past:    (day: Date) => day < new Date(),
    free:    (day: Date) => !(countsPerDay[format(day, "yyyy-MM-dd")] > 0),
    partial: (day: Date) => {
      const c = countsPerDay[format(day, "yyyy-MM-dd")] || 0;
      return c > 0 && c < SLOT_COUNT * MAX_PER_SLOT;
    },
    full:    (day: Date) => (countsPerDay[format(day, "yyyy-MM-dd")] || 0) >= SLOT_COUNT * MAX_PER_SLOT
  };
  const modifiersClassNames = {
    past:    "bg-gray-100 text-gray-400 cursor-not-allowed",
    free:    "bg-green-200",
    partial: "bg-yellow-200",
    full:    "bg-red-200 text-red-700 cursor-not-allowed"
  };

  // 5) zapis rezerwacji
  const handleConfirm = async () => {
    if (
      !selectedDate ||
      !selectedTime ||
      !customerName.trim() ||
      !customerPhone.trim()
    ) return;
    const day = format(selectedDate, "yyyy-MM-dd");
    const payload = {
      reservation_date:    day,
      reservation_time:    selectedTime,
      number_of_guests:    guestCount,
      customer_name:       customerName,
      customer_phone:      customerPhone,
      notes,
      status:              "pending"
    };
    const { error } = await supabase.from("reservations").insert([payload]);
    if (error) {
      console.error("Błąd rezerwacji:", error.message);
    } else {
      alert("Rezerwacja zapisana!");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-lg overflow-y-auto shadow-lg">
        {/* header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">Zarezerwuj stolik</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Kalendarz */}
          <DayPicker
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={pl}
            firstDayOfWeek={1}
            disabled={{ before: new Date() }}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            fromDate={new Date()}
          />

          {/* Godzina */}
          {selectedDate && (
            <>
              <label className="block font-medium">Godzina:</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
              >
                <option value="">— wybierz —</option>
                {generateSlots().map(slot => {
                  const count = countsPerSlot[slot] || 0;
                  const disabled = count >= MAX_PER_SLOT;
                  return (
                    <option key={slot} value={slot} disabled={disabled}>
                      {slot} {disabled ? "(pełny)" : `(${count}/${MAX_PER_SLOT})`}
                    </option>
                  );
                })}
              </select>
            </>
          )}

          {/* Liczba gości */}
          {selectedTime && (
            <>
              <label className="block font-medium">Liczba gości:</label>
              <input
                type="number"
                min={1}
                max={10}
                value={guestCount}
                onChange={e => setGuestCount(Number(e.target.value))}
                className="w-24 border rounded px-2 py-1"
              />
            </>
          )}

          {/* Dane klienta */}
          {selectedTime && (
            <>
              <label className="block font-medium">Imię i nazwisko:</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <label className="block font-medium mt-2">Telefon:</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </>
          )}

          {/* Uwagi */}
          {selectedTime && (
            <>
              <label className="block font-medium">Uwagi:</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Dodatkowe informacje..."
              />
            </>
          )}

          {/* Potwierdzenie */}
          <button
            onClick={handleConfirm}
            disabled={
              !selectedDate ||
              !selectedTime ||
              !customerName.trim() ||
              !customerPhone.trim()
            }
            className="w-full bg-yellow-400 text-black py-2 rounded disabled:opacity-50 hover:bg-yellow-300 transition"
          >
            Zarezerwuj
          </button>
        </div>
      </div>
    </div>
  );
}
