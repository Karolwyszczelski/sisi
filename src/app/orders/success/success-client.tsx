"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get("orderId");
  const token = sp.get("t");

  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(false);

  async function load() {
    async function load() {
    if (!orderId) return;
    if (!token) {
      setStatus("missing-token");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/orders/status/${encodeURIComponent(orderId)}?t=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const o = await r.json();
        setStatus(o.payment_status || o.status || "pending");
      }
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (!orderId) return;
    if (!token) {
      setStatus("missing-token");
      return;
    }
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [orderId, token]);

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
          {status === "paid"
            ? "Płatność potwierdzona. Dziękujemy!"
            : status === "failed"
              ? "Płatność nie powiodła się. Spróbuj ponownie."
              : status === "missing-token"
                ? "Nie możemy potwierdzić płatności automatycznie. Skontaktuj się z nami, podając numer zamówienia."
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
