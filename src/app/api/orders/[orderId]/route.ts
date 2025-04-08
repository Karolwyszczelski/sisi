import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/app/services/twilioSms";
import logger from "@/app/services/logger";

// Funkcja generująca spersonalizowaną wiadomość SMS
function getSmsMessage(order: any, orderId: string): string {
  let message = "";
  switch (order.status) {
    case "accepted":
      message = `Twoje zamówienie nr ${orderId} zostało zaakceptowane. Kwota: ${order.total_price} zł. Przewidywany czas realizacji: ${order.deliveryTime ? new Date(order.deliveryTime).toLocaleTimeString() : "brak informacji"}.`;
      break;
    case "completed":
      message = `Twoje zamówienie nr ${orderId} zostało zrealizowane. Całkowita kwota: ${order.total_price} zł. Dziękujemy za zakupy!`;
      break;
    case "cancelled":
      message = `Twoje zamówienie nr ${orderId} zostało anulowane. Jeśli masz pytania, skontaktuj się z restauracją.`;
      break;
    default:
      message = `Status Twojego zamówienia nr ${orderId} został zaktualizowany.`;
      break;
  }
  return message;
}

export async function PATCH(
  request: Request,
  context: { params: { orderId: string } }
) {
  try {
    const { orderId } = context.params;
    logger.info("[PATCH] Aktualizujemy zamówienie o ID: %s", orderId);

    const body = await request.json();
    logger.info("[PATCH] Odebrane dane: %j", body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Przygotowujemy dane do aktualizacji – teraz aktualizujemy kolumnę "items"
    const updateData: any = {};
    if (body.items !== undefined) {
      // Jeśli dane nie są stringiem, opakowujemy je w JSON.stringify
      updateData.items = typeof body.items === "string" ? body.items : JSON.stringify(body.items);
    } else if (body.products !== undefined) {
      // Dla kompatybilności (jeśli wysłane są dane pod kluczem products)
      updateData.items = typeof body.products === "string" ? body.products : JSON.stringify(body.products);
    }
    if (body.selected_option !== undefined) {
      updateData.selected_option = body.selected_option;
    }
    if (body.total_price !== undefined) {
      updateData.total_price = body.total_price;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.deliveryTime !== undefined) {
      updateData.deliveryTime = body.deliveryTime;
    }
    if (body.customer_name !== undefined) {
      updateData.customer_name = body.customer_name;
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }
    if (body.address !== undefined) {
      updateData.address = body.address;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    if (error) {
      logger.error("[PATCH] Błąd aktualizacji zamówienia: %s", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info("[PATCH] Update zakończony pomyślnie: %j", data);

    // Po aktualizacji wysyłamy SMS, jeśli rekord zawiera numer telefonu i status
    const order = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (order && order.status && order.phone) {
      const message = getSmsMessage(order, orderId);
      if (message) {
        try {
          await sendSms(order.phone, message);
          logger.info("[PATCH] SMS wysłany na numer %s", order.phone);
        } catch (smsError) {
          logger.error("[PATCH] Błąd wysyłki SMS: %s", smsError);
          // Możesz zdecydować, czy zwrócić błąd, czy kontynuować mimo błędu wysyłki SMS.
        }
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    logger.error("[PATCH] Błąd w endpointzie: %s", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
