import { kickOrderJobs } from "@/lib/kickOrderJobs";
// src/app/api/orders/[orderId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/serverAuth";
import { changeOrder, orderChangeError, orderIdSchema, orderServiceClient, staffOrderStatus } from "@/lib/orderLifecycle";

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

  if (data.stateChanged) kickOrderJobs(`mail:${orderId}:${data.order.status}`);
  return NextResponse.json(data.order);
}
