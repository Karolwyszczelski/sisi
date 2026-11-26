import { z } from "zod";
import { fulfillmentSchema } from "./orderAvailability";
import { inferDefaultMeat, resolveOrderMeat } from "./orderMeat";

export const checkoutSelectionSchema = z.object({
  selected_option: fulfillmentSchema,
  payment_method: z.enum(["Gotówka", "Terminal", "Online"]),
});

const quantity = z.union([z.number(), z.string().trim().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().min(1).max(99));

const addonNames = z.array(z.string().trim().min(1).max(120)).max(99);
const lineSchema = z.object({
  quantity: quantity.nullish(),
  qty: quantity.nullish(),
  note: z.string().max(500).nullish(),
  addons: addonNames.nullish(),
  options: z.object({
    addons: addonNames.nullish(),
    meatType: z.enum(["wołowina", "kurczak"]).nullish(),
    extraMeatCount: z.number().int().min(0).max(99).nullish(),
    swaps: z.array(z.never()).max(0).nullish(),
    note: z.string().max(500).nullish(),
  }).nullish(),
});

export type CheckoutAddon = { price: number; category: string | null };
type Product = Parameters<typeof inferDefaultMeat>[0];

export function validateCheckoutLine(raw: unknown, product: NonNullable<Product>, catalog: ReadonlyMap<string, CheckoutAddon>) {
  const parsed = lineSchema.safeParse(raw);
  if (!parsed.success) return { error: "Niepoprawna konfiguracja pozycji." } as const;

  const item = parsed.data;
  const options = item.options;
  const name = (product.name ?? "").toLowerCase();
  const category = (product.category ?? "").toLowerCase();
  const burger = category === "burger" || name.includes("burger");
  const fries = [name, category, product.subcategory?.toLowerCase() ?? ""].some((value) => value.includes("fryt")) || name.includes("fries");

  const addons = options?.addons ?? item.addons ?? [];
  for (const addonName of addons) {
    const addon = catalog.get(addonName.toLowerCase());
    const allowedForFries = fries && (
      addon?.category === "sos" || (addon?.category === "premium" && !name.includes("ser"))
    );
    if (!addon || (!burger && !allowedForFries)) {
      return { error: "Wybrany dodatek jest niedostępny dla tego produktu." } as const;
    }
  }

  const selected = options?.meatType;
  const defaultMeat = burger ? inferDefaultMeat(product) : null;
  const extraMeatCount = options?.extraMeatCount ?? 0;
  if ((selected && (!defaultMeat || (defaultMeat !== "wołowina" && selected !== defaultMeat))) ||
      (extraMeatCount > 0 && !defaultMeat)) {
    return { error: "Wybrana opcja mięsa jest niedostępna dla tego produktu." } as const;
  }

  return {
    quantity: item.quantity ?? item.qty ?? 1,
    options: {
      addons,
      meatType: defaultMeat ? resolveOrderMeat(product, selected) : null,
      extraMeatCount,
      note: options?.note ?? item.note,
    },
  } as const;
}
