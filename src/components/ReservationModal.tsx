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
  isOpen: boolean;
  onClose(): void;
}

export default function ReservationCalendarModal({ isOpen, onClose }: Props) {
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
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [guestCount, setGuestCount] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

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
        perSlot[r.reservation_time] = (perSlot[r.reservation_time] || 0) + 1;
      });
      setCountsPerSlot(perSlot);
      setSelectedTime("");
      setGuestCount(1);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    })();
  }, [selectedDate]);

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

  const modifiers = {
    past: (day: Date) => day < new Date(),
    free: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      const c = countsPerDay[key] || 0;
      return c < SLOT_COUNT * MAX_PER_SLOT;
    },
    partial: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      const c = countsPerDay[key] || 0;
      return c > 0 && c < SLOT_COUNT * MAX_PER_SLOT;
    },
    full: (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      return countsPerDay[key] >= SLOT_COUNT * MAX_PER_SLOT;
    },
    selected: (day: Date) =>
      selectedDate ? format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd") : false,
  };
  const modifiersClassNames = {
    past: "text-gray-300",
    free: "bg-green-200 hover:bg-green-300",
    partial: "bg-yellow-200 hover:bg-yellow-300",
    full: "bg-red-200 text-red-700 cursor-not-allowed",
    selected: "bg-black text-white",
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !customerName.trim() || !customerPhone.trim()) return;
    const day = format(selectedDate, "yyyy-MM-dd");
    const payload: any = {
      reservation_date: day,
      reservation_time: selectedTime,
      number_of_guests: guestCount,
      customer_name: customerName,
      customer_phone: customerPhone,
      notes,
      status: "pending",
    };
    const { error } = await supabase.from("reservations").insert([payload]);
    if (error) console.error("Błąd rezerwacji:", error.message);
    else {
      alert("Rezerwacja zapisana!");
      onClose();
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-2xl overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-4 z-20 text-gray-500 hover:text-gray-800"
        >
          <X size={24} />
        </button>

        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Rezerwacja stolika</h2>
        </div>

        <div className="p-6 space-y-4">
          <DayPicker
            mode="single"
            className="rounded-lg shadow-inner bg-gray-50"
            captionLayout="dropdown"
            navbarClassName="flex justify-between px-2 py-1 bg-white"
            navbarPrev="<"
            navbarNext=">"
            // Uwaga: interfejs Caption zależy od wersji react-day-picker
            components={{
              Caption: ({ date, localeUtils }: any) => (
                <div className="text-center font-semibold">
                  {localeUtils?.formatMonthTitle
                    ? localeUtils.formatMonthTitle(date)
                    : format(date, "LLLL yyyy", { locale: pl })}
                </div>
              ),
            }}
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
                className="border rounded w-20 py-1 px-2"
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

          <button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime || !customerName.trim() || !customerPhone.trim() }
            className="w-full bg-yellow-500 text-white py-2 rounded disabled:opacity-50 hover:bg-yellow-600 transition"
          >
            Zarezerwuj
          </button>
        </div>
      </div>
    </div>
  );
}
