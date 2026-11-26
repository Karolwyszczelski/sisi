import { z } from "zod";
import { fromGrosze, toGrosze } from "./orderPricing";
import { parsePosItemOptions, type PosItemOptions } from "./posOrderItems";

const money = z.number().int().nonnegative();
const quantity = z.number().int().positive();
const productId = z.union([z.string().min(1), z.number().int().positive()]);
const savedLine = z.object({
  productId,
  quantity,
  unitPrice: money,
  addons: z.array(z.object({ name: z.string().min(1), unitPrice: money, category: z.string().nullish() })),
  extraMeatCount: money,
  extraMeatUnitPrice: money,
  products: money,
  packaging: money,
  deposit: money,
});
const savedQuote = z.object({
  products: money, packaging: money, delivery: money, deposit: money, discount: money, total: money,
  lines: z.array(money).nonempty(),
  lineDetails: z.array(savedLine).nonempty(),
});
const savedItems = z.array(z.object({
  product_id: productId.optional(),
  name: z.string().trim().min(1),
  quantity,
}).passthrough()).nonempty();

type OrderForPricing = { items: unknown; total_price?: number | string | null; checkout_price_grosze?: unknown };
export type SavedPricingLine = z.infer<typeof savedLine>;

export class SavedPricingError extends Error {
  constructor(readonly code: "missing_quote" | "invalid_quote") {
    super(code);
  }
}

export function readSavedOrderPricing(order: OrderForPricing) {
  if (order.checkout_price_grosze == null) throw new SavedPricingError("missing_quote");

  const parsed = savedQuote.safeParse(order.checkout_price_grosze);
  if (!parsed.success) throw new SavedPricingError("invalid_quote");
  const quote = parsed.data;
  let rawItems: unknown;
  try {
    rawItems = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  } catch {
    throw new SavedPricingError("invalid_quote");
  }
  const items = savedItems.safeParse(rawItems);
  if (!items.success || items.data.length !== quote.lineDetails.length || quote.lines.length !== quote.lineDetails.length) {
    throw new SavedPricingError("invalid_quote");
  }

  const pricedItems = quote.lineDetails.map((price, index) => {
    const item = items.data[index];
    const options = item as PosItemOptions & { _src?: { product_id?: string | number } };
    const id = item.product_id ?? options._src?.product_id;
    const unitProducts = price.unitPrice + price.extraMeatCount * price.extraMeatUnitPrice
      + price.addons.reduce((sum, addon) => sum + addon.unitPrice, 0);
    if (String(id) !== String(price.productId) || item.quantity !== price.quantity ||
        unitProducts * price.quantity !== price.products || quote.lines[index] !== price.products ||
        price.packaging % price.quantity !== 0 || price.deposit % price.quantity !== 0) {
      throw new SavedPricingError("invalid_quote");
    }
    try {
      return { name: item.name, note: parsePosItemOptions(options, false).note, price };
    } catch {
      throw new SavedPricingError("invalid_quote");
    }
  });

  const subtotal = quote.products + quote.packaging + quote.delivery;
  if ((["products", "packaging", "deposit"] as const).some((field) =>
    quote[field] !== quote.lineDetails.reduce((sum, line) => sum + line[field], 0)) ||
    !Number.isSafeInteger(subtotal + quote.deposit) || quote.discount > subtotal ||
    quote.total !== subtotal - quote.discount + quote.deposit ||
    order.total_price == null || toGrosze(Number(order.total_price)) !== quote.total) {
    throw new SavedPricingError("invalid_quote");
  }

  return { quote, pricedItems };
}

export type SavedOrderPricing = ReturnType<typeof readSavedOrderPricing>;

const formatPln = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
export const formatGrosze = (amount: number) => formatPln.format(fromGrosze(amount));

export function describeSavedOrderPricing({ quote, pricedItems }: SavedOrderPricing) {
  return [
    ...pricedItems.map(({ name, note, price }) => [
      `• ${name} × ${price.quantity} · ${formatGrosze(price.unitPrice)}/szt. · pozycja ${formatGrosze(price.products)}`,
      ...price.addons.map((addon) => `  ${addon.name}: ${formatGrosze(addon.unitPrice)}/szt. dania`),
      ...(price.extraMeatCount ? [`  Dodatkowe mięso × ${price.extraMeatCount}/szt. dania · ${formatGrosze(price.extraMeatUnitPrice)}/porcję`] : []),
      ...(note ? [`  ${note}`] : []),
    ].join("\n")),
    "",
    `Produkty i dodatki: ${formatGrosze(quote.products)}`,
    `Opakowania: ${formatGrosze(quote.packaging)}`,
    `Dostawa: ${formatGrosze(quote.delivery)}`,
    `Kaucja zwrotna: ${formatGrosze(quote.deposit)}`,
    `Rabat: ${formatGrosze(quote.discount)}`,
    `Łączna kwota brutto: ${formatGrosze(quote.total)}`,
  ];
}
