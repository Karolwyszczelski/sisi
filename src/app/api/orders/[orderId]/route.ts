// src/app/api/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import { sendSms } from "@/lib/sms";
import type { Database } from "@/types/supabase";

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (d.length === 9) return "+48" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (!String(phone).startsWith("+") && d.length > 9) return "+" + d;
  return String(phone);
}

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = params.orderId;

  // Obsługa kompatybilnych nazw pól czasu
  const employeeTime: string | undefined =
    body.deliveryTime ?? body.employee_delivery_time;
  const clientTime: string | undefined =
    body.client_delivery_time ?? body.delivery_time;

  // Mapa aktualizacji pod kolumny w tabeli `orders`
  const updateData: Record<string, any> = {};
  if (body.status) updateData.status = body.status;

  if (employeeTime) updateData.deliveryTime = employeeTime; // czas ustawiany przez personel
  if (clientTime) updateData.client_delivery_time = clientTime; // czas od klienta

  if (body.items !== undefined) {
    updateData.items =
      typeof body.items === "string" ? body.items : JSON.stringify(body.items);
  }
  if (body.selected_option) updateData.selected_option = body.selected_option;
  if (body.payment_method) updateData.payment_method = body.payment_method;
  if (body.total_price !== undefined) updateData.total_price = body.total_price;

  if (body.address) updateData.address = body.address;
  if (body.street) updateData.street = body.street;
  if (body.postal_code) updateData.postal_code = body.postal_code;
  if (body.city) updateData.city = body.city;
  if (body.flat_number) updateData.flat_number = body.flat_number;

  if (body.phone) updateData.phone = body.phone;
  if (body.contact_email) updateData.contact_email = body.contact_email;

  // zgodnie ze schematem: w orders trzymamy `name`
  if (body.name) updateData.name = body.name;
  if (body.customer_name) updateData.name = body.customer_name;

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("[PATCH /orders/:id] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Order not found after update" },
      { status: 404 }
    );
  }

  // SMS – statusy i zmiana czasu po akceptacji
  const updated = data as any;
  const when: string | null =
    updated.deliveryTime ?? updated.client_delivery_time ?? null;

  const onlyTimeUpdate =
    !!employeeTime &&
    updated.status === "accepted" &&
    body.status !== "accepted";

  let smsBody = "";
  if (onlyTimeUpdate) {
    const t = when
      ? new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;
    smsBody = t
      ? `⏰ Aktualizacja: zamówienie ${orderId} będzie gotowe ok. ${t}.`
      : `⏰ Zaktualizowano czas dla zamówienia ${orderId}.`;
  } else {
    switch (updated.status) {
      case "accepted": {
        const t = when
          ? new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null;
        smsBody = t
          ? `👍 Zamówienie ${orderId} przyjęte. Odbiór ok. ${t}.`
          : `👍 Zamówienie ${orderId} przyjęte.`;
        break;
      }
      case "completed":
        smsBody = `✅ Zamówienie ${orderId} zrealizowane.`;
        break;
      case "cancelled":
        smsBody = `❌ Zamówienie ${orderId} anulowane.`;
        break;
      default:
        smsBody = "";
    }
  }

  const shouldSms =
    !!updated.phone &&
    (["accepted", "completed", "cancelled"].includes(body.status) ||
      onlyTimeUpdate);

  if (shouldSms && smsBody) {
    const to = normalizePhone(updated.phone);
    if (to) {
      try {
        await sendSms(to, smsBody);
      } catch (e) {
        console.error("[PATCH /orders/:id] SMS error:", e);
      }
    }
  }

  return NextResponse.json(updated);
}
