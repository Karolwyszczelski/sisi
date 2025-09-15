"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get("orderId");
  const [msg, setMsg] = useState("Finalizujemy płatność…");

  useEffect(() => {
    let t: any;
    const tick = async () => {
      if (!orderId) return;
      const r = await fetch(`/api/orders/${orderId}`);
      if (!r.ok) return;
      const o = await r.json();
      if (o?.payment_status === "paid") {
        setMsg("Płatność potwierdzona. Dziękujemy!");
        t = setTimeout(() => router.push(`/order/${orderId}`), 1200);
      } else if (o?.payment_status === "failed") {
        setMsg("Płatność nie powiodła się. Spróbuj ponownie.");
      } else {
        setTimeout(tick, 1000);
      }
    };
    tick();
    return () => clearTimeout(t);
  }, [orderId, router]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Status płatności</h1>
        <p>{msg}</p>
      </div>
    </div>
  );
}
