"use client";

import React, { useEffect, useState } from "react";

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
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function DiscountsSettingsForm() {
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [globalPromo, setGlobalPromo] = useState<GlobalPromo>({
    id: null,
    type: "percent",
    value: "",
    minOrder: "",
    startsAt: "",
    expiresAt: "",
    active: false,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/discount-codes", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list: DiscountRow[] = (Array.isArray(data) ? data : []).map((d: any) => ({
        id: d.id ?? null,
        code: d.code ?? "",
        type: d.type === "amount" ? "amount" : "percent",
        value:
          typeof d.value === "number"
            ? d.value
            : d.value != null
            ? Number(d.value)
            : "",
        minOrder: d.min_order == null ? "" : Number(d.min_order),
        maxUses: d.max_uses == null ? "" : Number(d.max_uses),
        perUserMaxUses:
          d.per_user_max_uses == null ? "" : Number(d.per_user_max_uses),
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
          id: auto.id,
          type: auto.type,
          value: auto.value,
          minOrder: auto.minOrder,
          startsAt: auto.startsAt,
          expiresAt: auto.expiresAt,
          active: auto.active,
        });
      } else {
        setGlobalPromo({
          id: null,
          type: "percent",
          value: "",
          minOrder: "",
          startsAt: "",
          expiresAt: "",
          active: false,
        });
      }

      setRows(list.filter((r) => !r.autoApply));
    } catch (e: any) {
      console.error("[DiscountsSettingsForm] load error:", e);
      setErrorMsg(e?.message || "Nie udało się pobrać danych rabatów.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addCodeRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: null,
        code: "",
        type: "percent",
        value: 10,
        minOrder: "",
        maxUses: "",
        perUserMaxUses: "",
        startsAt: "",
        expiresAt: "",
        active: true,
        isPublic: true,
        autoApply: false,
        usedCount: 0,
      },
    ]);
  };

  const updateRowAt = (idx: number, patch: Partial<DiscountRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const saveCodeRow = async (row: DiscountRow, index: number) => {
    setErrorMsg(null);

    const code = row.code.trim();
    if (!code) {
      setErrorMsg("Kod nie może być pusty.");
      return;
    }

    const value = row.value === "" ? 0 : Number(row.value);
    if (!Number.isFinite(value) || value <= 0) {
      setErrorMsg("Wartość rabatu musi być większa od 0.");
      return;
    }

    const payload: any = {
      code,
      type: row.type,
      value,
      min_order: row.minOrder === "" ? null : Number(row.minOrder),
      max_uses: row.maxUses === "" ? null : Number(row.maxUses),
      per_user_max_uses:
        row.perUserMaxUses === "" ? null : Number(row.perUserMaxUses),
      starts_at: row.startsAt || null,
      expires_at: row.expiresAt || null,
      active: row.active,
      public: row.isPublic,
      auto_apply: false,
    };

    const isNew = !row.id;
    const url = isNew
      ? "/api/admin/discount-codes"
      : `/api/admin/discount-codes/${row.id}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      updateRowAt(index, { _saving: true });
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const updated: DiscountRow = {
        id: data.id ?? row.id ?? null,
        code: data.code ?? code,
        type: data.type === "amount" ? "amount" : "percent",
        value:
          typeof data.value === "number"
            ? data.value
            : Number(data.value ?? value),
        minOrder: data.min_order == null ? "" : Number(data.min_order),
        maxUses: data.max_uses == null ? "" : Number(data.max_uses),
        perUserMaxUses:
          data.per_user_max_uses == null
            ? ""
            : Number(data.per_user_max_uses),
        startsAt: isoToInput(data.starts_at),
        expiresAt: isoToInput(data.expires_at),
        active: !!data.active,
        isPublic: !!data.public,
        autoApply: !!data.auto_apply,
        usedCount: Number(data.used_count ?? row.usedCount),
      };

      setRows((prev) => prev.map((r, i) => (i === index ? updated : r)));
    } catch (e: any) {
      console.error("[DiscountsSettingsForm] save code error:", e);
      setErrorMsg(e?.message || "Nie udało się zapisać kodu rabatowego.");
    } finally {
      updateRowAt(index, { _saving: false });
    }
  };

  const removeCodeRow = async (row: DiscountRow, index: number) => {
    if (!row.id) {
      // jeszcze nie w bazie – po prostu usuń z listy
      setRows((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!confirm("Na pewno chcesz wyłączyć ten kod rabatowy?")) return;

    try {
      updateRowAt(index, { _saving: true });
      const res = await fetch(`/api/admin/discount-codes/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // odśwież z serwera
      await load();
    } catch (e: any) {
      console.error("[DiscountsSettingsForm] delete code error:", e);
      setErrorMsg(e?.message || "Nie udało się wyłączyć kodu.");
    } finally {
      updateRowAt(index, { _saving: false });
    }
  };

  const saveGlobalPromo = async () => {
    setErrorMsg(null);

    const value =
      globalPromo.value === "" ? 0 : Number(globalPromo.value);
    if (!Number.isFinite(value) || value <= 0) {
      setErrorMsg("Wartość globalnego rabatu musi być > 0.");
      return;
    }

    const payload: any = {
      // kod nie jest wymagany – backend wygeneruje jeśli pusty
      code: "",
      type: globalPromo.type,
      value,
      min_order:
        globalPromo.minOrder === "" ? null : Number(globalPromo.minOrder),
      starts_at: globalPromo.startsAt || null,
      expires_at: globalPromo.expiresAt || null,
      active: globalPromo.active,
      public: true,
      auto_apply: true,
    };

    const isNew = !globalPromo.id;
    const url = isNew
      ? "/api/admin/discount-codes"
      : `/api/admin/discount-codes/${globalPromo.id}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      setGlobalPromo((g) => ({ ...g, _saving: true }));
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setGlobalPromo({
        id: data.id ?? globalPromo.id ?? null,
        type: data.type === "amount" ? "amount" : "percent",
        value:
          typeof data.value === "number"
            ? data.value
            : Number(data.value ?? value),
        minOrder: data.min_order == null ? "" : Number(data.min_order),
        startsAt: isoToInput(data.starts_at),
        expiresAt: isoToInput(data.expires_at),
        active: !!data.active,
      });
    } catch (e: any) {
      console.error("[DiscountsSettingsForm] save global error:", e);
      setErrorMsg(e?.message || "Nie udało się zapisać globalnej promocji.");
    } finally {
      setGlobalPromo((g) => ({ ...g, _saving: false }));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">Globalna promocja (bez kodu)</h3>
        <p className="text-sm text-slate-600">
          Tu ustawiasz stały rabat nakładany automatycznie na wszystkie
          zamówienia spełniające warunki (np. -10% przy zamówieniu &gt; 50 zł).
          Klient nie musi wpisywać kodu.
        </p>

        {errorMsg && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-md border bg-slate-50 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Typ rabatu
            </label>
            <select
              className="w-full rounded border bg-white px-3 py-2 text-sm"
              value={globalPromo.type}
              onChange={(e) =>
                setGlobalPromo((g) => ({
                  ...g,
                  type: e.target.value as DiscountType,
                }))
              }
            >
              <option value="percent">Procentowo (%)</option>
              <option value="amount">Kwotowo (zł)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Wartość
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded border px-3 py-2 text-sm"
              value={globalPromo.value}
              onChange={(e) =>
                setGlobalPromo((g) => ({
                  ...g,
                  value: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              placeholder={globalPromo.type === "percent" ? "np. 10" : "np. 5"}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Minimalna wartość zamówienia (zł)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded border px-3 py-2 text-sm"
              value={globalPromo.minOrder ?? ""}
              onChange={(e) =>
                setGlobalPromo((g) => ({
                  ...g,
                  minOrder:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              placeholder="brak progu"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Zakres dat (opcjonalnie)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                className="rounded border px-2 py-1 text-sm"
                value={globalPromo.startsAt}
                onChange={(e) =>
                  setGlobalPromo((g) => ({ ...g, startsAt: e.target.value }))
                }
              />
              <input
                type="datetime-local"
                className="rounded border px-2 py-1 text-sm"
                value={globalPromo.expiresAt}
                onChange={(e) =>
                  setGlobalPromo((g) => ({ ...g, expiresAt: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={globalPromo.active}
                onChange={(e) =>
                  setGlobalPromo((g) => ({ ...g, active: e.target.checked }))
                }
              />
              Aktywna promocja
            </label>
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={saveGlobalPromo}
            disabled={globalPromo._saving}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Zapisz globalną promocję
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Kody rabatowe</h3>
          <p className="text-sm text-slate-600">
            Tu zarządzasz kodami rabatowymi (jednorazowe, wielorazowe, kody
            publiczne i „tajne”). Progi, daty, limity wykorzystań opierają się
            na tej samej tabeli co w koszyku.
          </p>
        </div>

        {loading ? (
          <div className="rounded-md border bg-white px-4 py-6 text-center text-sm text-slate-500">
            Ładowanie kodów…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Kod
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Typ
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Wartość
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Min. zamówienie (zł)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Max użyć (globalnie)
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Max użyć / użytkownika
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Wykorzystano
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Start / Koniec
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Publiczny / Aktywny
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      Brak zdefiniowanych kodów rabatowych.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id ?? `new-${index}`}>
                      <td className="px-3 py-2 align-top">
                        <input
                          className="w-full rounded border px-2 py-1 text-xs uppercase"
                          value={row.code}
                          onChange={(e) =>
                            updateRowAt(index, { code: e.target.value })
                          }
                        />
                        <div className="mt-1 text-[10px] text-slate-500">
                          Pozostaw, aby nie zmieniać istniejącego kodu.
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          className="w-full rounded border px-2 py-1 text-xs"
                          value={row.type}
                          onChange={(e) =>
                            updateRowAt(index, {
                              type: e.target.value as DiscountType,
                            })
                          }
                        >
                          <option value="percent">% od wartości</option>
                          <option value="amount">Kwota (zł)</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 rounded border px-2 py-1 text-xs"
                          value={row.value}
                          onChange={(e) =>
                            updateRowAt(index, {
                              value:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                        />
                        <div className="mt-1 text-[10px] text-slate-500">
                          Jednorazowy przykład: 30 = -30%
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 rounded border px-2 py-1 text-xs"
                          value={row.minOrder ?? ""}
                          onChange={(e) =>
                            updateRowAt(index, {
                              minOrder:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="brak"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="1"
                          className="w-20 rounded border px-2 py-1 text-xs"
                          value={row.maxUses ?? ""}
                          onChange={(e) =>
                            updateRowAt(index, {
                              maxUses:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="∞"
                        />
                        <div className="mt-1 text-[10px] text-slate-500">
                          1 = kod jednorazowy; puste = bez limitu
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="1"
                          className="w-20 rounded border px-2 py-1 text-xs"
                          value={row.perUserMaxUses ?? ""}
                          onChange={(e) =>
                            updateRowAt(index, {
                              perUserMaxUses:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="brak"
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-center text-xs text-slate-700">
                        {row.usedCount}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1">
                          <input
                            type="datetime-local"
                            className="rounded border px-2 py-1 text-xs"
                            value={row.startsAt}
                            onChange={(e) =>
                              updateRowAt(index, {
                                startsAt: e.target.value,
                              })
                            }
                          />
                          <input
                            type="datetime-local"
                            className="rounded border px-2 py-1 text-xs"
                            value={row.expiresAt}
                            onChange={(e) =>
                              updateRowAt(index, {
                                expiresAt: e.target.value,
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-1 text-xs">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300"
                              checked={row.isPublic}
                              onChange={(e) =>
                                updateRowAt(index, {
                                  isPublic: e.target.checked,
                                })
                              }
                            />
                            publiczny
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300"
                              checked={row.active}
                              onChange={(e) =>
                                updateRowAt(index, {
                                  active: e.target.checked,
                                })
                              }
                            />
                            aktywny
                          </label>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={() => saveCodeRow(row, index)}
                            disabled={row._saving}
                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Zapisz
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCodeRow(row, index)}
                            disabled={row._saving}
                            className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                          >
                            Usuń / wyłącz
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={addCodeRow}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          + Dodaj nowy kod rabatowy
        </button>
      </div>
    </div>
  );
}
