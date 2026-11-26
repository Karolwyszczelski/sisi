export type DepositGrosze = 0 | 50 | 100;

export function parseDepositGrosze(value: unknown): DepositGrosze {
  if (value === 0 || value === 50 || value === 100) return value;
  throw new Error("Kaucja musi wynosić 0, 50 albo 100 groszy.");
}

export function depositForOrder(fulfillment: string | null | undefined, unitGrosze: unknown, quantity: number): number {
  if (fulfillment !== "takeaway" && fulfillment !== "delivery") return 0;
  return parseDepositGrosze(unitGrosze ?? 0) * quantity / 100;
}
