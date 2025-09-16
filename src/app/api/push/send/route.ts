import { NextResponse } from "next/server";
import webpush from "web-push";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { cookies } from "next/headers";

webpush.setVapidDetails(
  "mailto:admin@sisiciechanow.pl",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: subs } = await supabase.from("push_subscriptions").select("*").limit(500);

  const notif = JSON.stringify({
    title: payload.title || "Nowe zamówienie",
    body: payload.body || "Kliknij, aby zobaczyć szczegóły.",
    url: payload.url || "/admin/current-orders",
  });

  const results = await Promise.allSettled(
    (subs || []).map((s: any) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, notif))
  );

  // opcjonalnie usuń nieaktywne endpointy
  // ...

  return NextResponse.json({ sent: results.length });
}
