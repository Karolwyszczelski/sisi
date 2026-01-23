"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

const GRID = 10;
const MIN = 44;

export default function TableLayoutForm() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // load from API
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/table-layout", { cache: "no-store" });
        const j = await r.json();
        if (!stop) {
          const plan = Array.isArray(j?.layout?.plan) ? j.layout.plan : [];
          setRows(plan as TableRow[]);
        }
      } catch {
        /* ignore */
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const addTable = () => {
    const id = crypto.randomUUID();
    const n: TableRow = {
      id,
      label: `Stół ${rows.length + 1}`,
      x: 40 + ((rows.length * 20) % 400),
      y: 40 + ((rows.length * 15) % 200),
      w: 90,
      h: 90,
      rotation: 0,
      capacity: 2,
      active: true,
    };
    setRows((r) => [...r, n]);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selected) return;
    setRows((r) => r.filter((x) => x.id !== selected.id));
    setSelectedId(null);
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    setRows((r) =>
      r.map((x) =>
        x.id === selected.id
          ? { ...x, rotation: ((x.rotation + deg) % 360 + 360) % 360 }
          : x
      )
    );
  };

  const updateSelected = (patch: Partial<TableRow>) => {
    if (!selected) return;
    setRows((r) => r.map((x) => (x.id === selected.id ? { ...x, ...patch } : x)));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const compact = rows.map((t) => ({
        id: t.id,
        name: t.label,
        label: t.label, // zgodność wstecz
        x: Math.round(t.x),
        y: Math.round(t.y),
        w: Math.round(t.w),
        h: Math.round(t.h),
        rot: Math.round(t.rotation),
        rotation: Math.round(t.rotation), // zgodność wstecz
        seats: Math.round(t.capacity),
        capacity: Math.round(t.capacity), // zgodność wstecz
        active: !!t.active,
      }));
      const res = await fetch("/api/table-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "default", active: true, plan: compact }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Save error");
      // po zapisie wczytaj świeże (z updated_at itd.)
      const plan = Array.isArray(j?.layout?.plan) ? j.layout.plan : compact;
      setRows(
        plan.map((t: any) => ({
          id: String(t.id),
          label: t.label ?? t.name ?? "Stół",
          x: Number(t.x) || 0,
          y: Number(t.y) || 0,
          w: Math.max(MIN, Number(t.w) || 90),
          h: Math.max(MIN, Number(t.h) || 90),
          rotation: Number(t.rotation ?? t.rot ?? 0),
          capacity: Math.max(1, Number(t.capacity ?? t.seats ?? 2)),
          active: Boolean(t.active ?? true),
        }))
      );
    } catch (e) {
      alert("Nie udało się zapisać układu.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const startDrag = (
    e: React.MouseEvent,
    id: string,
    mode: "move" | "resize"
  ) => {
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
        nx = Math.max(0, Math.min(nx, rect.width - orig.w));
        ny = Math.max(0, Math.min(ny, rect.height - orig.h));
        nx = Math.round(nx / GRID) * GRID;
        ny = Math.round(ny / GRID) * GRID;
        setRows((r) => r.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)));
      } else {
        let nw = Math.max(MIN, orig.w + dx);
        let nh = Math.max(MIN, orig.h + dy);
        nw = Math.min(nw, rect.width - orig.x);
        nh = Math.min(nh, rect.height - orig.y);
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
        <button
          onClick={addTable}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + Dodaj stół
        </button>
        <button
          onClick={() => rotateSelected(90)}
          disabled={!selected}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Obróć 90°
        </button>
        <button
          onClick={removeSelected}
          disabled={!selected}
          className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          Usuń wybrany
        </button>
        <button
          onClick={saveAll}
          disabled={saving}
          className="ml-auto rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Zapisywanie…" : "Zapisz układ"}
        </button>
      </div>

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
                onChange={(e) =>
                  updateSelected({
                    capacity: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="h-9 w-20 rounded border px-2"
              />
            </div>
            <div className="text-gray-600">
              Pozycja: <b>{selected.x}</b>×<b>{selected.y}</b> px • Rozmiar:{" "}
              <b>{selected.w}</b>×<b>{selected.h}</b> px • Rot:{" "}
              <b>{selected.rotation}°</b>
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
          <div className="text-gray-600">
            Wybierz stół, aby edytować właściwości.
          </div>
        )}
      </div>

      <div
        ref={wrapRef}
        onMouseDown={() => setSelectedId(null)}
        className={clsx(
          "relative mx-auto aspect-[16/9] w-full max-w-4xl rounded-md border bg-white",
          "bg-[url('/floor-example.png')] bg-cover bg-center"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.04) 1px, transparent 1px)",
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
        />
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
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(t.id);
            }}
            className={clsx(
              "absolute cursor-move select-none rounded-md border-2 p-1 text-[11px] font-medium shadow-sm",
              t.active
                ? "bg-amber-100/80 border-amber-400"
                : "bg-gray-200/70 border-gray-400",
              selectedId === t.id ? "ring-2 ring-indigo-500" : "ring-0"
            )}
          >
            <div className="truncate">{t.label}</div>
            <div className="text-[10px] text-gray-600">{t.capacity} os.</div>

            <div
              onMouseDown={(e) => startDrag(e, t.id, "resize")}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-br-md bg-indigo-500"
              title="Przeciągnij, by zmienić rozmiar"
            />
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-500">Brak stołów – dodaj pierwszy.</p>
      )}
      <p className="text-xs text-gray-500">
        Podpowiedzi: przeciągnij stół aby zmienić pozycję; fioletowy narożnik – zmiana rozmiaru; „Obróć 90°” – obrót.
      </p>
    </div>
  );
}
