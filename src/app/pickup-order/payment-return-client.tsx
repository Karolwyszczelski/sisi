"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { completePendingPurchase, trackEvent } from "@/lib/analytics";

type PaymentState = "pending" | "paid" | "failed" | "error";

export default function PaymentReturnClient() {
  const params = useSearchParams();
  const orderId = params.get("id") || "";
  const paymentToken = params.get("t") || "";
  const [state, setState] = useState<PaymentState>(orderId ? "pending" : "error");
  const [message, setMessage] = useState(orderId ? "Finalizujemy płatność…" : "Brak identyfikatora zamówienia.");
  const stopped = useRef(false);
  const attempts = useRef(0);

  const refresh = useCallback(async () => {
    if (!orderId || stopped.current) return;
    try {
      const response = await fetch(`/api/payments/p24/refresh?id=${encodeURIComponent(orderId)}`, {
        method: "POST",
        headers: { "X-Order-Payment": paymentToken },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nie udało się sprawdzić płatności.");

      if (data.payment_status === "paid") {
        stopped.current = true;
        completePendingPurchase(orderId);
        trackEvent("online_payment_confirmed", { transaction_id: orderId });
        setState("paid");
        setMessage("Płatność została potwierdzona. Dziękujemy za zamówienie!");
        return;
      }

      if (data.payment_status === "failed") {
        stopped.current = true;
        setState("failed");
        setMessage("Płatność nie powiodła się. Skontaktuj się z restauracją, jeśli środki zostały pobrane.");
        return;
      }

      attempts.current += 1;
      if (attempts.current >= 30) {
        stopped.current = true;
        setState("pending");
        setMessage("Płatność jest nadal przetwarzana. Potwierdzenie zamówienia otrzymasz e-mailem.");
        return;
      }
      window.setTimeout(refresh, 2000);
    } catch (error) {
      stopped.current = true;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Nie udało się sprawdzić płatności.");
    }
  }, [orderId, paymentToken]);

  useEffect(() => {
    stopped.current = false;
    attempts.current = 0;
    void refresh();
    return () => { stopped.current = true; };
  }, [refresh]);

  return (
    <main className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md rounded-2xl bg-black text-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold mb-3">
          {state === "paid" ? "Płatność potwierdzona" : state === "failed" ? "Płatność nieudana" : "Status płatności"}
        </h1>
        <p className="text-white/75 mb-6">{message}</p>
        {orderId && state !== "paid" && (
          <button
            type="button"
            onClick={() => {
              stopped.current = false;
              attempts.current = 0;
              setState("pending");
              setMessage("Ponownie sprawdzamy płatność…");
              void refresh();
            }}
            className="w-full mb-3 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black"
          >
            Sprawdź ponownie
          </button>
        )}
        <Link href="/" className="inline-block underline text-white/80 hover:text-white">
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
