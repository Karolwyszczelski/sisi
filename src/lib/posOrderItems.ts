/** The subset of POS Item fields emitted by the website order mapper. */
export interface PosLine {
  id: number;
  qty: number;
  note?: string;
  "manual-price"?: number;
}

export interface PosVariant {
  product: PosLine;
  /** Quantities of paid additions for ONE unit of the parent product. */
  addons: PosLine[];
  requiresPackaging: boolean;
}

export interface PosItemOptions {
  addons?: string[];
  meatType?: string;
  extraMeatCount?: number;
  note?: string;
  swaps?: { from: string; to: string }[];
  _src?: { options?: { swaps?: { from: string; to: string }[] } };
}

/** Support both normalized checkout orders and orders edited by staff. */
export function parsePosItemOptions(item: PosItemOptions) {
  const regularAddons: string[] = [];
  let meatType = "";
  let extraMeatCount = 0;
  for (const raw of item.addons ?? []) {
    const addon = raw.trim();
    if (!addon) continue;
    const meat = addon.match(/^Mięso:\s*(.+)$/i);
    const extra = addon.match(/^Dodatkowe mięso x(\d+)$/i);
    if (meat) meatType = meat[1].trim();
    else if (extra) extraMeatCount += Number(extra[1]);
    else regularAddons.push(addon);
  }
  // Explicit fields from the staff editor take precedence over legacy labels.
  meatType = item.meatType?.trim() || meatType;
  if (item.extraMeatCount !== undefined) extraMeatCount = item.extraMeatCount;
  if (!Number.isSafeInteger(extraMeatCount) || extraMeatCount < 0) {
    throw new Error("Nieprawidłowa ilość dodatkowego mięsa.");
  }
  regularAddons.sort();
  const noteParts: string[] = [];
  if (meatType) noteParts.push(`Mięso: ${meatType}`);
  const swaps = item.swaps ?? item._src?.options?.swaps ?? [];
  for (const swap of [...swaps].sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`))) {
    noteParts.push(`Zamiana: ${swap.from} → ${swap.to}`);
  }
  if (item.note?.trim()) noteParts.push(item.note.trim());
  const additions = [...regularAddons];
  if (extraMeatCount) additions.push(`dodatkowe mięso x${extraMeatCount}`);
  if (additions.length) noteParts.push(`Dodatki/szt.: ${additions.join(", ")}`);
  return { regularAddons, extraMeatCount, note: noteParts.join(" | ") || undefined };
}

function lineKey(line: PosLine): string {
  return JSON.stringify([line.id, line["manual-price"] ?? null, line.note?.trim() || ""]);
}

function sumIdenticalLines(lines: readonly PosLine[]): PosLine[] {
  const summed = new Map<string, PosLine>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) {
      throw new Error("Nieprawidłowa ilość produktu dla POS.");
    }
    const key = lineKey(line);
    const previous = summed.get(key);
    if (previous) previous.qty += line.qty;
    else summed.set(key, { ...line });
  }
  return [...summed.values()];
}

/** Merge only complete, identical preparations; keep prices and parent links. */
export function compactPosItems(
  variants: readonly PosVariant[],
  packaging?: Omit<PosLine, "qty">,
): PosLine[] {
  const groups = new Map<string, PosVariant>();
  for (const variant of variants) {
    if (!Number.isSafeInteger(variant.product.qty) || variant.product.qty <= 0) {
      throw new Error("Nieprawidłowa ilość produktu dla POS.");
    }
    const addons = sumIdenticalLines(variant.addons);
    const key = JSON.stringify([
      lineKey(variant.product), variant.requiresPackaging,
      addons.map((addon) => [lineKey(addon), addon.qty]).sort(),
    ]);
    const previous = groups.get(key);
    if (previous) previous.product.qty += variant.product.qty;
    else groups.set(key, { ...variant, product: { ...variant.product }, addons });
  }

  const result: PosLine[] = [];
  let packagingQty = 0;
  let position = 0;
  for (const group of groups.values()) {
    position++;
    const qty = group.product.qty;
    const parentNote = group.addons.length
      ? [`Poz. ${position}`, group.product.note].filter(Boolean).join(" | ")
      : group.product.note;
    result.push({ ...group.product, note: parentNote });
    for (const addon of group.addons) {
      result.push({
        ...addon,
        qty: addon.qty * qty,
        note: [`Do poz. ${position}`, addon.note].filter(Boolean).join(": "),
      });
    }
    if (group.requiresPackaging) packagingQty += qty;
  }
  if (packaging && packagingQty > 0) result.push({ ...packaging, qty: packagingQty });
  return result;
}
