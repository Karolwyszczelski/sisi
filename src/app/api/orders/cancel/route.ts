import { kickOrderJobs } from "@/lib/kickOrderJobs";
import { NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/serverAuth";
import { changeOrder, orderChangeError, orderIdSchema, orderServiceClient } from "@/lib/orderLifecycle";

export async function POST(request: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const id = orderIdSchema.safeParse(body?.orderId);
  if (!id.success) return NextResponse.json({ error: "Niepoprawny identyfikator zamówienia." }, { status: 400 });

  const { data, error } = await changeOrder(orderServiceClient(), id.data, { status: "cancelled" }, session.user.id);
  const failure = orderChangeError(error, data?.outcome === "ok");
  if (!failure && data.stateChanged) kickOrderJobs(`mail:${id.data}:cancelled`);
  return failure ?? NextResponse.json({ success: true, data: data?.order });
}
