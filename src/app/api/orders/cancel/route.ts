// app/api/orders/cancel/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // Odczytujemy dane z ciała żądania (np. orderId)
    const body = await request.json();
    const { orderId } = body;
    console.log("[Cancel Endpoint] Odebrane orderId:", orderId);

    if (!orderId) {
      console.error("[Cancel Endpoint] Brak orderId!");
      return NextResponse.json({ error: "Brak orderId" }, { status: 400 });
    }

    // Inicjujemy klienta Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Aktualizujemy rekord zamówienia, ustawiając status na "cancelled"
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    console.log("[Cancel Endpoint] Data z update:", data);
    if (error) {
      console.error("[Cancel Endpoint] Błąd update:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[Cancel Endpoint] Błąd:", err.message);
    return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: 500 });
  }
}
