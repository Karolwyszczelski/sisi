export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import { orderSettingsSchema, readOrderAvailability } from "@/lib/orderAvailability";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

const unavailable = () => NextResponse.json({ error: "Ustawienia zamówień są niedostępne." }, { status: 503 });
const patchSchema = orderSettingsSchema.partial().strict().refine((value) => Object.keys(value).length > 0);

export async function GET() {
  try {
    const availability = await readOrderAvailability(getSupabase());
    if (!availability) return unavailable();
    return NextResponse.json(availability.effective, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return unavailable();
  }
}

export async function PATCH(req: Request) {
  try {
    const { session, role } = await getSessionAndRole();
    if (!session) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
    if (role !== "admin") return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

    const settings = patchSchema.safeParse(await req.json().catch(() => null));
    if (!settings.success) {
      return NextResponse.json({ error: "Niepoprawne ustawienia zamówień." }, { status: 400 });
    }

    const supabase = getSupabase();
    const availability = await readOrderAvailability(supabase);
    if (!availability) return unavailable();
    const result = await supabase.rpc("sisi_update_order_availability", {
      settings_id: availability.id,
      changes: settings.data,
    });
    if (result.error) return unavailable();
    return NextResponse.json(result.data);
  } catch {
    return unavailable();
  }
}
