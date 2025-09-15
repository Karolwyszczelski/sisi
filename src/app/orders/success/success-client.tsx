"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = Number(sp.get("orderId") || "0");

  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/status/${orderId}`, { cache: "no-store" });
      if (r.ok) {
        const o = await r.json();
        setStatus(o.payment_status || o.status || "pending");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [orderId]);

  useEffect(() => {
    if (status === "paid") {
      const t = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Status płatności</h1>
        <p className="mb-4">
          {status === "paid" ? "Płatność potwierdzona. Dziękujemy!"
           : status === "failed" ? "Płatność nie powiodła się. Spróbuj ponownie."
           : "Finalizujemy płatność…"}
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {loading ? "Sprawdzam…" : "Sprawdź status"}
        </button>
      </div>
    </div>
  );
}
