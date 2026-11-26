import { compactPosItems, type PosLine, type PosVariant } from "./posOrderItems";
import { fromGrosze, toGrosze } from "./orderPricing";
import type { SavedOrderPricing } from "./savedOrderPricing";

type Mappings = {
  product: (id: string, name: string) => number | undefined;
  addon: (name: string, category?: string | null) => number | undefined;
  extraMeat?: number;
  packaging?: number;
  delivery?: number;
  deposit?: number;
};

type GrossLine = PosLine & { grosze: number; refundableDeposit?: boolean };

export class PosMappingError extends Error {
  constructor(readonly missing: string[]) {
    super("Niepełne mapowanie zamówienia w POS.");
  }
}

// Allocate the exact discount first across gross line totals, then split a
// quantity into up to two unit-price bands to retain the remaining pennies.
function applyDiscount(lines: GrossLine[], discount: number): PosLine[] {
  const base = lines.reduce((sum, line) => sum + (line.refundableDeposit ? 0 : line.grosze * line.qty), 0);
  if (discount > base) throw new Error("Invalid POS discount base");
  const denominator = BigInt(base || 1);
  const shares = lines.map((line, index) => {
    const numerator = line.refundableDeposit ? BigInt(0) : BigInt(discount) * BigInt(line.grosze * line.qty);
    return { index, amount: Number(numerator / denominator), remainder: numerator % denominator };
  });
  let remaining = discount - shares.reduce((sum, share) => sum + share.amount, 0);
  const order = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const share of order) {
    if (!remaining) break;
    share.amount += 1;
    remaining -= 1;
  }

  return lines.flatMap(({ grosze, refundableDeposit: _deposit, ...line }, index) => {
    void _deposit;
    const total = grosze * line.qty - shares[index].amount;
    const unit = Math.floor(total / line.qty);
    const extraCent = total % line.qty;
    return [
      { ...line, qty: line.qty - extraCent, "manual-price": fromGrosze(unit) },
      ...(extraCent ? [{ ...line, qty: extraCent, "manual-price": fromGrosze(unit + 1) }] : []),
    ];
  });
}

export function buildSavedPosItems({ quote, pricedItems }: SavedOrderPricing, mappings: Mappings): PosLine[] {
  const missing = new Set<string>();
  function mapped(id: number | undefined, label: string): number {
    if (id === undefined || !Number.isSafeInteger(id) || id <= 0) {
      missing.add(label);
      return 0;
    }
    return id;
  }

  const variants: PosVariant[] = pricedItems.map(({ name, note, price }) => {
    const addons: PosLine[] = price.addons.map((addon) => ({
      id: mapped(mappings.addon(addon.name, addon.category), `Dodatek: ${addon.name}`),
      qty: 1, note: addon.name, "manual-price": fromGrosze(addon.unitPrice),
    }));
    if (price.extraMeatCount) addons.push({
      id: mapped(mappings.extraMeat, "Dodatkowe mięso"),
      qty: price.extraMeatCount, "manual-price": fromGrosze(price.extraMeatUnitPrice),
    });

    return {
      product: { id: mapped(mappings.product(String(price.productId), name), name),
        qty: price.quantity, note, "manual-price": fromGrosze(price.unitPrice) },
      addons,
      requiresPackaging: price.packaging > 0,
    };
  });

  const charges = new Map<string, GrossLine>();
  function addCharge(id: number | undefined, note: string, amount: number, qty: number, refundableDeposit = false) {
    if (!amount) return;
    const product = mapped(id, note);
    const grosze = amount / qty;
    const key = JSON.stringify([product, note, grosze]);
    const existing = charges.get(key);
    if (existing) existing.qty += qty;
    else charges.set(key, { id: product, qty, note, grosze, refundableDeposit });
  }
  for (const { price } of pricedItems) {
    addCharge(mappings.packaging, "Opakowanie", price.packaging, price.quantity);
    addCharge(mappings.deposit, "Kaucja zwrotna", price.deposit, price.quantity, true);
  }
  addCharge(mappings.delivery, "Dostawa", quote.delivery, 1);
  if (missing.size) throw new PosMappingError([...missing]);

  const gross = compactPosItems(variants).map((line) => ({ ...line, grosze: toGrosze(line["manual-price"]!) }));
  const result = applyDiscount([...gross, ...charges.values()], quote.discount);
  if (result.reduce((sum, line) => sum + toGrosze(line["manual-price"]!) * line.qty, 0) !== quote.total) {
    throw new Error("POS quote total differs from saved order");
  }
  return result;
}

type CatalogProduct = { pos_id: number | string; name: string };

export function createPosCatalogMappings(
  products: readonly CatalogProduct[],
  overrides: ReadonlyMap<string, number>,
  legacyAddonCategories: ReadonlyMap<string, string>,
  specialIds: Partial<Record<"packaging" | "delivery" | "deposit" | "extraMeat" | "ingredient" | "sauce" | "premium", string>>,
  city?: string,
): Mappings {
  const normalized = (name: string) => name.replace(/^\d+\.\s*/, "").toLowerCase().normalize("NFD")
    .replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/[^a-z0-9]/g, "");
  const byName = new Map<string, Set<number>>();
  const ids = new Set<number>();
  for (const product of products) {
    const id = Number(product.pos_id);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    ids.add(id);
    const key = normalized(product.name);
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key)?.add(id);
  }
  function special(key: keyof typeof specialIds, names: string[]): number | undefined {
    if (specialIds[key]) {
      const id = Number(specialIds[key]);
      return ids.has(id) ? id : undefined;
    }
    const matches = new Set(names.flatMap((name) => [...(byName.get(normalized(name)) ?? [])]));
    return matches.size === 1 ? matches.values().next().value : undefined;
  }

  const extraMeat = special("extraMeat", ["Dodatkowe mięso"]);
  const ingredient = special("ingredient", ["Dodatkowy składnik"]);
  const sauce = special("sauce", ["Dodatkowy sos"]);
  const premium = special("premium", ["Dodatkowy płynny ser"]);
  const deliveryNames = normalized(city ?? "").includes("ciechan")
    ? ["Dowóz na terenie Ciechanowa", "Dostawa na terenie Ciechanowa"]
    : ["Dowóz poza Ciechanów", "Dostawa poza Ciechanów", "Dowóz poza Ciechanowem"];
  return {
    product(id, name) {
      if (overrides.has(id)) {
        const value = overrides.get(id);
        return value !== undefined && ids.has(value) ? value : undefined;
      }
      const matches = byName.get(normalized(name));
      return matches?.size === 1 ? matches.values().next().value : undefined;
    },
    addon(name, category) {
      switch (category ?? legacyAddonCategories.get(name.trim().toLowerCase())) {
        case "sos": return sauce;
        case "premium": return premium;
        case "dodatek": return ingredient;
        default: return undefined;
      }
    },
    extraMeat,
    packaging: special("packaging", ["Pakowanie na wynos", "Pakowanie", "Opakowanie", "Packaging"]),
    delivery: special("delivery", deliveryNames) ??
      (specialIds.delivery ? undefined : special("delivery", ["Dowóz", "Dostawa", "Transport", "Delivery"])),
    deposit: special("deposit", ["Kaucja", "Kaucja zwrotna", "Kaucja za opakowanie"]),
  };
}

export function assessPosTotal(expectedGrosze: number, total: unknown, currency?: unknown, itemErrors?: unknown[]) {
  if (itemErrors?.length) return "items_rejected" as const;
  if (currency != null && currency !== "PLN") return "price_mismatch" as const;
  if (typeof total !== "number" || !Number.isFinite(total)) return "awaiting_price" as const;
  return toGrosze(total) === expectedGrosze ? "confirmed" as const : "price_mismatch" as const;
}
