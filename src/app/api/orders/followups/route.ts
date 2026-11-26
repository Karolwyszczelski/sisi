import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAndRole } from "@/lib/serverAuth";
import { orderIdSchema, orderServiceClient } from "@/lib/orderLifecycle";

const identity = z.object({
  orderId: orderIdSchema,
  kind: z.enum(["refund_p24", "refund_offline", "cancel_pos"]),
});
const action = z.discriminatedUnion("action", [
  identity.extend({ action: z.literal("claim") }),
  identity.extend({ action: z.literal("release") }),
  identity.extend({ action: z.literal("resolve"), reference: z.string().trim().min(1).max(120) }),
]);

export async function GET() {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const { data, error } = await orderServiceClient().from("order_followups")
    .select("order_id,kind,amount_grosze,p24_order_id,created_at,claimed_by")
    .is("resolved_at", null).order("created_at").limit(50);

  if (error) return NextResponse.json({ error: "Nie udało się pobrać zadań." }, { status: 500 });
  return NextResponse.json((data ?? []).map(({ claimed_by, ...task }) => ({
    ...task,
    claim: !claimed_by ? "available" : claimed_by === session.user.id ? "mine" : "taken",
  })), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Niepoprawne dane zadania." }, { status: 400 });

  const task = parsed.data;
  const now = new Date().toISOString();
  const changes = task.action === "claim" ? { claimed_by: session.user.id, claimed_at: now }
    : task.action === "release" ? { claimed_by: null, claimed_at: null }
    : { resolved_at: now, resolution_reference: task.reference };

  const query = orderServiceClient().from("order_followups").update(changes)
    .eq("order_id", task.orderId).eq("kind", task.kind).is("resolved_at", null);
  const { data, error } = await (task.action === "claim" ? query.is("claimed_by", null)
    : query.eq("claimed_by", session.user.id)).select("order_id").maybeSingle();

  if (error && error.code !== "23505") return NextResponse.json({ error: "Zapis zadania nie powiódł się." }, { status: 500 });
  if (error || !data) return NextResponse.json({ error: "Stan zadania się zmienił lub ten numer potwierdzenia jest już użyty." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
