import { Suspense } from "react";
import PaymentReturnClient from "./payment-return-client";

export const dynamic = "force-dynamic";

export default function PickupOrderPage() {
  return (
    <Suspense fallback={<PaymentReturnFallback />}>
      <PaymentReturnClient />
    </Suspense>
  );
}

function PaymentReturnFallback() {
  return (
    <main className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Sprawdzamy płatność</h1>
        <p>Prosimy o chwilę…</p>
      </div>
    </main>
  );
}
