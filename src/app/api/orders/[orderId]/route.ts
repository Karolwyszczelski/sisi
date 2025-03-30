// app/api/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(
  request: Request,
  context: { params: { orderId: string } }
) {
  try {
    // Oczekujemy na kontekst parametrów – aby Next.js nie zgłaszał błędu
    const { orderId } = await Promise.resolve(context.params);
    console.log("[PATCH] Aktualizujemy zamówienie o ID:", orderId);

    const body = await request.json();
    // Dla edycji zamówienia pozwalamy zaktualizować status, deliveryTime oraz customer_name
    const { status, deliveryTime, customer_name } = body;
    console.log("[PATCH] Odebrane dane:", body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Przygotowujemy obiekt do aktualizacji – tylko dodajemy pola, które są określone
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (deliveryTime !== undefined) updateData.deliveryTime = deliveryTime;
    if (customer_name !== undefined) updateData.customer_name = customer_name;

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("[PATCH] Błąd aktualizacji zamówienia:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log("[PATCH] Update zakończony pomyślnie:", data);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[PATCH] Błąd w endpointzie:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
