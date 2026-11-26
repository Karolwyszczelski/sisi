import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchOrderToOperations } from "./orderOperations";

export const orderIdSchema = z.string().uuid();
export const staffOrderStatus = z.enum(["accepted", "completed", "cancelled"]);

export function orderServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase order configuration");
  return createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } });
}

export async function changeOrder(
  db: SupabaseClient,
  orderId: string,
  changes: Record<string, unknown>,
  actorId: string | null,
) {
  const { data, error } = await db.rpc("sisi_change_order", {
    order_id: orderId, changes, actor_id: actorId,
  });
  return { data, error };
}

export function orderChangeError(error: { code?: string } | null, found: boolean) {
  if (error?.code === "P0001") return NextResponse.json({
    error: "Stan zamówienia lub płatności nie pozwala na tę zmianę.",
  }, { status: 409 });
  if (error) return NextResponse.json({ error: "Nie udało się zapisać zamówienia." }, { status: 500 });
  if (!found) return NextResponse.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
  return null;
}

export async function confirmVerifiedP24(
  db: SupabaseClient,
  payment: { sessionId: string; gatewayOrderId: string; amountGrosze: number },
  appUrl: string,
) {
  const { data, error } = await db.rpc("sisi_confirm_p24_payment", {
    session_id: payment.sessionId, gateway_order_id: payment.gatewayOrderId, amount_grosze: payment.amountGrosze,
  });
  if (error) throw new Error("Could not record verified P24 payment");
  if (data.dispatch) {
    await dispatchOrderToOperations({
      orderId: String(data.orderId),
      totalPln: Number(data.total),
      selectedOption: data.selectedOption,
      appUrl,
      logPrefix: "[p24]",
    });
  }
  return data.outcome as "paid" | "refund_pending" | "already_paid" | "mismatch";
}
