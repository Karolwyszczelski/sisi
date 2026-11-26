import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import { burgerMonthPrice } from "@/lib/burgerMonth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const price = burgerMonthPrice(body.price);
    if (typeof body.name !== "string" || !body.name.trim() || price === null ||
        typeof body.description !== "string" || typeof body.image_url !== "string") {
      return NextResponse.json({ error: "Podaj nazwę edycji i poprawną cenę większą od zera." }, { status: 400 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    // A single database transaction: either both records change or neither does.
    const { data, error } = await supabase.rpc("save_burger_month", {
      p_name: body.name.trim(), p_description: body.description.trim(),
      p_price: price, p_image_url: body.image_url.trim() || null,
    });
    if (error) {
      console.error("[burger-month] Save failed:", error);
      return NextResponse.json({ error: "Nie udało się zapisać burgera miesiąca. Żadne zmiany nie zostały zatwierdzone." }, { status: 500 });
    }
    return NextResponse.json({ updated_at: data });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane lub błąd zapisu." }, { status: 400 });
  }
}
