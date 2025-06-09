"use client";

import { useState, useEffect, useRef, createRef } from "react";
import Draggable from "react-draggable";
import { produce } from "immer";

interface Table {
  id: string;
  table_number: string;
  number_of_seats: number;
  x: number;
  y: number;
}

export default function TableLayoutForm() {
  const [tables, setTables] = useState<Table[]>([]);
  const nodeRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});

  // 1. Fetch + normalizacja
  useEffect(() => {
    fetch("/api/settings/tables")
      .then((r) => r.json())
      .then((data: Partial<Table>[]) => {
        const norm: Table[] = data.map((t, idx) => ({
          id: t.id!,
          table_number: t.table_number ?? `Stolik ${idx + 1}`,
          number_of_seats: t.number_of_seats ?? 4,
          x: t.x ?? 0,
          y: t.y ?? 0,
        }));
        setTables(norm);
        // utwórz refy
        norm.forEach((t) => {
          if (!nodeRefs.current[t.id]) {
            nodeRefs.current[t.id] = createRef<HTMLDivElement>();
          }
        });
      })
      .catch(console.error);
  }, []);

  // 2. Dodaj stolik
  const addTable = () => {
    setTables((prev) => {
      const nr = prev.length + 1;
      const nt: Table = {
        id: crypto.randomUUID(),
        table_number: `Stolik ${nr}`,
        number_of_seats: 4,
        x: 0,
        y: 0,
      };
      nodeRefs.current[nt.id] = createRef<HTMLDivElement>();
      return [...prev, nt];
    });
  };

  // 3. Aktualizacja pola
  const updateTable = (id: string, key: keyof Table, value: string | number) => {
    setTables((prev) =>
      produce(prev, (draft) => {
        const t = draft.find((x) => x.id === id)!;
        // @ts-ignore
        t[key] = value;
      })
    );
  };

  // 4. Zapis do Supabase
  const onSave = async () => {
    try {
      const res = await fetch("/api/settings/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tables),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || res.statusText);
      }
      alert("Układ stolików zapisany!");
    } catch (e: any) {
      console.error(e);
      alert("Błąd zapisu: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Układ stolików</h2>

      <button
        onClick={addTable}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        + Nowy stolik
      </button>

      {/* Edycja numeru i miejsc */}
      <div className="grid gap-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className="p-4 border rounded grid grid-cols-4 items-center gap-2"
          >
            <label className="col-span-2">
              <span className="block text-sm font-medium">Nazwa stolika</span>
              <input
                className="mt-1 w-full border rounded px-2 py-1"
                value={t.table_number}
                onChange={(e) => updateTable(t.id, "table_number", e.target.value)}
              />
            </label>
            <label className="col-span-1">
              <span className="block text-sm font-medium">Miejsc</span>
              <input
                type="number"
                min={1}
                className="mt-1 w-full border rounded px-2 py-1"
                value={t.number_of_seats}
                onChange={(e) =>
                  updateTable(t.id, "number_of_seats", +e.target.value)
                }
              />
            </label>
          </div>
        ))}
      </div>

      {/* Obszar drag&drop */}
      <div className="relative w-full h-[400px] border bg-gray-50">
        {tables.map((t) => (
          <Draggable
            key={t.id}
            nodeRef={nodeRefs.current[t.id]}
            bounds="parent"
            position={{ x: t.x, y: t.y }}
            onStop={(_, d) => {
              updateTable(t.id, "x", d.x);
              updateTable(t.id, "y", d.y);
            }}
          >
            <div
              ref={nodeRefs.current[t.id]}
              className="absolute cursor-move px-3 py-1 bg-white border rounded shadow"
            >
              {t.table_number} ({t.number_of_seats})
            </div>
          </Draggable>
        ))}
      </div>

      <button
        onClick={onSave}
        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Zapisz układ stolików
      </button>
    </div>
  );
}
