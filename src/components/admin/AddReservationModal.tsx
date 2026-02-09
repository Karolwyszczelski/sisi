"use client";

import React, { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import { X, User, Calendar, Users, Phone, MessageSquare } from "lucide-react";

export default function AddReservationModal({
  onClose,
  onCreated,
}: {
  onClose(): void;
  onCreated(): void;
}) {
  const supabase = createClientComponentClient();
  const { isDark } = useTheme();
  const [customerName, setCustomerName] = useState("");
  const [reserveDateTime, setReserveDateTime] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const [reservation_date, reservation_time] = reserveDateTime.split("T");

    const { error } = await supabase
      .from("reservations")
      .insert({
        customer_name: customerName,
        customer_phone: phone,
        reservation_date: reservation_date,
        reservation_time: reservation_time,
        number_of_guests: partySize,
        party_size: partySize,
        notes: notes || null,
        status: "pending",
      });

    setSaving(false);
    if (error) {
      console.error("Nie udało się dodać rezerwacji:", error.message);
    } else {
      onCreated();
      onClose();
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 transition ${
    isDark
      ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={save}
        className={`relative rounded-xl shadow-2xl w-full max-w-md overflow-hidden ${
          isDark ? "bg-slate-800" : "bg-white"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Nowa rezerwacja
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className={labelClass}>
              <User className="h-4 w-4" />
              Imię i nazwisko
            </label>
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
              placeholder="Jan Kowalski"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              <Calendar className="h-4 w-4" />
              Data i godzina
            </label>
            <input
              type="datetime-local"
              value={reserveDateTime}
              onChange={e => setReserveDateTime(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                onChange={e => setPartySize(+e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                <Phone className="h-4 w-4" />
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                placeholder="123456789"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              <MessageSquare className="h-4 w-4" />
              Uwagi (opcjonalnie)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Dodatkowe informacje..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 px-6 py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              isDark 
                ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Zapisz rezerwację"}
          </button>
        </div>
      </form>
    </div>
  );
}
