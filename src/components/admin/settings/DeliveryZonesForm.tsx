"use client";

import { useEffect, useMemo, useState } from "react";

type Zone = {
  id: string;
  min_distance_km: number;
  max_distance_km: number;
  min_order_value: number;
  cost: number;
  free_over: number | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
  cost_fixed: number;
  cost_per_km: number;
};

const emptyZone: Omit<Zone, "id"> = {
  min_distance_km: 0,
  max_distance_km: 3,
  min_order_value: 0,
  cost: 0,
  free_over: null,
  eta_min_minutes: 30,
  eta_max_minutes: 60,
  cost_fixed: 0,
  cost_per_km: 0,
};

const coerceZones = (j: any): Zone[] => {
  if (Array.isArray(j)) return j as Zone[];
  if (Array.isArray(j?.zones)) return j.zones as Zone[];
  return [];
};

export default function DeliveryZonesForm() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<Zone, "id">>(emptyZone);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...zones].sort(
        (a, b) =>
          a.min_distance_km - b.min_distance_km ||
          a.max_distance_km - b.max_distance_km
      ),
    [zones]
  );

  async function load() {
    setLoading(true);
    setError(null);

    const r = await fetch("/api/admin/delivery-zones", { cache: "no-store" });
    if (!r.ok) {
      setError("Nie udało się pobrać stref.");
      setLoading(false);
      return;
    }

    const j = await r.json().catch(() => null);
    setZones(coerceZones(j));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);

    const r = await fetch("/api/admin/delivery-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setCreating(false);

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd zapisu.");
      return;
    }

    setDraft(emptyZone);
    await load();
  }

  async function save(z: Zone) {
    setSavingId(z.id);
    setError(null);

    const { id, ...payload } = z;
    const r = await fetch(`/api/admin/delivery-zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    if (!confirm("Usunąć tę strefę?")) return;

    const r = await fetch(`/api/admin/delivery-zones/${id}`, {
      method: "DELETE",
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd usuwania.");
      return;
    }

    setZones((prev) => prev.filter((x) => x.id !== id));
  }

  function editLocal<K extends keyof Zone>(id: string, key: K, val: Zone[K]) {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, [key]: val } : z))
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-md border bg-white">
        <div className="border-b p-3 font-semibold">Strefy dostawy</div>

        <div className="divide-y">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Ładowanie…</div>
          ) : sorted.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">Brak stref.</div>
          ) : (
            sorted.map((z) => (
              <div
                key={z.id}
                className="grid grid-cols-1 gap-3 p-3 md:grid-cols-12 md:items-center"
              >
                <Num
                  label="Min km"
                  value={z.min_distance_km}
                  onChange={(v) => editLocal(z.id, "min_distance_km", v)}
                />
                <Num
                  label="Max km"
                  value={z.max_distance_km}
                  onChange={(v) => editLocal(z.id, "max_distance_km", v)}
                />
                <Num
                  label="Min zam. (zł)"
                  value={z.min_order_value}
                  onChange={(v) => editLocal(z.id, "min_order_value", v)}
                />
                <Num
                  label="Koszt (legacy)"
                  value={z.cost}
                  onChange={(v) => editLocal(z.id, "cost", v)}
                />
                <NumNullable
                  label="Free od (zł)"
                  value={z.free_over}
                  onChange={(v) => editLocal(z.id, "free_over", v)}
                />
                <Num
                  label="ETA min"
                  value={z.eta_min_minutes}
                  onChange={(v) => editLocal(z.id, "eta_min_minutes", v)}
                />
                <Num
                  label="ETA max"
                  value={z.eta_max_minutes}
                  onChange={(v) => editLocal(z.id, "eta_max_minutes", v)}
                />
                <Num
                  label="Stała (zł)"
                  value={z.cost_fixed}
                  onChange={(v) => editLocal(z.id, "cost_fixed", v)}
                />
                <Num
                  label="zł/km"
                  value={z.cost_per_km}
                  onChange={(v) => editLocal(z.id, "cost_per_km", v)}
                />

                <div className="md:col-span-2 flex gap-2">
                  <button
                    onClick={() => save(z)}
                    className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    disabled={savingId === z.id}
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={() => remove(z.id)}
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

      <div className="rounded-md border bg-white">
        <div className="border-b p-3 font-semibold">Dodaj strefę</div>

        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-12 md:items-center">
          <Num
            label="Min km"
            value={draft.min_distance_km}
            onChange={(v) => setDraft({ ...draft, min_distance_km: v })}
          />
          <Num
            label="Max km"
            value={draft.max_distance_km}
            onChange={(v) => setDraft({ ...draft, max_distance_km: v })}
          />
          <Num
            label="Min zam. (zł)"
            value={draft.min_order_value}
            onChange={(v) => setDraft({ ...draft, min_order_value: v })}
          />
          <Num
            label="Koszt (legacy)"
            value={draft.cost}
            onChange={(v) => setDraft({ ...draft, cost: v })}
          />
          <NumNullable
            label="Free od (zł)"
            value={draft.free_over}
            onChange={(v) => setDraft({ ...draft, free_over: v })}
          />
          <Num
            label="ETA min"
            value={draft.eta_min_minutes}
            onChange={(v) => setDraft({ ...draft, eta_min_minutes: v })}
          />
          <Num
            label="ETA max"
            value={draft.eta_max_minutes}
            onChange={(v) => setDraft({ ...draft, eta_max_minutes: v })}
          />
          <Num
            label="Stała (zł)"
            value={draft.cost_fixed}
            onChange={(v) => setDraft({ ...draft, cost_fixed: v })}
          />
          <Num
            label="zł/km"
            value={draft.cost_per_km}
            onChange={(v) => setDraft({ ...draft, cost_per_km: v })}
          />

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

/** number-only (nie-null) */
function Num(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { label, value, onChange } = props;

  return (
    <label className="flex flex-col gap-1 md:col-span-1">
      <span className="text-[12px] text-slate-600">{label}</span>
      <input
        type="number"
        className="h-9 rounded-md border px-2"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </label>
  );
}

/** number|null */
function NumNullable(props: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { label, value, onChange } = props;

  return (
    <label className="flex flex-col gap-1 md:col-span-1">
      <span className="text-[12px] text-slate-600">{label}</span>
      <input
        type="number"
        className="h-9 rounded-md border px-2"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
    </label>
  );
}
