// src/app/api/orders/status/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verify } from "@/lib/orderLink";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // weryfikacja linku podpisanego (?t=)
    const url = new URL(req.url);
    const t = url.searchParams.get("t") || "";
    if (!verify(id, t)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // pobierz status + wszystkie możliwe pola z czasem
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id,status,selected_option,total_price,created_at,deliveryTime,delivery_time,client_delivery_time,eta,payment_status,payment_method"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Priorytet ETA: deliveryTime (ustawiony przez lokal) -> legacy delivery_time -> eta -> klient
    const eta =
      (data as any).deliveryTime ??
      (data as any).delivery_time ??
      (data as any).eta ??
      (data as any).client_delivery_time ??
      null;

    return NextResponse.json(
      {
        id: data.id,
        status: data.status,
        eta, // ISO string lub null
        option: data.selected_option,
        total: Number(data.total_price ?? 0),
        placedAt: data.created_at,
        clientRequestedTime: (data as any).client_delivery_time ?? null,
        payment_status: (data as any).payment_status ?? null,
        payment_method: (data as any).payment_method ?? null,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
