export type MeatType = "wołowina" | "kurczak";

type MeatProduct = { name?: string | null; category?: string | null; subcategory?: string | null };

export const inferDefaultMeat = (meta?: MeatProduct, name?: string): "wołowina" | "kurczak" | null => {
  const n = (name || meta?.name || "").toLowerCase();
  const cat = (meta?.category || "").toLowerCase();
  const sub = (meta?.subcategory || "").toLowerCase();

  if (sub.includes("vege") || n.includes("vege")) return null;
  if (sub.includes("kurczak") || n.includes("chicken")) return "kurczak";
  if (cat === "burger" || n.includes("burger")) return "wołowina";
  return null;
};

export function resolveOrderMeat(product: MeatProduct, selected?: MeatType | null): MeatType | null {
  const defaultMeat = inferDefaultMeat(product);
  if (defaultMeat !== "wołowina") return defaultMeat;
  return selected ?? defaultMeat;
}
