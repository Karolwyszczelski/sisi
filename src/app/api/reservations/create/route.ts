// src/app/api/reservations/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const SLOT_DURATION_MIN = 90;
const START_HOUR = 11;
const START_MIN = 30;
const END_HOUR = 22;
const MAX_PER_SLOT = 5;

function hoursClosed() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const before = h < 11 || (h === 11 && m < 30);
  const after  = h > 21 || (h === 21 && m > 45);
  return before || after;
}

export async function POST(req: Request) {
  try {
    if (hoursClosed()) {
      return NextResponse.json({ error: "Rezerwacje przyjmujemy 11:30–21:45." }, { status: 400 });
    }

    const body = await req.json();
    const day: string = body.date;              // "yyyy-MM-dd"
    const time: string = body.time;             // "HH:mm"
    const guests: number = Number(body.guests || 1);
    const name: string = (body.name || "").trim();
    const phone: string = (body.phone || "").trim();
    const notes: string = String(body.note || "");

    if (!day || !time || !name || !phone) {
      return NextResponse.json({ error: "Brak wymaganych danych." }, { status: 400 });
    }

    // limit miejsc w slocie
    const { count, error: cntErr } = await supabaseAdmin
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("reservation_date", day)
      .eq("reservation_time", time);

    if (cntErr) {
      return NextResponse.json({ error: "Błąd sprawdzania dostępności." }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_PER_SLOT) {
      return NextResponse.json({ error: "Wybrana godzina jest pełna." }, { status: 409 });
    }

    const { error } = await supabaseAdmin.from("reservations").insert([{
      reservation_date: day,
      reservation_time: time,
      number_of_guests: guests,
      customer_name: name,
      customer_phone: phone,
      notes,
      status: "pending",
    }]);

    if (error) {
      return NextResponse.json({ error: "Nie udało się zapisać." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Błąd serwera." }, { status: 500 });
  }
}
