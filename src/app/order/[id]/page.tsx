"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type S = {
  id: number;
  status: string;
  eta: string | null;
  option: string;
  total: number;
  placedAt: string;
  clientRequestedTime: string | null;
};

export default function OrderTrackPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<S | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = sp.get("t") || "";
    const url = `/api/orders/status/${id}?t=${t}`;
    let stop = false;

    const load = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) { setErr((await r.json()).error || "Błąd"); return; }
        const j = (await r.json()) as S;
        if (!stop) setData(j);
      } catch { if (!stop) setErr("Błąd sieci"); }
    };

    load();
    const iv = setInterval(load, 15000);
    return () => { stop = true; clearInterval(iv); };
  }, [id, sp]);

  if (err) return <section className="min-h-[50vh] flex items-center justify-center text-white">Błąd: {err}</section>;
  if (!data) return <section className="min-h-[50vh] flex items-center justify-center text-white">Ładowanie…</section>;

  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 py-16 text-white">
      <div className="w-full max-w-md text-center border border-white/30 rounded-2xl p-6 bg-black/40">
        <h1 className="text-2xl font-bold mb-2">Zamówienie #{data.id}</h1>
        <p className="text-sm opacity-80 mb-4">Opcja: {data.option}</p>
        <div className="text-lg">Status: <span className="font-semibold">{data.status}</span></div>
        <div className="mt-2 text-lg">ETA: <span className="font-semibold">{data.eta ?? "w przygotowaniu"}</span></div>
        <div className="mt-4 text-sm opacity-80">Suma: {data.total} zł</div>
      </div>
    </section>
  );
}
