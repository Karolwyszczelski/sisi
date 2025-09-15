"use client";

import { useEffect, useState } from "react";

type Table = {
  id: string;
  table_number: string;
  name: string | null;
  x: number;
  y: number;
  number_of_seats: number; // kolumna w DB
};

const emptyTable = {
  table_number: "",
  name: "",
  x: 0,
  y: 0,
  seats: 2,
};

export default function TableLayoutForm() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState(emptyTable);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/tables", { cache: "no-store" });
    if (!r.ok) {
      setError("Nie udało się pobrać stolików.");
      setLoading(false);
      return;
    }
    const j = await r.json();
    setTables(j.tables || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    const r = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setCreating(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd dodawania.");
      return;
    }
    setDraft(emptyTable);
    await load();
  }

  async function save(t: Table) {
    setSavingId(t.id);
    setError(null);
    const r = await fetch(`/api/admin/tables/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_number: t.table_number,
        name: t.name || "",
        x: t.x,
        y: t.y,
        seats: t.number_of_seats,
      }),
    });
    setSavingId(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd zapisu.");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Usunąć stolik?")) return;
    const r = await fetch(`/api/admin/tables/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd usuwania.");
      return;
    }
    setTables((prev) => prev.filter((x) => x.id !== id));
  }

  function editLocal(id: string, patch: Partial<Table>) {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}

      {/* Lista */}
      <div className="rounded-md border bg-white">
        <div className="border-b p-3 font-semibold">Stoliki</div>
        <div className="divide-y">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Ładowanie…</div>
          ) : tables.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">Brak stolików.</div>
          ) : (
            tables.map((t) => (
              <div key={t.id} className="grid grid-cols-1 gap-3 p-3 md:grid-cols-12 md:items-center">
                <Inp label="Nr stolika" value={t.table_number} onChange={(v) => editLocal(t.id, { table_number: v })} />
                <Inp label="Nazwa" value={t.name || ""} onChange={(v) => editLocal(t.id, { name: v })} />
                <Num label="X" value={t.x} onChange={(v) => editLocal(t.id, { x: v ?? 0 })} />
                <Num label="Y" value={t.y} onChange={(v) => editLocal(t.id, { y: v ?? 0 })} />
                <Num
                  label="Miejsca"
                  value={t.number_of_seats}
                  onChange={(v) => editLocal(t.id, { number_of_seats: v ?? 2 })}
                />
                <div className="md:col-span-2 flex gap-2">
                  <button
                    onClick={() => save(t)}
                    className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    disabled={savingId === t.id}
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="h-9 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dodawanie */}
      <div className="rounded-md border bg-white">
        <div className="border-b p-3 font-semibold">Dodaj stolik</div>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-12 md:items-center">
          <Inp label="Nr stolika" value={draft.table_number} onChange={(v) => setDraft({ ...draft, table_number: v })} />
          <Inp label="Nazwa" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <Num label="X" value={draft.x} onChange={(v) => setDraft({ ...draft, x: v ?? 0 })} />
          <Num label="Y" value={draft.y} onChange={(v) => setDraft({ ...draft, y: v ?? 0 })} />
          <Num label="Miejsca" value={draft.seats} onChange={(v) => setDraft({ ...draft, seats: v ?? 2 })} />
          <div className="md:col-span-2">
            <button
              onClick={create}
              className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={creating}
            >
              Dodaj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 md:col-span-3">
      <span className="text-[12px] text-slate-600">{label}</span>
      <input
        className="h-9 rounded-md border px-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 md:col-span-2">
      <span className="text-[12px] text-slate-600">{label}</span>
      <input
        type="number"
        className="h-9 rounded-md border px-2"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    </label>
  );
}
