import { LEGAL } from "@/config/legal";
import { describeSavedOrderPricing, readSavedOrderPricing } from "./savedOrderPricing";

type ContractOrder = {
  id: string | number;
  items: unknown;
  checkout_price_grosze?: unknown;
  total_price: number | string;
  delivery_cost?: number | string | null;
  discount_amount?: number | string | null;
  packaging_total?: number | string | null;
  selected_option?: string;
  payment_method?: string;
  payment_status?: string;
  address?: string;
  street?: string;
  flat_number?: string;
  city?: string;
  postal_code?: string;
  legal_accept?: { terms_version?: string; terms_text?: string; deposit_total?: number };
};

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

export function describeOrderCharges(order: ContractOrder) {
  if (order.checkout_price_grosze != null) return describeSavedOrderPricing(readSavedOrderPricing(order));

  const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  if (!Array.isArray(items)) throw new Error("Missing contract order items");
  const lines = items.map((item) => {
    const options = Array.isArray(item.addons) ? [...item.addons] : [];
    const swaps = item._src?.options?.swaps;
    if (Array.isArray(swaps)) for (const swap of swaps) options.push(`Zamiana: ${swap.from} → ${swap.to}`);
    return `• ${item.name} × ${item.quantity} · ${money.format(Number(item.price))}/szt.${options.length ? `\n  ${options.join(", ")}` : ""}`;
  });
  return [
    ...lines,
    "",
    ...(order.packaging_total == null ? [] : [`Opakowania: ${money.format(Number(order.packaging_total))}`]),
    `Dostawa: ${money.format(Number(order.delivery_cost ?? 0))}`,
    ...(order.legal_accept?.deposit_total ? [`Kaucja zwrotna: ${money.format(order.legal_accept.deposit_total)}`] : []),
    `Rabat: ${money.format(Number(order.discount_amount ?? 0))}`,
    `Łączna kwota brutto: ${money.format(Number(order.total_price))}`,
  ];
}

export function buildOrderContract(order: ContractOrder, time?: string | null) {
  const terms = order.legal_accept?.terms_text;
  const fulfillment = order.selected_option === "delivery"
    ? ["Dostawa", order.street || order.address, order.flat_number, order.postal_code, order.city].filter(Boolean).join(", ")
    : `${order.selected_option === "takeaway" ? "Odbiór osobisty" : "Na miejscu"} · ${LEGAL.restaurantAddress}`;
  return {
    subject: `SISI • Potwierdzenie zawarcia umowy #${order.id}`,
    text: [
      `Przyjęliśmy zamówienie #${order.id}. Umowa została zawarta.`,
      `Sprzedawca: ${LEGAL.legalName}, NIP ${LEGAL.nip}, ${LEGAL.registeredAddress}`,
      `Kontakt i reklamacje: ${LEGAL.email}, ${LEGAL.phone}`,
      "",
      ...describeOrderCharges(order),
      `Płatność: ${order.payment_method ?? "—"} · ${order.payment_status === "paid" ? "opłacone" : "do zapłaty"}`,
      fulfillment,
      ...(time ? [`Szacowany czas realizacji: ${time}`] : []),
      "",
      terms ?? `Regulamin przy zamówieniu: ${order.legal_accept?.terms_version ?? "brak zapisanej wersji"}. Skontaktuj się z lokalem w sprawie kopii.`,
    ].join("\n"),
  };
}
