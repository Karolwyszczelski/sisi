export const BURGER_MONTH_ID = 12;
export const BURGER_MONTH_NAME = "Burger Miesiąca";
export const BURGER_MONTH_PLACEHOLDER = "/burgerpng.png";

export function isBurgerMonthName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return /^burger\s+miesiaca(?:\s|$|[–—:-])/.test(normalized);
}

export function isBurgerMonthId(id: unknown): boolean {
  return String(id) === String(BURGER_MONTH_ID);
}

// Never promote an old edition to the canonical product, especially when ID 12
// is unavailable. Preserve other products and their order.
export function canonicalizeBurgerMonth<T extends { id?: string | number; name: string | null }>(products: T[]): T[] {
  let seen = false;
  return products.flatMap((product) => {
    if (isBurgerMonthId(product.id)) {
      if (seen) return [];
      seen = true;
      return [{ ...product, name: BURGER_MONTH_NAME }];
    }
    return isBurgerMonthName(product.name) ? [] : [product];
  });
}

export function burgerMonthPrice(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const price = Number(String(value).replace(",", "."));
  return Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null;
}
