"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import clsx from "clsx";

type TableRow = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  capacity: number;
  active: boolean;
};

const GRID = 10; // przyciąganie
const MIN = 44;  // min rozmiar kafelka

export default function TableLayoutForm() {
  const supabase = createClientComponentClient();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // pobierz z bazy
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("label", { ascending: true });
      if (!stop) {
        if (!error && data) setRows(data as TableRow[]);
        setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [supabase]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  // dodaj nowy stół
  const addTable = () => {
    const id = crypto.randomUUID();
    const n: TableRow = {
      id,
      label: `Stół ${rows.length + 1}`,
      x: 40 + (rows.length * 20) % 400,
      y: 40 + (rows.length * 15) % 200,
      w: 90,
      h: 90,
      rotation: 0,
      capacity: 2,
      active: true,
    };
    setRows((r) => [...r, n]);
    setSelectedId(id);
  };

  const removeSelected = async () => {
    if (!selected) return;
    // usuń lokalnie
    setRows((r) => r.filter((x) => x.id !== selected.id));
    setSelectedId(null);
    // usuń w bazie (best effort)
    await supabase.from("restaurant_tables").delete().eq("id", selected.id);
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    setRows((r) =>
      r.map((x) => (x.id === selected.id ? { ...x, rotation: ((x.rotation + deg) % 360 + 360) % 360 } : x))
    );
  };

  const updateSelected = (patch: Partial<TableRow>) => {
    if (!selected) return;
    setRows((r) => r.map((x) => (x.id === selected.id ? { ...x, ...patch } : x)));
  };

  const saveAll = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurant_tables")
      .upsert(rows, { onConflict: "id" });
    setSaving(false);
    if (!error) {
      // odśwież (żeby mieć updated_at z serwera)
      const { data } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("label", { ascending: true });
      if (data) setRows(data as TableRow[]);
    } else {
      alert("Nie udało się zapisać układu.");
    }
  };

  // przeciąganie / skalowanie
  const startDrag = (e: React.MouseEvent, id: string, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);

    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();

    const table = rows.find((t) => t.id === id)!;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...table };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (mode === "move") {
        let nx = orig.x + dx;
        let ny = orig.y + dy;

        // granice
        nx = Math.max(0, Math.min(nx, rect.width - orig.w));
        ny = Math.max(0, Math.min(ny, rect.height - orig.h));

        // snap
        nx = Math.round(nx / GRID) * GRID;
        ny = Math.round(ny / GRID) * GRID;

        setRows((r) => r.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)));
      } else {
        let nw = Math.max(MIN, orig.w + dx);
        let nh = Math.max(MIN, orig.h + dy);
        // granice
        nw = Math.min(nw, rect.width - orig.x);
        nh = Math.min(nh, rect.height - orig.y);
        // snap
        nw = Math.round(nw / GRID) * GRID;
        nh = Math.round(nh / GRID) * GRID;

        setRows((r) => r.map((t) => (t.id === id ? { ...t, w: nw, h: nh } : t)));
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addTable} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">
          + Dodaj stół
        </button>
        <button onClick={() => rotateSelected(90)} disabled={!selected} className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
          Obróć 90°
        </button>
        <button onClick={removeSelected} disabled={!selected} className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
          Usuń wybrany
        </button>
        <button onClick={saveAll} disabled={saving} className="ml-auto rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Zapisywanie…" : "Zapisz układ"}
        </button>
      </div>

      {/* Panel właściwości */}
      <div className="rounded border bg-gray-50 p-3 text-sm">
        {selected ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-600">Nazwa</label>
              <input
                value={selected.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                className="h-9 rounded border px-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Miejsca</label>
              <input
                type="number"
                min={1}
                value={selected.capacity}
                onChange={(e) => updateSelected({ capacity: Math.max(1, Number(e.target.value) || 1) })}
                className="h-9 w-20 rounded border px-2"
              />
            </div>
            <div className="text-gray-600">
              Pozycja: <b>{selected.x}</b>×<b>{selected.y}</b> px • Rozmiar: <b>{selected.w}</b>×<b>{selected.h}</b> px • Rot: <b>{selected.rotation}°</b>
            </div>
            <label className="ml-auto inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.active}
                onChange={(e) => updateSelected({ active: e.target.checked })}
              />
              Aktywny
            </label>
          </div>
        ) : (
          <div className="text-gray-600">Wybierz stół, aby edytować właściwości.</div>
        )}
      </div>

      {/* Płótno z mapą lokalu – podmień tło wg potrzeb */}
      <div
        ref={wrapRef}
        className={clsx(
          "relative mx-auto aspect-[16/9] w-full max-w-4xl rounded-md border bg-white",
          "bg-[url('/floor-example.png')] bg-cover bg-center"
        )}
      >
        {/* siatka */}
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.04) 1px, transparent 1px)",
          backgroundSize: `${GRID}px ${GRID}px`,
        }} />

        {/* stoły */}
        {rows.map((t) => (
          <div
            key={t.id}
            style={{
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              transform: `rotate(${t.rotation}deg)`,
            }}
            role="button"
            tabIndex={0}
            onMouseDown={(e) => startDrag(e, t.id, "move")}
            onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); }}
            className={clsx(
              "absolute cursor-move select-none rounded-md border-2 p-1 text-[11px] font-medium shadow-sm",
              t.active ? "bg-amber-100/80 border-amber-400" : "bg-gray-200/70 border-gray-400",
              selectedId === t.id ? "ring-2 ring-indigo-500" : "ring-0"
            )}
          >
            <div className="truncate">{t.label}</div>
            <div className="text-[10px] text-gray-600">{t.capacity} os.</div>

            {/* uchwyt do zmiany rozmiaru */}
            <div
              onMouseDown={(e) => startDrag(e, t.id, "resize")}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-br-md bg-indigo-500"
              title="Przeciągnij, by zmienić rozmiar"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Podpowiedzi: przeciągnij stół aby zmienić pozycję, pociągnij fioletowy narożnik aby zmienić rozmiar,
        przycisk „Obróć 90°” – zmiana orientacji. Układ zapisuje się przyciskiem „Zapisz układ”.
      </p>
    </div>
  );
}
