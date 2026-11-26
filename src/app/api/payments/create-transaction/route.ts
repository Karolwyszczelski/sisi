export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyPayment } from "@/lib/orderLink";
import { orderIdSchema, orderServiceClient } from "@/lib/orderLifecycle";
import { processOrderJob } from "@/lib/orderQueue";
import { hostFromEnv } from "@/lib/p24";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const url = new URL(req.url);
  const id = orderIdSchema.safeParse(body?.orderId ?? body?.id ?? url.searchParams.get("orderId") ?? url.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Niepoprawny identyfikator zamówienia." }, { status: 400 });
  if (!verifyPayment(id.data, body?.paymentToken)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const db = orderServiceClient();
    const requestRegistration = async () => {
      const { data, error } = await db.rpc("sisi_request_p24", { order_id: id.data });
      if (error) throw new Error("queue_request_failed");
      return data;
    };

    let payment = await requestRegistration();
    if (payment.outcome === "pending") {
      await processOrderJob(db, `p24_register:${id.data}`);
      payment = await requestRegistration();
    }

    const headers = { "Cache-Control": "no-store" };
    switch (payment.outcome) {
      case "ready": {
        const paymentUrl = `https://${hostFromEnv()}/trnRequest/${encodeURIComponent(payment.token)}`;
        return NextResponse.json({ paymentUrl }, { headers });
      }
      case "pending":
        return NextResponse.json({ state: "pending" }, { status: 202, headers: { ...headers, "Retry-After": "3" } });
      case "review":
        return NextResponse.json({ error: "Status rejestracji płatności wymaga sprawdzenia. Skontaktuj się z restauracją, podając numer zamówienia.", orderId: id.data }, { status: 409, headers });
      case "missing":
        return NextResponse.json({ error: "Nie znaleziono zamówienia." }, { status: 404, headers });
      default:
        return NextResponse.json({ error: "Zamówienie nie oczekuje na płatność online." }, { status: 409, headers });
    }
  } catch {
    return NextResponse.json({ error: "Nie udało się sprawdzić rejestracji płatności. Ponów tę samą próbę." }, { status: 503 });
  }
}
