export type PackagingItem = {
  quantity?: unknown;
  category?: unknown;
};

const PACKAGED_FOOD_CATEGORIES = new Set([
  "burger",
  "frytki",
  "kids",
  "pancake",
]);

export function normalizeProductCategory(category: unknown): string {
  return String(category ?? "")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

export function normalizeProductNameForLookup(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function requiresPackaging(category: unknown): boolean {
  return PACKAGED_FOOD_CATEGORIES.has(normalizeProductCategory(category));
}

export function packagingQuantity(quantity: unknown): number {
  const parsed = Number(quantity ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function countPackagingUnits<T extends PackagingItem>(
  items: readonly T[],
  getCategory: (item: T) => unknown = (item) => item.category,
): number {
  return items.reduce((total, item) => {
    if (!requiresPackaging(getCategory(item))) return total;
    return total + packagingQuantity(item.quantity);
  }, 0);
}
