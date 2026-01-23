// src/app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import { getTransport } from "@/lib/mailer";
import { trackingUrl } from "@/lib/orderLink";
import type { Database } from "@/types/supabase";

/* ====== Wersje/Linki regulaminów (dopisek w mailach) ====== */
const TERMS_VERSION = process.env.TERMS_VERSION || "2025-01";
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || "2025-01";
const TERMS_URL = process.env.TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL = process.env.PRIVACY_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";

/** Admin Supabase (do pobrania e-maila użytkownika, jeśli brak w zamówieniu) */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Bezpieczny nadawca dla Resend/SMTP (usuwa przypadkowe cudzysłowy/spacje) */
const EMAIL_FROM =
  (process.env.EMAIL_FROM || process.env.RESEND_FROM || "SISI Burger <no-reply@sisiciechanow.pl>")
    .replace(/^['"\s]+|['"\s]+$/g, "");

/** Wymuszona strefa czasowa – żeby maile miały lokalną godzinę */
const APP_TZ = process.env.APP_TIMEZONE || "Europe/Warsaw";
const timeFmt = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TZ,
});
const fmtTime = (iso?: string | null) =>
  iso && !Number.isNaN(Date.parse(iso)) ? timeFmt.format(new Date(iso)) : null;

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = params.orderId;

  // Panel pracownika: delivery_time = deadline realizacji (ISO), client_delivery_time = deklaracja klienta
const employeeTime: string | undefined = body.delivery_time ?? body.employee_delivery_time;
const clientTime: string | undefined = body.client_delivery_time;


  const updateData: Record<string, any> = {};
  if (body.status) updateData.status = body.status;
if (employeeTime) updateData.delivery_time = employeeTime;
if (clientTime) updateData.client_delivery_time = clientTime;
  if (body.items !== undefined) updateData.items = typeof body.items === "string" ? body.items : JSON.stringify(body.items);
  if (body.selected_option) updateData.selected_option = body.selected_option;
  if (body.payment_method) updateData.payment_method = body.payment_method;
  if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
  if (body.total_price !== undefined) updateData.total_price = body.total_price;
  if (body.address) updateData.address = body.address;
  if (body.street) updateData.street = body.street;
  if (body.postal_code) updateData.postal_code = body.postal_code;
  if (body.city) updateData.city = body.city;
  if (body.flat_number) updateData.flat_number = body.flat_number;
  if (body.phone) updateData.phone = body.phone;
  if (body.contact_email) updateData.contact_email = body.contact_email;
  if (body.name) updateData.name = body.name;
  if (body.customer_name) updateData.name = body.customer_name;
  if (body.promo_code !== undefined) updateData.promo_code = body.promo_code;
  if (body.discount_amount !== undefined) updateData.discount_amount = body.discount_amount;
  if (body.legal_accept && typeof body.legal_accept === "object") updateData.legal_accept = body.legal_accept;

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("[orders.patch] supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Order not found after update" }, { status: 404 });

  const updated = data as any;
const when: string | null = updated.delivery_time ?? updated.client_delivery_time ?? null;

  // Przydatne w sekcji e-maili
  const onlyTimeUpdate = !!employeeTime && updated.status === "accepted" && body.status !== "accepted";

  // ===== E-MAIL =====
  try {
    // 1) weź e-mail z zamówienia…
    let toEmail: string | undefined =
      updated.contact_email || updated.email || undefined;

    // 2) …albo dociągnij z auth (admin) po user_id
    const userId: string | undefined =
      updated.user_id || updated.user || updated.userId || undefined;

    if (!toEmail && userId) {
      try {
        const { data: userRes } = await admin.auth.admin.getUserById(userId);
        toEmail = userRes?.user?.email || toEmail;
      } catch (e) {
        console.warn("[orders.patch] getUserById failed:", e);
      }
    }

    if (toEmail) {
      const tr = getTransport();
      const origin =
        request.headers.get("origin") ||
        process.env.APP_BASE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "";
      const trackUrl = origin ? trackingUrl(origin, String(orderId)) : null;

      const timeStr = fmtTime(when);
      const optionTxt = optLabel(updated.selected_option);
      const changingPaymentStatus = body.payment_status !== undefined;

      let subject = `SISI • Zamówienie #${orderId}`;
      let headline = "";
      let extra = "";

      if (onlyTimeUpdate) {
        subject += " — zaktualizowany czas";
        headline = "Zaktualizowaliśmy czas realizacji";
        extra = timeStr ? `Nowy czas: <b>${timeStr}</b>` : "";
      } else if (["accepted", "completed", "cancelled"].includes(updated.status)) {
        switch (updated.status) {
          case "accepted":
            subject += " przyjęte";
            headline = "Przyjęliśmy Twoje zamówienie";
            extra = timeStr ? `Szacowany czas: <b>${timeStr}</b>` : "";
            break;
          case "completed":
            subject += " zrealizowane";
            headline = "Zamówienie zrealizowane";
            break;
          case "cancelled":
            subject += " anulowane";
            headline = "Zamówienie zostało anulowane";
            break;
        }
      } else if (changingPaymentStatus && body.payment_status === "paid" && updated.payment_method === "Online") {
        subject += " — płatność potwierdzona";
        headline = "Otrzymaliśmy Twoją płatność online";
        extra = "Status płatności: <b>opłacone</b>";
      }

      const la = (updated.legal_accept ?? {}) as any;
      const termsV = la.terms_version || TERMS_VERSION;
      const privV = la.privacy_version || PRIVACY_VERSION;

      if (headline) {
        await tr.sendMail({
          from: EMAIL_FROM,
          to: toEmail,
          subject,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111">
              <h2 style="margin:0 0 8px">${headline}</h2>
              <p style="margin:0 0 6px">Numer: <b>#${orderId}</b></p>
              <p style="margin:0 0 6px">Opcja: <b>${optionTxt}</b></p>
              ${extra ? `<p style="margin:0 0 10px">${extra}</p>` : ""}
              ${trackUrl ? `<p style="margin:14px 0">
                <a href="${trackUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">
                  Sprawdź status zamówienia
                </a>
              </p>` : ""}
              <hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
              <p style="font-size:12px;color:#555;margin:0">
                Akceptacja: Regulamin v${termsV} (<a href="${TERMS_URL}">link</a>),
                Polityka prywatności v${privV} (<a href="${PRIVACY_URL}">link</a>)
              </p>
            </div>
          `,
        });
      }
    }
  } catch (e) {
    console.error("[orders.patch] email error:", e);
  }

  return NextResponse.json(updated);
}
