import { NextResponse } from "next/server";
import { changeOrder, orderChangeError, orderIdSchema, orderServiceClient, staffOrderStatus } from "@/lib/orderLifecycle";

export async function POST(request: Request) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || request.headers.get("x-webhook-secret") !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = orderIdSchema.safeParse(body?.orderId ?? body?.sessionId ?? body?.id);
  const status = staffOrderStatus.optional().safeParse(body?.status);
  if (!id.success || !status.success || body?.total_price !== undefined || body?.products !== undefined) {
    return NextResponse.json({ error: "Niepoprawna zmiana zamówienia." }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (status.data) patch.status = status.data;
  if (typeof body.address === "string") patch.address = body.address;
  if (typeof body.phone === "string") patch.phone = body.phone;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Brak zmian." }, { status: 400 });

  const { data, error } = await changeOrder(orderServiceClient(), id.data, patch, null);
  return orderChangeError(error, data?.outcome === "ok") ?? NextResponse.json({ success: true });
}
