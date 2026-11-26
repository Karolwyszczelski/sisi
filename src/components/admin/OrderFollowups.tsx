"use client";

import { useCallback, useEffect, useState } from "react";

type Followup = {
  order_id: string;
  kind: "refund_p24" | "refund_offline" | "cancel_pos";
  amount_grosze: number | null;
  p24_order_id: string | null;
  claim: "available" | "mine" | "taken";
};

const labels = {
  refund_p24: "Zwrot przez Przelewy24",
  refund_offline: "Zwrot płatności przy odbiorze",
  cancel_pos: "Sprawdzenie i anulowanie w POS",
};

export default function OrderFollowups({ isDark }: { isDark: boolean }) {
  const [tasks, setTasks] = useState<Followup[]>([]);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/orders/followups", { cache: "no-store", signal });
      if (response.status === 403) return;
      setVisible(true);
      if (!response.ok) throw new Error();
      setTasks(await response.json());
    } catch {
      if (!signal?.aborted) {
        setVisible(true);
        setError("Nie udało się pobrać zadań.");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => void load(controller.signal);
    refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("sisi:order-cancelled", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("sisi:order-cancelled", refresh);
    };
  }, [load]);

  async function update(task: Followup, action: "claim" | "release" | "resolve", reference?: string) {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/orders/followups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: task.order_id, kind: task.kind, action, reference }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        setError(details?.error ?? "Nie udało się zapisać zadania.");
      }
    } catch {
      setError("Nie udało się zapisać zadania.");
    } finally {
      await load();
      setWorking(false);
    }
  }

  if (!visible || (!tasks.length && !error)) return null;

  return (
    <section className={`mb-4 rounded-xl border p-4 ${isDark ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
      <h2 className="font-semibold">Zadania po anulowaniu</h2>
      <p className="mt-1 text-sm">Przejmij zadanie i sprawdź historię u operatora, zanim zlecisz zwrot lub anulowanie.</p>
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
      <ul className="mt-3 space-y-3">
        {tasks.map((task) => (
          <li key={`${task.order_id}:${task.kind}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-500/30 pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{labels[task.kind]} {task.amount_grosze !== null &&
                `· ${(task.amount_grosze / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`}</p>
              <p className="break-all text-xs">Zamówienie {task.order_id}{task.p24_order_id && ` · P24 ${task.p24_order_id}`}</p>
            </div>
            {task.claim === "available" && (
              <button type="button" disabled={working} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => void update(task, "claim")}>Przejmij</button>
            )}
            {task.claim === "taken" && <p className="text-sm">Przejęte przez innego administratora</p>}
            {task.claim === "mine" && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                event.preventDefault();
                const reference = new FormData(event.currentTarget).get("reference");
                if (typeof reference === "string" && reference.trim()) void update(task, "resolve", reference);
              }}>
                <label className="text-xs">
                  Numer potwierdzenia
                  <input name="reference" maxLength={120} required className={`mt-1 block rounded border px-2 py-1 text-sm ${isDark ? "border-slate-600 bg-slate-900" : "border-slate-300"}`} />
                </label>
                <button disabled={working} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">
                  Potwierdź wykonanie
                </button>
                <button type="button" disabled={working} className="px-2 py-2 text-sm underline disabled:opacity-50"
                  onClick={() => void update(task, "release")}>Zwolnij</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
