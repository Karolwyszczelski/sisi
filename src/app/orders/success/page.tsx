import { Suspense } from "react";
import SuccessClient from "./success-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] grid place-items-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2">Status płatności</h1>
            <p>Ładowanie…</p>
          </div>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}
