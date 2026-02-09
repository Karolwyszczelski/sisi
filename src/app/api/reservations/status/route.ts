// src/app/api/reservations/status/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/mailer";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

let _supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = getSupabaseAdmin();
    return (_supabaseAdmin as any)[prop];
  },
});

const RESTAURANT_NAME = "SISI Ciechanów";
const RESTAURANT_ADDRESS = "ul. Sierakowskiego 1, 06-400 Ciechanów";
const RESTAURANT_PHONE = "+48 23 672 32 32";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pl-PL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function generateConfirmationEmail(reservation: {
  customer_name: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  number_of_guests?: number;
}) {
  const guests = reservation.party_size || reservation.number_of_guests || 1;
  const time = reservation.reservation_time?.slice(0, 5) || "";

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✓ Rezerwacja potwierdzona!</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 18px; color: #1f2937; margin: 0 0 30px 0;">
        Witaj <strong>${reservation.customer_name}</strong>!
      </p>
      
      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
        Z przyjemnością potwierdzamy Twoją rezerwację w restauracji <strong>${RESTAURANT_NAME}</strong>.
      </p>
      
      <!-- Reservation details box -->
      <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
        <h2 style="color: #059669; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📋 Szczegóły rezerwacji</h2>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Data:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; text-align: right;">${formatDate(reservation.reservation_date)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Godzina:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; text-align: right;">${time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Liczba osób:</td>
            <td style="padding: 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; text-align: right;">${guests}</td>
          </tr>
        </table>
      </div>
      
      <!-- Restaurant info -->
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 20px; margin: 0 0 30px 0;">
        <p style="margin: 0 0 10px 0; color: #1f2937; font-weight: 600;">📍 ${RESTAURANT_NAME}</p>
        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">${RESTAURANT_ADDRESS}</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Tel: ${RESTAURANT_PHONE}</p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0;">
        W razie pytań lub konieczności zmiany rezerwacji, prosimy o kontakt telefoniczny.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #1f2937; padding: 25px 30px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} ${RESTAURANT_NAME}. Dziękujemy za wybór naszej restauracji!
      </p>
    </div>
  </div>
</body>
</html>`;
}

function generateRejectionEmail(reservation: {
  customer_name: string;
  reservation_date: string;
  reservation_time: string;
}, reason?: string) {
  const time = reservation.reservation_time?.slice(0, 5) || "";

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Rezerwacja odrzucona</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 18px; color: #1f2937; margin: 0 0 30px 0;">
        Witaj <strong>${reservation.customer_name}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
        Z przykrością informujemy, że Twoja rezerwacja na dzień <strong>${formatDate(reservation.reservation_date)}</strong> o godzinie <strong>${time}</strong> nie może zostać zrealizowana.
      </p>
      
      ${reason ? `
      <!-- Reason box -->
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 30px 0;">
        <p style="margin: 0 0 8px 0; color: #991b1b; font-weight: 600; font-size: 14px;">Powód:</p>
        <p style="margin: 0; color: #1f2937; font-size: 16px; line-height: 1.6;">${reason}</p>
      </div>
      ` : ''}
      
      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
        Zachęcamy do dokonania rezerwacji na inny termin lub kontaktu telefonicznego.
      </p>
      
      <!-- Restaurant info -->
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 20px; margin: 0 0 30px 0;">
        <p style="margin: 0 0 10px 0; color: #1f2937; font-weight: 600;">📍 ${RESTAURANT_NAME}</p>
        <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">${RESTAURANT_ADDRESS}</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Tel: ${RESTAURANT_PHONE}</p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0;">
        Przepraszamy za wszelkie niedogodności.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #1f2937; padding: 25px 30px; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} ${RESTAURANT_NAME}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, reason, customMessage } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Brak wymaganych danych." }, { status: 400 });
    }

    if (!["confirmed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Nieprawidłowy status." }, { status: 400 });
    }

    // Pobierz rezerwację
    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      return NextResponse.json({ error: "Nie znaleziono rezerwacji." }, { status: 404 });
    }

    // Zaktualizuj status
    const updateData: Record<string, unknown> = { status };
    if (status === "cancelled") {
      updateData.cancelled_at = new Date().toISOString();
      if (reason) updateData.cancellation_reason = reason;
    }

    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Błąd aktualizacji." }, { status: 500 });
    }

    // Wyślij e-mail jeśli klient podał adres
    const customerEmail = reservation.customer_email;
    if (customerEmail) {
      try {
        const emailContent = status === "confirmed"
          ? generateConfirmationEmail(reservation)
          : generateRejectionEmail(reservation, reason || customMessage);

        await sendEmail({
          to: customerEmail,
          subject: status === "confirmed"
            ? `✓ Potwierdzenie rezerwacji - ${RESTAURANT_NAME}`
            : `Rezerwacja odrzucona - ${RESTAURANT_NAME}`,
          html: emailContent,
        });

        console.log(`[reservations] Email sent to ${customerEmail} (${status})`);
      } catch (emailError) {
        console.error("[reservations] Email error:", emailError);
        // Nie przerywamy - rezerwacja została zaktualizowana
      }
    }

    return NextResponse.json({ 
      ok: true, 
      emailSent: !!customerEmail 
    });
  } catch (err) {
    console.error("[reservations/status] Error:", err);
    return NextResponse.json({ error: "Błąd serwera." }, { status: 500 });
  }
}
