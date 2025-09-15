import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verify } from "@/lib/orderLink";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  // jeśli używasz linków z podpisem, oczekuj tokenu ?t=
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  if (!verify(id, t)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sel =
    "id,status,eta,selected_option,total_price,created_at,client_delivery_time,payment_status,payment_method";
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(sel)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    status: data.status,
    eta: data.eta,
    option: data.selected_option,
    total: data.total_price,
    placedAt: data.created_at,
    clientRequestedTime: data.client_delivery_time,
    payment_status: data.payment_status,
    payment_method: data.payment_method,
  });
}
