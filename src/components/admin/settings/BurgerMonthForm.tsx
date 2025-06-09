// src/components/admin/settings/BurgerMonthForm.tsx
"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function BurgerMonthForm() {
  const supabase = createClientComponentClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("burger_of_month")
        .select("name, description")
        .eq("id", "current")
        .single();
      if (error) {
        console.error("❌ Błąd pobierania burgera miesiąca:", error.message);
      } else if (data) {
        setName(data.name);
        setDescription(data.description);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("burger_of_month")
      .upsert(
        { id: "current", name, description },
        { onConflict: "id" }
      );
    if (error) {
      alert("Błąd zapisu: " + error.message);
    } else {
      alert("Zapisano Burger miesiąca!");
    }
  };

  if (loading) return <p>Ładowanie danych Burgera miesiąca…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <h2 className="text-2xl font-semibold">Burger miesiąca</h2>

      <div>
        <label className="block text-sm font-medium">Nazwa burgera</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Opis burgera</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 h-32"
          required
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Zapisz zmiany
      </button>
    </form>
  );
}
