export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { orderServiceClient } from "@/lib/orderLifecycle";
import { processOrderJob } from "@/lib/orderQueue";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = orderServiceClient();
    const deadline = Date.now() + 25000;
    let processed = 0;
    while (processed < 12 && Date.now() < deadline && await processOrderJob(db)) processed += 1;
    const { count, error } = await db.from("order_jobs").select("id", { count: "exact", head: true }).eq("state", "review");
    if (error) throw error;
    return NextResponse.json({ processed, needsReview: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Order queue unavailable" }, { status: 503 });
  }
}
