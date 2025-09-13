// src/app/api/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSessionAndRole } from "@/lib/serverAuth";
import { sendSms } from "@/lib/sms";
import { getTransport } from "@/lib/mailer";
import { trackingUrl } from "@/lib/orderLink";
import type { Database } from "@/types/supabase";

function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  if (d.length === 9) return "+48" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (!String(phone).startsWith("+") && d.length > 9) return "+" + d;
  return String(phone);
}
const optLabel = (v?: string) =>
  v === "delivery" ? "DOSTAWA" : v === "takeaway" ? "NA WYNOS" : "NA MIEJSCU";

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const orderId = params.orderId;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Pobierz stan przed aktualizacją (do porównań statusu/czasu)
  const { data: prev, error: prevErr } = await supabase
    .from("orders")
    .select(
      "id,status,deliveryTime,client_delivery_time,contact_email,name,total_price,selected_option"
    )
    .eq("id", orderId)
    .single();

  if (prevErr || !prev) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Obsługa aliasów pól czasu
  const employeeTime: string | undefined =
    body.deliveryTime ?? body.employee_delivery_time;
  const clientTime: string | undefined =
    body.client_delivery_time ?? body.delivery_time;

  // White-list aktualizacji
  const allowed = new Set([
    "status",
    "deliveryTime",
    "client_delivery_time",
    "selected_option",
    "payment_method",
    "total_price",
    "name",
    "customer_name",
    "address",
    "street",
    "postal_code",
    "city",
    "flat_number",
    "phone",
    "contact_email",
    "items",
  ]);
  const updateData: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.has(k)) continue;
    if (k === "items") {
      updateData.items = typeof v === "string" ? v : JSON.stringify(v);
    } else if (k === "customer_name") {
      updateData.name = v;
    } else {
      updateData[k] = v;
    }
  }
  if (employeeTime) updateData.deliveryTime = employeeTime;
  if (clientTime) updateData.client_delivery_time = clientTime;

  const { data: updated, error: updErr } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select("*")
    .single();

  if (updErr || !updated) {
    console.error("[PATCH /orders/:id] Supabase error:", updErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // ------- SMS -------
  const when: string | null =
    updated.deliveryTime ?? updated.client_delivery_time ?? null;

  const onlyTimeUpdate =
    !!employeeTime && prev.status === "accepted" && body.status !== "accepted";

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
    (["accepted", "completed", "cancelled"].includes(body.status) || onlyTimeUpdate);

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

  // ------- E-MAIL (Resend przez nodemailer transport) -------
  try {
    const becameAccepted = body.status === "accepted" && prev.status !== "accepted";
    const timeChanged =
      !!employeeTime && employeeTime !== (prev.deliveryTime ?? "");

    const email = (updated as any).contact_email || prev.contact_email;
    if (email && (becameAccepted || timeChanged)) {
      const tr = getTransport();
      const total =
        typeof updated.total_price === "number"
          ? updated.total_price.toFixed(2).replace(".", ",")
          : String(updated.total_price ?? "0");

      const origin = process.env.APP_BASE_URL || request.headers.get("origin") || "";
      const url = trackingUrl(origin, String(updated.id));
      const whenTxt = updated.deliveryTime
        ? new Date(updated.deliveryTime).toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "wkrótce";

      const subject = becameAccepted
        ? `SISI • Zamówienie #${updated.id} przyjęte`
        : `SISI • Aktualizacja czasu dla zamówienia #${updated.id}`;

      const html = `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 8px">${becameAccepted ? "Zamówienie przyjęte" : "Aktualizacja czasu"} #${updated.id}</h2>
          <p style="margin:0 0 8px">
            Opcja: <strong>${optLabel(updated.selected_option)}</strong><br/>
            Kwota: <strong>${total} zł</strong><br/>
            Planowany czas: <strong>${whenTxt}</strong>
          </p>
          <p style="margin:16px 0">
            <a href="${url}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">
              Sprawdź status zamówienia
            </a>
          </p>
          <p style="margin:8px 0;color:#555">Dziękujemy za zamówienie w SISI.</p>
        </div>
      `;

      await tr.sendMail({
        from: process.env.EMAIL_FROM!,
        to: email,
        subject,
        html,
      });
    }
  } catch (e) {
    console.error("[PATCH /orders/:id] email error:", e);
  }

  return NextResponse.json(updated);
}
