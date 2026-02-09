"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/components/admin/ThemeContext";
import {
  Plus, Trash2, Save, Loader2, Tag,
  ToggleLeft, ToggleRight, Sparkles, AlertCircle, Check
} from "lucide-react";

type DiscountType = "percent" | "amount";

type DiscountRow = {
  id: string | null;
  code: string;
  type: DiscountType;
  value: number | "";
  minOrder: number | "" | null;
  maxUses: number | "" | null;
  perUserMaxUses: number | "" | null;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  isPublic: boolean;
  autoApply: boolean;
  usedCount: number;
  _saving?: boolean;
};

type GlobalPromo = {
  id: string | null;
  type: DiscountType;
  value: number | "";
  minOrder: number | "" | null;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  _saving?: boolean;
};

function isoToInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DiscountsSettingsForm() {
  const { isDark } = useTheme();
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [globalPromo, setGlobalPromo] = useState<GlobalPromo>({
    id: null, type: "percent", value: "", minOrder: "", startsAt: "", expiresAt: "", active: false,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Theme classes
  const t = {
    bg: isDark ? "bg-slate-800" : "bg-white",
    bgCard: isDark ? "bg-slate-700/50" : "bg-gray-50",
    border: isDark ? "border-slate-600" : "border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-500",
    input: `rounded-lg px-3 py-2.5 text-sm transition focus:ring-2 focus:outline-none ${
      isDark
        ? "bg-slate-600 border border-slate-500 text-white placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20"
        : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500/20"
    }`,
    select: `rounded-lg px-3 py-2.5 text-sm transition focus:ring-2 focus:outline-none cursor-pointer ${
      isDark
        ? "bg-slate-600 border border-slate-500 text-white focus:border-purple-500 focus:ring-purple-500/20"
        : "bg-white border border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20"
    }`,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/discount-codes", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: DiscountRow[] = (Array.isArray(data) ? data : []).map((d: Record<string, any>) => ({
        id: d.id ?? null,
        code: d.code ?? "",
        type: d.type === "amount" ? "amount" : "percent",
        value: typeof d.value === "number" ? d.value : d.value != null ? Number(d.value) : "",
        minOrder: d.min_order == null ? "" : Number(d.min_order),
        maxUses: d.max_uses == null ? "" : Number(d.max_uses),
        perUserMaxUses: d.per_user_max_uses == null ? "" : Number(d.per_user_max_uses),
        startsAt: isoToInput(d.starts_at),
        expiresAt: isoToInput(d.expires_at),
        active: !!d.active,
        isPublic: !!d.public,
        autoApply: !!d.auto_apply,
        usedCount: Number(d.used_count ?? 0),
      }));

      const auto = list.find((r) => r.autoApply);
      if (auto) {
        setGlobalPromo({
          id: auto.id, type: auto.type, value: auto.value, minOrder: auto.minOrder,
          startsAt: auto.startsAt, expiresAt: auto.expiresAt, active: auto.active,
        });
      } else {
        setGlobalPromo({ id: null, type: "percent", value: "", minOrder: "", startsAt: "", expiresAt: "", active: false });
      }

      setRows(list.filter((r) => !r.autoApply));
    } catch (e: unknown) {
      console.error("[DiscountsSettingsForm] load error:", e);
      setErrorMsg(e instanceof Error ? e.message : "Nie udało się pobrać danych rabatów.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCodeRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: null, code: "", type: "percent", value: "", minOrder: "", maxUses: "", perUserMaxUses: "",
        startsAt: "", expiresAt: "", active: true, isPublic: true, autoApply: false, usedCount: 0,
      },
    ]);
  };

  const updateRowAt = (idx: number, patch: Partial<DiscountRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const saveCodeRow = async (row: DiscountRow, index: number) => {
    setErrorMsg(null);
    const code = row.code.trim();
    if (!code) { setErrorMsg("Kod nie może być pusty."); return; }
    const value = row.value === "" ? 0 : Number(row.value);
    if (!Number.isFinite(value) || value <= 0) { setErrorMsg("Wartość rabatu musi być większa od 0."); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      code, type: row.type, value,
      min_order: row.minOrder === "" ? null : Number(row.minOrder),
      max_uses: row.maxUses === "" ? null : Number(row.maxUses),
      per_user_max_uses: row.perUserMaxUses === "" ? null : Number(row.perUserMaxUses),
      starts_at: row.startsAt || null, expires_at: row.expiresAt || null,
      active: row.active, public: row.isPublic, auto_apply: false,
    };

    const isNew = !row.id;
    const url = isNew ? "/api/admin/discount-codes" : `/api/admin/discount-codes/${row.id}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      updateRowAt(index, { _saving: true });
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      await load();
      setSuccessMsg("Kod zapisany!"); setTimeout(() => setSuccessMsg(null), 2000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Nie udało się zapisać kodu rabatowego.");
    } finally {
      updateRowAt(index, { _saving: false });
    }
  };

  const removeCodeRow = async (row: DiscountRow, index: number) => {
    if (!row.id) { setRows((prev) => prev.filter((_, i) => i !== index)); return; }
    if (!confirm("Na pewno chcesz usunąć ten kod rabatowy?")) return;

    try {
      updateRowAt(index, { _saving: true });
      const res = await fetch(`/api/admin/discount-codes/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Nie udało się usunąć kodu.");
    } finally {
      updateRowAt(index, { _saving: false });
    }
  };

  const toggleGlobalPromoActive = async () => {
    const newActive = !globalPromo.active;
    
    // Jeśli nie ma id i włączamy, ale brak wartości - ustaw domyślne
    if (!globalPromo.id && newActive && (globalPromo.value === "" || globalPromo.value === 0)) {
      setGlobalPromo(prev => ({ ...prev, active: true, value: 10, type: "percent" }));
      return;
    }

    // Aktualizuj stan lokalnie najpierw
    setGlobalPromo(prev => ({ ...prev, active: newActive }));

    // Jeśli istnieje w bazie, zaktualizuj
    if (globalPromo.id) {
      try {
        const res = await fetch(`/api/admin/discount-codes/${globalPromo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: newActive }),
        });
        if (!res.ok) {
          // Cofnij zmianę
          setGlobalPromo(prev => ({ ...prev, active: !newActive }));
        }
      } catch {
        setGlobalPromo(prev => ({ ...prev, active: !newActive }));
      }
    }
  };

  const saveGlobalPromo = async () => {
    setErrorMsg(null);
    const value = globalPromo.value === "" ? 0 : Number(globalPromo.value);
    if (!Number.isFinite(value) || value <= 0) { setErrorMsg("Wartość globalnego rabatu musi być > 0."); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      code: "", type: globalPromo.type, value,
      min_order: globalPromo.minOrder === "" ? null : Number(globalPromo.minOrder),
      starts_at: globalPromo.startsAt || null, expires_at: globalPromo.expiresAt || null,
      active: globalPromo.active, public: true, auto_apply: true,
    };

    const isNew = !globalPromo.id;
    const url = isNew ? "/api/admin/discount-codes" : `/api/admin/discount-codes/${globalPromo.id}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      setGlobalPromo((g) => ({ ...g, _saving: true }));
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setGlobalPromo(prev => ({
        ...prev,
        id: data.id ?? prev.id ?? null,
        _saving: false,
      }));
      setSuccessMsg("Promocja zapisana!"); setTimeout(() => setSuccessMsg(null), 2000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Nie udało się zapisać globalnej promocji.");
      setGlobalPromo((g) => ({ ...g, _saving: false }));
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-16 rounded-xl ${t.bgCard}`}>
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-400">{successMsg}</p>
        </div>
      )}

      {/* ======================== GLOBALNA PROMOCJA ======================== */}
      <div className={`rounded-2xl border ${t.border} ${t.bg} overflow-hidden`}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isDark ? "bg-purple-500/20" : "bg-purple-100"}`}>
                <Sparkles className={`h-5 w-5 ${isDark ? "text-purple-400" : "text-purple-600"}`} />
              </div>
              <div>
                <h3 className={`font-bold ${t.text}`}>Globalna promocja</h3>
                <p className={`text-sm ${t.textMuted}`}>Automatyczny rabat bez kodu</p>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={toggleGlobalPromoActive}
              className="focus:outline-none"
            >
              {globalPromo.active ? (
                <ToggleRight className="h-9 w-9 text-purple-500" />
              ) : (
                <ToggleLeft className={`h-9 w-9 ${t.textMuted}`} />
              )}
            </button>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Typ rabatu */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${t.textMuted}`}>Typ rabatu</label>
              <select
                value={globalPromo.type}
                onChange={(e) => setGlobalPromo(prev => ({ ...prev, type: e.target.value as DiscountType }))}
                className={`w-full ${t.select}`}
              >
                <option value="percent">Procentowy (%)</option>
                <option value="amount">Kwotowy (zł)</option>
              </select>
            </div>

            {/* Wartość */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${t.textMuted}`}>
                Wartość ({globalPromo.type === "percent" ? "%" : "zł"})
              </label>
              <input
                type="number"
                min={0}
                step={globalPromo.type === "percent" ? 1 : 0.01}
                value={globalPromo.value}
                onChange={(e) => {
                  const v = e.target.value;
                  setGlobalPromo(prev => ({ ...prev, value: v === "" ? "" : Number(v) }));
                }}
                placeholder="np. 10"
                className={`w-full ${t.input}`}
              />
            </div>

            {/* Min zamówienie */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${t.textMuted}`}>Min. zamówienie (zł)</label>
              <input
                type="number"
                min={0}
                value={globalPromo.minOrder ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setGlobalPromo(prev => ({ ...prev, minOrder: v === "" ? "" : Number(v) }));
                }}
                placeholder="brak"
                className={`w-full ${t.input}`}
              />
            </div>

            {/* Zapisz */}
            <button
              onClick={saveGlobalPromo}
              disabled={globalPromo._saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold transition disabled:opacity-50 h-[42px]"
            >
              {globalPromo._saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Zapisz promocję
            </button>
          </div>

          {/* Info o datach jeśli ustawione */}
          {(globalPromo.startsAt || globalPromo.expiresAt) && (
            <div className={`mt-4 pt-4 border-t ${t.border} flex flex-wrap gap-4`}>
              {globalPromo.startsAt && (
                <div className={`text-xs ${t.textMuted}`}>
                  <span className="font-medium">Od:</span> {new Date(globalPromo.startsAt).toLocaleString("pl-PL")}
                </div>
              )}
              {globalPromo.expiresAt && (
                <div className={`text-xs ${t.textMuted}`}>
                  <span className="font-medium">Do:</span> {new Date(globalPromo.expiresAt).toLocaleString("pl-PL")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================== KODY RABATOWE ======================== */}
      <div className={`rounded-2xl border ${t.border} ${t.bg} overflow-hidden`}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isDark ? "bg-amber-500/20" : "bg-amber-100"}`}>
                <Tag className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
              </div>
              <div>
                <h3 className={`font-bold ${t.text}`}>Kody rabatowe</h3>
                <p className={`text-sm ${t.textMuted}`}>{rows.length} kodów</p>
              </div>
            </div>
            <button
              onClick={addCodeRow}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Dodaj kod
            </button>
          </div>

          {/* Table header */}
          {rows.length > 0 && (
            <div className={`grid gap-3 px-4 py-2 mb-2 rounded-lg ${isDark ? "bg-slate-700/30" : "bg-gray-100"}`}
              style={{ gridTemplateColumns: "minmax(100px, 1fr) 90px 90px 90px 90px 90px auto" }}
            >
              <div className={`text-xs font-medium ${t.textMuted}`}>Kod *</div>
              <div className={`text-xs font-medium ${t.textMuted}`}>Typ</div>
              <div className={`text-xs font-medium ${t.textMuted}`}>Wartość</div>
              <div className={`text-xs font-medium ${t.textMuted}`}>Min. zam.</div>
              <div className={`text-xs font-medium ${t.textMuted}`}>Max użyć</div>
              <div className={`text-xs font-medium ${t.textMuted}`}>Na osobę</div>
              <div className={`text-xs font-medium ${t.textMuted} text-right`}>Akcje</div>
            </div>
          )}

          {/* Rows */}
          {rows.length === 0 ? (
            <div className={`text-center py-12 rounded-xl ${t.bgCard}`}>
              <Tag className={`h-10 w-10 mx-auto mb-3 ${t.textMuted}`} />
              <p className={`font-medium ${t.text}`}>Brak kodów rabatowych</p>
              <p className={`text-sm ${t.textMuted}`}>Kliknij &quot;Dodaj kod&quot; aby utworzyć pierwszy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={row.id ?? `new-${idx}`} className={`rounded-xl border ${t.border} ${t.bgCard} p-4`}>
                  <div className="grid gap-3 items-center" style={{ gridTemplateColumns: "minmax(100px, 1fr) 90px 90px 90px 90px 90px auto" }}>
                    {/* Kod */}
                    <input
                      type="text"
                      value={row.code}
                      onChange={(e) => updateRowAt(idx, { code: e.target.value.toUpperCase() })}
                      placeholder="KOD"
                      className={`${t.input} font-mono`}
                    />

                    {/* Typ */}
                    <select
                      value={row.type}
                      onChange={(e) => updateRowAt(idx, { type: e.target.value as DiscountType })}
                      className={t.select}
                    >
                      <option value="percent">%</option>
                      <option value="amount">zł</option>
                    </select>

                    {/* Wartość */}
                    <input
                      type="number"
                      min={0}
                      value={row.value}
                      onChange={(e) => updateRowAt(idx, { value: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="0"
                      className={t.input}
                    />

                    {/* Min zam */}
                    <input
                      type="number"
                      min={0}
                      value={row.minOrder ?? ""}
                      onChange={(e) => updateRowAt(idx, { minOrder: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="—"
                      className={t.input}
                    />

                    {/* Max użyć */}
                    <input
                      type="number"
                      min={0}
                      value={row.maxUses ?? ""}
                      onChange={(e) => updateRowAt(idx, { maxUses: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="∞"
                      className={t.input}
                    />

                    {/* Na osobę */}
                    <input
                      type="number"
                      min={0}
                      value={row.perUserMaxUses ?? ""}
                      onChange={(e) => updateRowAt(idx, { perUserMaxUses: e.target.value === "" ? "" : Number(e.target.value) })}
                      placeholder="∞"
                      className={t.input}
                    />

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => saveCodeRow(row, idx)}
                        disabled={row._saving}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                      >
                        {row._saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Zapisz
                      </button>
                      <button
                        onClick={() => removeCodeRow(row, idx)}
                        disabled={row._saving}
                        className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom row - checkbox i statystyki */}
                  <div className={`flex items-center gap-6 mt-3 pt-3 border-t ${t.border}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(e) => updateRowAt(idx, { active: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        row.active 
                          ? "bg-emerald-500 border-emerald-500" 
                          : isDark ? "border-slate-500" : "border-gray-300"
                      }`}>
                        {row.active && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm ${t.text}`}>Aktywny</span>
                    </label>
                    
                    {row.usedCount > 0 && (
                      <span className={`text-sm ${t.textMuted}`}>
                        Użyto: <span className="font-semibold">{row.usedCount}x</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
