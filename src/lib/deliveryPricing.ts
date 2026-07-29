export type DeliveryZonePricing = {
  id?: string;
  min_distance_km: number | string;
  max_distance_km: number | string;
  min_order_value?: number | string | null;
  cost?: number | string | null;
  cost_fixed?: number | string | null;
  cost_per_km?: number | string | null;
  free_over?: number | string | null;
  eta_min_minutes?: number | string | null;
  eta_max_minutes?: number | string | null;
  pricing_type?: "flat" | "per_km" | string | null;
  active?: boolean | null;
};

export type DeliveryQuote = {
  distanceKm: number;
  billableDistanceKm: number;
  cost: number;
  baseCost: number;
  minOrderValue: number;
  minOrderOk: boolean;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  zone: DeliveryZonePricing;
};

const asNonNegativeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * The restaurant price list uses whole road kilometres (e.g. 7 km = 14 zł).
 * Google returns metres, so the displayed road distance is rounded to the
 * nearest whole kilometre before selecting a zone and calculating the price.
 */
export function toBillableDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("Invalid delivery distance");
  }
  return Math.round(distanceKm);
}

export function findDeliveryZone(
  zones: readonly DeliveryZonePricing[],
  billableDistanceKm: number,
): DeliveryZonePricing | null {
  const sorted = zones
    .filter((zone) => zone.active !== false)
    .slice()
    .sort(
      (a, b) =>
        asNonNegativeNumber(a.min_distance_km) -
          asNonNegativeNumber(b.min_distance_km) ||
        asNonNegativeNumber(a.max_distance_km) -
          asNonNegativeNumber(b.max_distance_km),
    );

  return (
    sorted.find((zone) => {
      const min = asNonNegativeNumber(zone.min_distance_km);
      const max = asNonNegativeNumber(zone.max_distance_km);
      return billableDistanceKm >= min && billableDistanceKm <= max;
    }) ?? null
  );
}

export function calculateDeliveryQuote(
  distanceKm: number,
  zones: readonly DeliveryZonePricing[],
  productsTotal: number,
): DeliveryQuote | null {
  const billableDistanceKm = toBillableDistanceKm(distanceKm);
  const zone = findDeliveryZone(zones, billableDistanceKm);
  if (!zone) return null;

  const pricingType =
    String(zone.pricing_type ?? "").toLowerCase() === "flat"
      ? "flat"
      : "per_km";
  const legacyCost = asNonNegativeNumber(zone.cost);
  const fixedCost = asNonNegativeNumber(zone.cost_fixed);
  const perKmRate = asNonNegativeNumber(zone.cost_per_km, legacyCost);

  const baseCost =
    pricingType === "flat"
      ? fixedCost > 0
        ? fixedCost
        : legacyCost
      : fixedCost + perKmRate * billableDistanceKm;

  const freeOver =
    zone.free_over == null ? null : asNonNegativeNumber(zone.free_over);
  const safeProductsTotal = asNonNegativeNumber(productsTotal);
  const cost =
    freeOver != null && safeProductsTotal >= freeOver ? 0 : baseCost;
  const minOrderValue = asNonNegativeNumber(zone.min_order_value);

  return {
    distanceKm: roundMoney(distanceKm),
    billableDistanceKm,
    cost: roundMoney(Math.max(0, cost)),
    baseCost: roundMoney(Math.max(0, baseCost)),
    minOrderValue,
    minOrderOk: safeProductsTotal >= minOrderValue,
    etaMinMinutes: asNonNegativeNumber(zone.eta_min_minutes),
    etaMaxMinutes: asNonNegativeNumber(zone.eta_max_minutes),
    zone,
  };
}

export function validateDeliveryZones(
  zones: readonly DeliveryZonePricing[],
): string[] {
  const active = zones
    .filter((zone) => zone.active !== false)
    .slice()
    .sort(
      (a, b) =>
        asNonNegativeNumber(a.min_distance_km) -
        asNonNegativeNumber(b.min_distance_km),
    );
  const errors: string[] = [];

  if (active.length === 0) {
    return ["Brak aktywnej strefy dostawy."];
  }

  if (asNonNegativeNumber(active[0].min_distance_km) !== 0) {
    errors.push("Pierwsza aktywna strefa musi zaczynać się od 0 km.");
  }

  for (let index = 0; index < active.length; index += 1) {
    const zone = active[index];
    const min = asNonNegativeNumber(zone.min_distance_km);
    const max = asNonNegativeNumber(zone.max_distance_km);
    if (max < min) {
      errors.push(`Strefa ${index + 1}: maksymalny kilometr jest mniejszy od minimalnego.`);
    }
    if (index > 0) {
      const previousMax = asNonNegativeNumber(active[index - 1].max_distance_km);
      if (min <= previousMax) {
        errors.push(`Strefy ${index} i ${index + 1} nakładają się.`);
      } else if (min !== previousMax + 1) {
        errors.push(`Między strefami ${index} i ${index + 1} jest luka.`);
      }
    }
  }

  return errors;
}
