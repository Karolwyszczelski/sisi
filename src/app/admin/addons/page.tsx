"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Plus, Pencil, Trash2, RefreshCw, Search, ToggleLeft, ToggleRight,
  X, Loader2, Tag, Coins, Layers, Package, GripVertical, Filter
} from "lucide-react";

/* ===================== Typy ===================== */
interface Addon {
  id: string;
  name: string;
  price: number;
  category: "dodatek" | "sos" | "premium";
  available: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

const supabase = createClientComponentClient();

const categoryLabels: Record<Addon["category"], { label: string; color: string }> = {
  dodatek: { label: "Dodatek", color: "amber" },
  sos: { label: "Sos", color: "blue" },
  premium: { label: "Premium (płynny ser)", color: "purple" },
};

/* ===================== Modal edycji/dodawania ===================== */
function AddonModal({
  addon,
  onClose,
  onSaved,
  isDark,
}: {
  addon: Addon | null;
  onClose: () => void;
  onSaved: (a: Addon, isNew: boolean) => void;
  isDark: boolean;
}) {
  const isNew = addon === null;
  const [form, setForm] = useState({
    name: addon?.name ?? "",
    price: addon?.price?.toString() ?? "4.00",
    category: addon?.category ?? "dodatek" as Addon["category"],
    display_order: addon?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!form.name.trim()) {
      setErr("Nazwa dodatku jest wymagana");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        category: form.category,
        display_order: form.display_order,
        available: addon?.available ?? true,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("addons")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        onSaved(data as Addon, true);
      } else {
        const { data, error } = await supabase
          .from("addons")
          .update(payload)
          .eq("id", addon!.id)
          .select("*")
          .single();
        if (error) throw error;
        onSaved(data as Addon, false);
      }
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      console.error("Błąd zapisu dodatku:", error);
      setErr(error.message || "Nie udało się zapisać dodatku.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 transition focus:ring-2 ${
    isDark
      ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
      : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
  }`;

  const labelClass = `flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl ${
        isDark ? "bg-slate-800" : "bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
          <h3 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {isNew ? (
              <><Plus className="h-5 w-5 text-emerald-500" />Nowy dodatek</>
            ) : (
              <><Pencil className="h-5 w-5 text-amber-500" />Edytuj dodatek</>
            )}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 overflow-y-auto">
          {err && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={labelClass}><Tag className="h-4 w-4" />Nazwa *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="Np. Ser cheddar"
              />
            </div>

            <div>
              <label className={labelClass}><Coins className="h-4 w-4" />Cena (zł)</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={inputClass}
                placeholder="4.00"
              />
            </div>

            <div>
              <label className={labelClass}><Layers className="h-4 w-4" />Kategoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Addon["category"] }))}
                className={inputClass}
              >
                <option value="dodatek">Dodatek (standardowy)</option>
                <option value="sos">Sos</option>
                <option value="premium">Premium (płynny ser itp.)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}><GripVertical className="h-4 w-4" />Kolejność wyświetlania</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-lg font-medium transition w-full sm:w-auto ${
              isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            Anuluj
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 w-full sm:w-auto ${
              isNew ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Dodaj dodatek" : "Zapisz zmiany"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Strona ===================== */
export default function AdminAddonsPage() {
  const { isDark } = useTheme();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<"all" | Addon["category"]>("all");
  const [filterAvailable, setFilterAvailable] = useState<"all" | "available" | "unavailable">("all");
  const [editing, setEditing] = useState<Addon | null | "new">(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAddons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("addons")
        .select("*")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setAddons((data as Addon[]) ?? []);
    } catch (e) {
      console.error("Błąd pobierania dodatków:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddons();

    const ch = supabase
      .channel("addons-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "addons" }, fetchAddons)
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAddons]);

  const toggleAvailability = async (id: string, current: boolean) => {
    setTogglingId(id);
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, available: !current } : a)));
    try {
      const { error } = await supabase.from("addons").update({ available: !current }).eq("id", id);
      if (error) {
        setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, available: current } : a)));
      }
    } catch {
      setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, available: current } : a)));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteAddon = async (id: string, name: string) => {
    if (!confirm(`Na pewno usunąć dodatek "${name}"?`)) return;
    try {
      const { error } = await supabase.from("addons").delete().eq("id", id);
      if (!error) setAddons((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Błąd usuwania:", e);
    }
  };

  const filtered = useMemo(() => {
    return addons.filter((a) => {
      if (filterCat !== "all" && a.category !== filterCat) return false;
      if (filterAvailable === "available" && !a.available) return false;
      if (filterAvailable === "unavailable" && a.available) return false;
      if (search.trim()) {
        return a.name.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [addons, filterCat, filterAvailable, search]);

  const stats = useMemo(() => ({
    total: addons.length,
    available: addons.filter((a) => a.available).length,
    unavailable: addons.filter((a) => !a.available).length,
  }), [addons]);

  const t = {
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800" : "bg-white",
    border: isDark ? "border-slate-700" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
  };

  const getCategoryBadge = (cat: Addon["category"]) => {
    const cfg = categoryLabels[cat];
    const colors = {
      amber: isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700",
      blue: isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
      purple: isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[cfg.color as keyof typeof colors]}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className={`min-h-screen ${t.bg} p-4 md:p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDark ? "bg-slate-800" : "bg-white border border-gray-200"}`}>
              <Package className={`h-6 w-6 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${t.text}`}>Zarządzanie Dodatkami</h1>
              <p className={`text-sm ${t.textMuted}`}>
                {stats.total} dodatków • {stats.available} dostępnych • {stats.unavailable} wyłączonych
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAddons}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                isDark 
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" 
                  : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
              } disabled:opacity-50`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Odśwież
            </button>

            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Dodaj dodatek
            </button>
          </div>
        </div>

        {/* Filtry */}
        <div className={`rounded-xl p-4 mb-6 ${t.bgCard} border ${t.border}`}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <Search className="h-3.5 w-3.5" />
                Szukaj
              </label>
              <input
                type="text"
                placeholder="Nazwa dodatku..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-lg px-4 py-2.5 transition ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400"
                    : "bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400"
                }`}
              />
            </div>

            <div className="min-w-[150px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <Filter className="h-3.5 w-3.5" />
                Kategoria
              </label>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as typeof filterCat)}
                className={`w-full rounded-lg px-4 py-2.5 transition appearance-none ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Wszystkie</option>
                <option value="dodatek">Dodatek</option>
                <option value="sos">Sos</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div className="min-w-[150px]">
              <label className={`flex items-center gap-2 text-xs font-medium mb-1.5 uppercase ${t.textMuted}`}>
                <ToggleRight className="h-3.5 w-3.5" />
                Dostępność
              </label>
              <select
                value={filterAvailable}
                onChange={(e) => setFilterAvailable(e.target.value as typeof filterAvailable)}
                className={`w-full rounded-lg px-4 py-2.5 transition appearance-none ${
                  isDark
                    ? "bg-slate-700 border border-slate-600 text-white"
                    : "bg-white border border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Wszystkie</option>
                <option value="available">✓ Dostępne</option>
                <option value="unavailable">✗ Wyłączone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela/Lista */}
        <div className={`rounded-xl overflow-hidden border ${t.border} ${t.bgCard}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDark ? "bg-slate-700/50" : "bg-gray-50"}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>#</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>Nazwa</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>Cena</th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${t.textMuted}`}>Kategoria</th>
                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase ${t.textMuted}`}>Dostępność</th>
                  <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${t.textMuted}`}>Akcje</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-slate-700/50" : "divide-gray-100"}`}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className={`h-4 w-6 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-32 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-16 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-20 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4 text-center"><div className={`h-6 w-20 rounded-full mx-auto ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                      <td className="px-4 py-4"><div className={`h-4 w-24 rounded ml-auto ${isDark ? "bg-slate-700" : "bg-gray-200"}`} /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-12 text-center ${t.textMuted}`}>
                      Brak dodatków do wyświetlenia.
                    </td>
                  </tr>
                ) : (
                  filtered.map((addon, i) => (
                    <tr 
                      key={addon.id} 
                      className={`transition ${
                        !addon.available 
                          ? isDark ? "bg-slate-800/30 opacity-60" : "bg-gray-50/50 opacity-60"
                          : isDark ? "hover:bg-slate-700/30" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${t.textMuted}`}>{i + 1}</td>
                      <td className={`px-4 py-3 font-medium ${t.text}`}>{addon.name}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        {addon.price.toFixed(2)} zł
                      </td>
                      <td className="px-4 py-3">{getCategoryBadge(addon.category)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAvailability(addon.id, addon.available)}
                          disabled={togglingId === addon.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                            addon.available
                              ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                          } ${togglingId === addon.id ? "opacity-50" : "hover:scale-105"}`}
                        >
                          {addon.available ? (
                            <>Dostępny <ToggleRight className="h-4 w-4" /></>
                          ) : (
                            <>Wyłączony <ToggleLeft className="h-4 w-4" /></>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(addon)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                              isDark
                                ? "text-blue-400 hover:bg-blue-500/10"
                                : "text-blue-600 hover:bg-blue-50"
                            }`}
                          >
                            <Pencil className="h-4 w-4" />
                            Edytuj
                          </button>
                          <button
                            onClick={() => deleteAddon(addon.id, addon.name)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                              isDark
                                ? "text-red-400 hover:bg-red-500/10"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Podsumowanie */}
        <div className={`mt-4 text-sm ${t.textMuted}`}>
          Wyświetlono {filtered.length} z {addons.length} dodatków
        </div>

        {/* Widok mobilny */}
        <div className="md:hidden mt-6 space-y-3">
          {!loading && filtered.map((addon) => (
            <div 
              key={addon.id} 
              className={`rounded-xl p-4 ${t.bgCard} border ${t.border} ${!addon.available ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`font-semibold ${t.text}`}>{addon.name}</div>
                <div className={`text-sm font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  {addon.price.toFixed(2)} zł
                </div>
              </div>
              <div className="mb-3">{getCategoryBadge(addon.category)}</div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleAvailability(addon.id, addon.available)}
                  disabled={togglingId === addon.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    addon.available
                      ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                      : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                  }`}
                >
                  {addon.available ? "Dostępny" : "Wyłączony"}
                  {addon.available ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(addon)}
                    className={`p-2 rounded-lg ${isDark ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteAddon(addon.id, addon.name)}
                    className={`p-2 rounded-lg ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {editing !== null && (
        <AddonModal
          addon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            if (isNew) {
              setAddons((prev) => [...prev, saved]);
            } else {
              setAddons((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
            }
            setEditing(null);
          }}
          isDark={isDark}
        />
      )}
    </div>
  );
}
