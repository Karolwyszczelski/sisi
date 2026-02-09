"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/admin/ThemeContext";
import { Plus, Save, Loader2, MapPin, AlertCircle } from "lucide-react";

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

const coerceZones = (j: unknown): Zone[] => {
  if (Array.isArray(j)) return j as Zone[];
  if (j && typeof j === "object" && "zones" in j && Array.isArray((j as { zones: unknown }).zones)) return (j as { zones: Zone[] }).zones;
  return [];
};

export default function DeliveryZonesForm() {
  const { isDark } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<Zone, "id">>(emptyZone);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...zones].sort((a, b) => a.min_distance_km - b.min_distance_km || a.max_distance_km - b.max_distance_km),
    [zones]
  );

  // Theme classes
  const t = {
    bg: isDark ? "bg-slate-800" : "bg-white",
    bgRow: isDark ? "bg-slate-700/50" : "bg-gray-50",
    border: isDark ? "border-slate-600" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
    input: `w-full h-10 rounded-lg border px-3 text-sm transition focus:outline-none focus:ring-2 ${
      isDark
        ? "bg-slate-600 border-slate-500 text-white focus:border-amber-500 focus:ring-amber-500/20"
        : "bg-white border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20"
    }`,
  };

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
    const r = await fetch(`/api/admin/delivery-zones/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j?.error || "Błąd usuwania.");
      return;
    }
    setZones((prev) => prev.filter((x) => x.id !== id));
  }

  function editLocal<K extends keyof Zone>(id: string, key: K, val: Zone[K]) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, [key]: val } : z)));
  }

  // Column definitions
  const columns: { key: keyof Omit<Zone, "id" | "cost">; label: string; w: string; nullable?: boolean }[] = [
    { key: "min_distance_km", label: "Min km", w: "w-20" },
    { key: "max_distance_km", label: "Max km", w: "w-20" },
    { key: "min_order_value", label: "Min zam. (zł)", w: "w-24" },
    { key: "cost_fixed", label: "Stała (zł)", w: "w-20" },
    { key: "free_over", label: "Free od (zł)", w: "w-24", nullable: true },
    { key: "eta_min_minutes", label: "ETA min", w: "w-20" },
    { key: "eta_max_minutes", label: "ETA max", w: "w-20" },
    { key: "cost_per_km", label: "zł/km", w: "w-20" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className={`text-lg font-bold ${t.text}`}>Strefy dostawy</h3>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Zones Card */}
      <div className={`rounded-2xl border ${t.border} ${t.bg} overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className={`h-12 w-12 mx-auto mb-3 ${t.textMuted}`} />
            <p className={`font-medium ${t.text}`}>Brak stref dostawy</p>
            <p className={`text-sm ${t.textMuted}`}>Dodaj pierwszą strefę poniżej</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className={`grid gap-3 px-5 py-3 border-b ${t.border} ${isDark ? "bg-slate-700/30" : "bg-gray-100"}`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(80px, 1fr)) auto` }}>
              {columns.map((c) => (
                <div key={c.key} className={`text-xs font-medium ${t.textMuted}`}>{c.label}</div>
              ))}
              <div className={`text-xs font-medium ${t.textMuted} text-center`}>Akcje</div>
            </div>

            {/* Table rows */}
            {sorted.map((z, idx) => (
              <div
                key={z.id}
                className={`grid gap-3 px-5 py-4 items-center border-b last:border-b-0 ${t.border} ${idx % 2 === 0 ? t.bgRow : t.bg}`}
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(80px, 1fr)) auto` }}
              >
                {columns.map((c) => (
                  <div key={c.key}>
                    {c.nullable ? (
                      <input
                        type="number"
                        className={t.input}
                        value={z[c.key] ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            editLocal(z.id, c.key, null as any);
                          } else {
                            const n = Number(raw);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            if (Number.isFinite(n)) editLocal(z.id, c.key, n as any);
                          }
                        }}
                      />
                    ) : (
                      <input
                        type="number"
                        className={t.input}
                        value={(z[c.key] as number) ?? 0}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          if (Number.isFinite(n)) editLocal(z.id, c.key, n as any);
                        }}
                      />
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 justify-center">
                  <button
                    onClick={() => save(z)}
                    disabled={savingId === z.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {savingId === z.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Zapisz
                  </button>
                  <button
                    onClick={() => remove(z.id)}
                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div className={`rounded-2xl border ${t.border} ${t.bg} p-5`}>
        <h4 className={`font-bold mb-4 ${t.text}`}>Dodaj strefę</h4>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(80px, 1fr)) auto` }}>
          {/* Labels */}
          {columns.map((c) => (
            <div key={c.key} className={`text-xs font-medium ${t.textMuted}`}>{c.label}</div>
          ))}
          <div />
          {/* Inputs */}
          {columns.map((c) => (
            <div key={c.key}>
              {c.nullable ? (
                <input
                  type="number"
                  className={t.input}
                  value={draft[c.key as keyof typeof draft] ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setDraft({ ...draft, [c.key]: null });
                    } else {
                      const n = Number(raw);
                      if (Number.isFinite(n)) setDraft({ ...draft, [c.key]: n });
                    }
                  }}
                />
              ) : (
                <input
                  type="number"
                  className={t.input}
                  value={(draft[c.key as keyof typeof draft] as number) ?? 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setDraft({ ...draft, [c.key]: n });
                  }}
                />
              )}
            </div>
          ))}
          <button
            onClick={create}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 h-10"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}
