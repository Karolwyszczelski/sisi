// src/app/api/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import { sendSms } from "@/lib/sms";
import type { Database } from "@/types/supabase";

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  // 1) Autoryzacja + sprawdzenie roli
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Klient Supabase z dostępem do cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // 3) Parsowanie ciała żądania i budowa updateData
  const body = await request.json();
  const orderId = params.orderId;
  const updateData: Record<string, any> = {};
  if (body.status)          updateData.status = body.status;
  if (body.deliveryTime)    updateData.deliveryTime = body.deliveryTime;
  if (body.items !== undefined) {
    updateData.items = typeof body.items === "string"
      ? body.items
      : JSON.stringify(body.items);
  }
  if (body.selected_option) updateData.selected_option = body.selected_option;
  if (body.total_price)     updateData.total_price = body.total_price;
  if (body.address)         updateData.address = body.address;
  if (body.phone)           updateData.phone = body.phone;
  if (body.customer_name)   updateData.customer_name = body.customer_name;

  // 4) Wykonanie update'u w Supabase
  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select();

  if (error) {
    console.error("[PATCH /orders/:id] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedOrder = Array.isArray(data) ? data[0] : data;
  if (!updatedOrder) {
    return NextResponse.json({ error: "Nie znaleziono zamówienia" }, { status: 500 });
  }

  // 5) Przygotowanie spersonalizowanej treści SMS
  let bodyText: string;
  switch (updatedOrder.status) {
    case "accepted":
      bodyText = `👍 Twoje zamówienie nr ${orderId} zostało przyjęte!`;
      if (updatedOrder.deliveryTime) {
        const t = new Date(updatedOrder.deliveryTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        bodyText += ` Przygotuj się na odbiór o ${t}.`;
      }
      bodyText += ` Dziękujemy za wybór naszej restauracji!`;
      break;

    case "completed":
      bodyText = `✅ Zamówienie nr ${orderId} zostało zrealizowane. Smacznego! 🍽️`;
      break;

    case "cancelled":
      bodyText = `❌ Zamówienie nr ${orderId} zostało anulowane.`;
      bodyText += ` Przepraszamy za niedogodności — w razie pytań skontaktuj się z nami.`;
      break;

    default:
      bodyText = `ℹ️ Status Twojego zamówienia nr ${orderId} został zaktualizowany do "${updatedOrder.status.toUpperCase()}".`;
  }

  // 6) Formatowanie numeru w międzynarodowym formacie
  let to = updatedOrder.phone || "";
  to = to.replace(/\D/g, "");           // usuwamy spacery i znaki
  if (!to.startsWith("00") && !to.startsWith("+")) {
    to = "+48" + to;                    // domyślnie Polska
  } else if (to.startsWith("00")) {
    to = "+" + to.slice(2);
  }

  console.log("📲 [SMS] Wywołuję sendSms:", { to, bodyText });
  try {
    const msg = await sendSms(to, bodyText);
    console.log("✅ [SMS] Wysłano, SID:", msg.sid);
  } catch (smsErr) {
    console.error("❌ [SMS] Błąd przy wysyłaniu SMS:", smsErr);
  }

  // 7) Zwrócenie zaktualizowanego zamówienia
  return NextResponse.json({ data });
}
