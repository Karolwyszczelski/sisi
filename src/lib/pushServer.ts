/**
 * src/lib/pushServer.ts
 * Serwerowa wysyłka Web Push (VAPID) + automatyczne czyszczenie nieaktywnych subów (410/404).
 *
 * Wymaga env:
 * - NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: { action: string; title: string; icon?: string }[];
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

let webpushConfigured = false;
async function getWebPush() {
  const mod = await import("web-push");
// CJS/ESM: w zależności od bundlera bywa default albo namespace
const webpush = (mod && (mod.default ?? mod)) as any; // CJS -> default
  if (!webpushConfigured) {
    webpush.setVapidDetails(
      "mailto:admin@sisiciechanow.pl",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    webpushConfigured = true;
  }
  return webpush;
}

export async function sendPushToAll(payload: PushPayload) {
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .limit(1000);

  if (error) throw error;

  const notif = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
    actions: payload.actions,
  });

  const webpush = await getWebPush();

  const results = await Promise.allSettled(
    (subs ?? []).map((s: any) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, notif)
    )
  );

  const toRemove: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const code = (r as any).reason?.statusCode;
      if (code === 410 || code === 404) toRemove.push((subs ?? [])[i]?.endpoint);
    }
  });

  if (toRemove.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", toRemove);
  }

  return {
    attempted: (subs ?? []).length,
    removed: toRemove.length,
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function sendNewOrderPush(input: { orderId: string; totalPln?: number; selectedOption?: string }) {
  const shortId = input.orderId?.toString().slice(-6) || input.orderId;
  const option = input.selectedOption === "delivery" ? "Dostawa"
    : input.selectedOption === "takeaway" ? "Na wynos"
    : input.selectedOption === "local" ? "Na miejscu"
    : (input.selectedOption || "Zamówienie");

  const total = typeof input.totalPln === "number"
    ? `${input.totalPln.toFixed(2).replace(".", ",")} zł`
    : "";

  return sendPushToAll({
    title: "Nowe zamówienie",
    body: `#${shortId} • ${option}${total ? " • " + total : ""}`,
    url: "/admin/pickup-order",
    tag: "sisi-new-order",
  });
}
