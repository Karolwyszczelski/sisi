// src/app/api/push/send/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/serverAuth";
import { sendPushToAll } from "@/lib/pushServer";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));

  const { session, role } = await getSessionAndRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await sendPushToAll({
    title: payload.title || "Nowe zamówienie",
    body: payload.body || "Kliknij, aby zobaczyć szczegóły.",
    url: payload.url || "/admin/pickup-order",
  });

  return NextResponse.json(stats);
}
