"use client";

import { useState, useEffect } from "react";
import { produce } from "immer";
import { v4 as uuidv4 } from "uuid";

interface Zone {
  id?: string;
  min_distance_km: number;
  max_distance_km: number;
  min_order_value: number;
  cost: number;
  free_over: number | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
}

export default function DeliveryZonesForm() {
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    fetch("/api/settings/deliveryZones")
      .then(res => res.json())
      .then(setZones)
      .catch(console.error);
  }, []);

  const addZone = () => {
    setZones(zs =>
      zs.concat({
        id: uuidv4(),
        min_distance_km: 0,
        max_distance_km: 0,
        min_order_value: 0,
        cost: 0,
        free_over: null,
        eta_min_minutes: 0,
        eta_max_minutes: 0,
      })
    );
  };

  const update = (idx: number, key: keyof Zone, val: any) => {
    setZones(zs =>
      produce(zs, draft => {
        // @ts-ignore
        draft[idx][key] = val;
      })
    );
  };

  const save = async () => {
    const res = await fetch("/api/settings/deliveryZones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zones),
    });
    if (!res.ok) {
      const { error } = await res.json();
      return alert("Błąd: " + error);
    }
    alert("Strefy zapisane!");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Strefy dostawy</h2>
      <button
        onClick={addZone}
        className="px-3 py-1 bg-green-600 text-white rounded"
      >
        + Nowa strefa
      </button>

      <div className="space-y-3">
        {zones.map((z, i) => (
          <div
            key={z.id || i}
            className="grid grid-cols-8 gap-2 items-end border p-3 rounded"
          >
            <div>
              <label>min km</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.min_distance_km}
                onChange={e =>
                  update(i, "min_distance_km", +e.target.value)
                }
              />
            </div>
            <div>
              <label>max km</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.max_distance_km}
                onChange={e =>
                  update(i, "max_distance_km", +e.target.value)
                }
              />
            </div>
            <div>
              <label>min zamówienie</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.min_order_value}
                onChange={e =>
                  update(i, "min_order_value", +e.target.value)
                }
              />
            </div>
            <div>
              <label>koszt</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.cost}
                onChange={e => update(i, "cost", +e.target.value)}
              />
            </div>
            <div>
              <label>darmowa powyżej</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.free_over ?? ""}
                onChange={e =>
                  update(i, "free_over", e.target.value ? +e.target.value : null)
                }
              />
            </div>
            <div>
              <label>ETA min (min)</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.eta_min_minutes}
                onChange={e =>
                  update(i, "eta_min_minutes", +e.target.value)
                }
              />
            </div>
            <div>
              <label>ETA max (min)</label>
              <input
                type="number"
                className="w-full border rounded px-1"
                value={z.eta_max_minutes}
                onChange={e =>
                  update(i, "eta_max_minutes", +e.target.value)
                }
              />
            </div>
            <button
              onClick={() =>
                setZones(zs => zs.filter((_, idx) => idx !== i))
              }
              className="col-span-1 bg-red-600 text-white px-2 py-1 rounded"
            >
              Usuń
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Zapisz strefy
      </button>
    </div>
  );
}
