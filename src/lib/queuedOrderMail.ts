import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOrderContract } from "./orderContract";
import { trackingUrl } from "./orderLink";
import { p24Site } from "./p24QueueGateway";

type MailBody = { from: string; to: string; subject: string; text: string };
type Snapshot = Parameters<typeof buildOrderContract>[0] & {
  contact_email?: string;
  email?: string;
  user_id?: string;
  user?: string;
  delivery_time?: string;
  client_delivery_time?: string;
  checkout_price_grosze?: { products: number; packaging: number; delivery: number; discount: number; deposit: number };
};
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

export async function prepareOrderMail(db: SupabaseClient, event: string, order: Snapshot): Promise<MailBody | null> {
  let to = order.contact_email || order.email;
  const userId = order.user_id || order.user;
  if (!to && userId) {
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) throw new Error("mail_recipient_lookup");
    to = data.user?.email;
  }
  if (!to) return null;

  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || "SISI <noreply@sisiciechanow.pl>";
  const when = order.delivery_time ?? order.client_delivery_time;
  const time = when && Number.isFinite(Date.parse(when))
    ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(when))
    : when === "asap" ? "Jak najszybciej" : null;

  if (event === "accepted") {
    const packaging_total = order.checkout_price_grosze
      ? order.checkout_price_grosze.packaging / 100 : order.legal_accept && "packaging_total" in order.legal_accept
        ? Number(order.legal_accept.packaging_total) : undefined;
    return { from, to, ...buildOrderContract({ ...order, packaging_total }, time) };
  }

  const headlines: Record<string, string> = {
    received: order.payment_method === "Online"
      ? "Otrzymaliśmy zamówienie. Płatność online może jeszcze oczekiwać na potwierdzenie."
      : "Otrzymaliśmy zamówienie.",
    completed: "Zamówienie zostało zrealizowane.",
    cancelled: "Zamówienie zostało anulowane.",
    time_changed: "Zaktualizowaliśmy czas realizacji.",
  };
  const headline = headlines[event];
  if (!headline) throw new Error("unknown_mail_event");
  const details = [headline, `Numer zamówienia: ${order.id}`];

  if (event === "received") {
    details.push("Potwierdzenie zawarcia umowy wyślemy po przyjęciu zamówienia przez obsługę.");
    const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
    if (Array.isArray(items)) for (const item of items) {
      details.push(`• ${item.name} × ${item.quantity} · ${money.format(Number(item.price))}/szt.${Array.isArray(item.addons) && item.addons.length ? ` (${item.addons.join(", ")})` : ""}`);
    }
    const price = order.checkout_price_grosze;
    if (price) details.push(
      `Produkty i dodatki: ${money.format(price.products / 100)}`,
      `Opakowania: ${money.format(price.packaging / 100)}`,
      `Dostawa: ${money.format(price.delivery / 100)}`,
      `Kaucja zwrotna: ${money.format(price.deposit / 100)}`,
      `Rabat: ${money.format(price.discount / 100)}`,
    );
    details.push(`Łączna kwota: ${money.format(Number(order.total_price))}`, `Płatność: ${order.payment_method ?? "—"}`);
    if (order.legal_accept?.terms_version) details.push(`Regulamin: ${order.legal_accept.terms_version} (${process.env.TERMS_URL ?? p24Site() + "/regulamin"})`);
  }
  if (time && (event === "received" || event === "time_changed")) details.push(`Czas realizacji: ${time}`);
  details.push(`Status zamówienia: ${trackingUrl(p24Site(), String(order.id))}`);
  return { from, to, subject: `SISI • Zamówienie #${order.id} · ${headline}`, text: details.join("\n") };
}

export async function sendQueuedOrderMail(key: string, body: MailBody) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("resend_config");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ ...body, to: [body.to] }), redirect: "error", signal: AbortSignal.timeout(7000),
  });
  if (response.ok) return "sent";
  const error = await response.json().catch(() => null);
  if (response.status === 429 || response.status >= 500 || error?.name === "concurrent_idempotent_requests") return "retry";
  return "review";
}
