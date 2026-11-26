import { buildOrderContract } from "@/lib/orderContract";
// src/app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/serverAuth";
import { getTransport } from "@/lib/mailer";
import { trackingUrl } from "@/lib/orderLink";
import { changeOrder, orderChangeError, orderIdSchema, orderServiceClient, staffOrderStatus } from "@/lib/orderLifecycle";

/* ====== Wersje/Linki regulaminów (dopisek w mailach) ====== */
const TERMS_VERSION = process.env.TERMS_VERSION || "2025-01";
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || "2025-01";
const TERMS_URL = process.env.TERMS_URL || "https://www.sisiciechanow.pl/regulamin";
const PRIVACY_URL = process.env.PRIVACY_URL || "https://www.sisiciechanow.pl/polityka-prywatnosci";

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
  v === "delivery" ? "DOSTAWA" : v === "takeaway" ? "ODBIÓR OSOBISTY" : "NA MIEJSCU";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = orderIdSchema.safeParse((await params).orderId);
  if (!id.success || !body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Niepoprawna zmiana zamówienia." }, { status: 400 });
  }
  const { data: orderId } = id;
  const status = staffOrderStatus.optional().safeParse(body.status);
  if (!status.success || body.payment_status !== undefined ||
      (body.payment_method !== undefined && !["Gotówka", "Terminal"].includes(body.payment_method))) {
    return NextResponse.json({ error: "Nie można ręcznie ustawić tego stanu płatności lub zamówienia." }, { status: 400 });
  }

  const employeeTime = body.delivery_time ?? body.employee_delivery_time;
  const clientTime = body.client_delivery_time;

  const updateData: Record<string, any> = {};
  if (status.data) updateData.status = status.data;
if (employeeTime) updateData.delivery_time = employeeTime;
if (clientTime) updateData.client_delivery_time = clientTime;
  if (body.items !== undefined) updateData.items = typeof body.items === "string" ? body.items : JSON.stringify(body.items);
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
  if (body.name) updateData.name = body.name;
  if (body.customer_name) updateData.name = body.customer_name;
  if (body.promo_code !== undefined) updateData.promo_code = body.promo_code;
  if (body.discount_amount !== undefined) updateData.discount_amount = body.discount_amount;

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "Brak zmian zamówienia." }, { status: 400 });
  }
  const admin = orderServiceClient();
  const { data, error } = await changeOrder(admin, orderId, updateData, session.user.id);
  const failure = orderChangeError(error, data?.outcome === "ok");
  if (failure) return failure;

  const updated = data.order;
  if (!data.stateChanged && !data.timeChanged) return NextResponse.json(updated);
  const when = updated.delivery_time ?? updated.client_delivery_time ?? null;
  const onlyTimeUpdate = data.timeChanged && !data.stateChanged && updated.status === "accepted";

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
      }

      const la = (updated.legal_accept ?? {}) as any;
      const termsV = la.terms_version || TERMS_VERSION;
      const privV = la.privacy_version || PRIVACY_VERSION;

      if (data.stateChanged && updated.status === "accepted") {
        const contract = buildOrderContract({ ...updated, packaging_total: la.packaging_total }, timeStr);
        await tr.sendMail({ from: EMAIL_FROM, to: toEmail, ...contract });
      } else if (headline) {
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
    console.error("[orders.patch] Customer email failed");
  }

  return NextResponse.json(updated);
}
