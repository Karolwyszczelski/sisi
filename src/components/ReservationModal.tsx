"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Menu, ChevronLeft, Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
};

let _supabase: ReturnType<typeof getSupabase> | null = null;
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) {
    if (!_supabase) _supabase = getSupabase();
    return (_supabase as any)[prop];
  },
});

type Props = { isOpen: boolean; onClose: () => void; id?: string; onOpenMenu?: () => void };

export default function ReservationModal({ isOpen, onClose, id, onOpenMenu }: Props) {
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
  const [customerEmail, setCustomerEmail] = useState("");
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
      setCustomerEmail("");
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
    past: "text-white/20 cursor-not-allowed",
    free: "bg-white/5 hover:bg-white/10 text-white",
    partial: "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400",
    full: "bg-red-500/20 text-red-400 cursor-not-allowed",
    selected: "!bg-yellow-400 !text-black font-bold",
  } as const;

  const isValid = Boolean(selectedDate && selectedTime && customerName.trim() && customerPhone.trim() && customerEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail));

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
          email: customerEmail,
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
      className="fixed inset-0 z-40 md:z-[70] flex items-center justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      id={id || "reservation-modal"}
      onMouseDown={onClose}
    >
      {/* Backdrop - widoczny tylko na desktop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm hidden md:block" aria-hidden="true" />
      
      {/* Modal container - fullscreen na mobile, centered na desktop */}
      <div
        className="relative z-[41] md:z-[71] bg-zinc-950 md:bg-zinc-900 md:border md:border-white/10 text-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-2xl overflow-hidden shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header - różny na mobile i desktop */}
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-xl md:bg-zinc-900 border-b border-white/10">
          {/* Mobile header - prosty i czytelny */}
          <div className="flex md:hidden items-center justify-between h-14 px-4">
            {/* Lewo: Przycisk cofania */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-white/80 active:text-white transition-colors"
              aria-label="Wróć"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
              <span className="text-sm font-medium">Wróć</span>
            </button>

            {/* Prawo: Menu hamburger */}
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/80 active:bg-white/10 active:scale-95 transition-all"
                aria-label="Otwórz menu"
              >
                <Menu size={22} />
              </button>
            )}
          </div>

          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 transition-colors"
              aria-label="Zamknij"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold">Rezerwacja stolika</h2>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto h-[calc(100%-56px)] md:h-auto md:max-h-[calc(90vh-64px)] pb-32 md:pb-0">
          <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
            
            {/* Nagłówek sekcji - tylko mobile */}
            <div className="md:hidden text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-yellow-400/20">
                <Calendar size={32} className="text-yellow-400" />
              </div>
              <h3 className="text-3xl font-black text-white mb-1">Rezerwacja</h3>
              <p className="text-white/50 text-sm">Wybierz datę i godzinę wizyty</p>
            </div>

            {/* Kalendarz */}
            <div className="bg-white/5 rounded-2xl p-3 md:p-4 border border-white/10 overflow-hidden">
              <DayPicker
                mode="single"
                className="reservation-calendar !bg-transparent"
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
            </div>

            {selectedDate && (
              <div className="space-y-3">
                <label className="block font-semibold text-white text-sm uppercase tracking-wider text-white/60">
                  Wybierz godzinę
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {generateSlots().map((slot) => {
                    const isFull = (countsPerSlot[slot] || 0) >= MAX_PER_SLOT;
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedTime(slot)}
                        className={`py-3.5 px-2 rounded-xl text-base font-semibold transition-all ${
                          isSelected 
                            ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20" 
                            : isFull 
                              ? "bg-white/5 text-white/30 cursor-not-allowed line-through" 
                              : "bg-white/5 text-white border border-white/10 active:scale-95"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTime && (
              <div className="space-y-3">
                <label className="block font-semibold text-sm uppercase tracking-wider text-white/60">
                  Liczba gości
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestCount(num)}
                      className={`flex-1 h-14 rounded-xl text-base font-bold transition-all ${
                        guestCount === num 
                          ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20" 
                          : "bg-white/5 text-white border border-white/10 active:scale-95"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedTime && (
              <div className="space-y-3">
                <label className="block font-semibold text-sm uppercase tracking-wider text-white/60">
                  Twoje dane
                </label>
                <input
                  type="text"
                  placeholder="Imię i nazwisko"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 focus:bg-white/10 transition-all text-base"
                />
                <input
                  type="tel"
                  placeholder="Numer telefonu"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 focus:bg-white/10 transition-all text-base"
                />
                <input
                  type="email"
                  placeholder="Adres e-mail"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 focus:bg-white/10 transition-all text-base"
                />
              </div>
            )}

            {selectedTime && (
              <div className="space-y-3">
                <label className="block font-semibold text-sm uppercase tracking-wider text-white/60">
                  Uwagi <span className="normal-case text-white/40">(opcjonalnie)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-yellow-400/50 focus:bg-white/10 transition-all resize-none text-base"
                  placeholder="Np. stolik przy oknie, krzesełko dla dziecka..."
                />
              </div>
            )}

            {errorMsg && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                {errorMsg}
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2 pb-4">
              <button
                type="submit"
                disabled={!isValid || loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black py-5 rounded-2xl font-bold text-lg disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-yellow-500/25"
              >
                {loading ? "Wysyłanie..." : "Zarezerwuj stolik"}
              </button>
              
              {/* Info pod przyciskiem */}
              <p className="text-center text-white/30 text-xs mt-3">
                Potwierdzenie otrzymasz E-mailem.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
