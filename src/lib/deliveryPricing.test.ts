import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDeliveryQuote,
  toBillableDistanceKm,
  validateDeliveryZones,
  type DeliveryZonePricing,
} from "./deliveryPricing";

const zones: DeliveryZonePricing[] = [
  {
    min_distance_km: 0,
    max_distance_km: 7,
    min_order_value: 38,
    cost: 2,
    cost_fixed: 0,
    cost_per_km: 2,
    free_over: null,
    eta_min_minutes: 60,
    eta_max_minutes: 90,
    pricing_type: "per_km",
    active: true,
  },
  {
    min_distance_km: 8,
    max_distance_km: 22,
    min_order_value: 38,
    cost: 2,
    cost_fixed: 0,
    cost_per_km: 2,
    free_over: null,
    eta_min_minutes: 90,
    eta_max_minutes: 120,
    pricing_type: "per_km",
    active: true,
  },
];

const ciechanowZone: DeliveryZonePricing = {
  destination_city: "Ciechanów",
  min_distance_km: 0,
  max_distance_km: 22,
  min_order_value: 38,
  cost: 5,
  cost_fixed: 5,
  cost_per_km: 0,
  free_over: 120,
  eta_min_minutes: 60,
  eta_max_minutes: 90,
  pricing_type: "flat",
  active: true,
};

test("rounds Google road distance to the nearest whole billable kilometre", () => {
  assert.equal(toBillableDistanceKm(3.01), 3);
  assert.equal(toBillableDistanceKm(5.5), 6);
  assert.equal(toBillableDistanceKm(13.99), 14);
  assert.equal(toBillableDistanceKm(21.49), 21);
  assert.equal(toBillableDistanceKm(21.5), 22);
});

test("matches the supplied price list at 2 zł per whole kilometre", () => {
  for (const [distanceKm, expectedCost] of [
    [3, 6],
    [4, 8],
    [5, 10],
    [6, 12],
    [7, 14],
    [8, 16],
    [13, 26],
    [14, 28],
    [15, 30],
    [17, 34],
    [19, 38],
    [21, 42],
    [22, 44],
  ] as const) {
    assert.equal(
      calculateDeliveryQuote(distanceKm, zones, 100)?.cost,
      expectedCost,
      `${distanceKm} km`,
    );
  }
});

test("reads the rate and fixed amount from the selected database zone", () => {
  const configurableZone: DeliveryZonePricing = {
    min_distance_km: 0,
    max_distance_km: 20,
    cost_fixed: 4,
    cost_per_km: 3,
    pricing_type: "per_km",
    active: true,
  };

  assert.equal(
    calculateDeliveryQuote(6.2, [configurableZone], 100)?.cost,
    22,
  );
});

test("uses the fixed database override for addresses inside Ciechanów", () => {
  const configuredZones = [...zones, ciechanowZone];

  assert.equal(
    calculateDeliveryQuote(0.23, configuredZones, 50, "Ciechanów")?.cost,
    5,
  );
  assert.equal(
    calculateDeliveryQuote(6.8, configuredZones, 50, "ciechanow")?.cost,
    5,
  );
  assert.equal(
    calculateDeliveryQuote(6.8, configuredZones, 50, "Chruszczewo")?.cost,
    14,
  );
  assert.equal(
    calculateDeliveryQuote(6.8, configuredZones, 120, "Ciechanów")?.cost,
    0,
  );
});

test("rejects an address beyond the configured 22 km range", () => {
  assert.equal(calculateDeliveryQuote(22.5, zones, 100), null);
});

test("checks minimum order against products only", () => {
  assert.equal(calculateDeliveryQuote(6, zones, 37.99)?.minOrderOk, false);
  assert.equal(calculateDeliveryQuote(6, zones, 38)?.minOrderOk, true);
});

test("detects overlapping zones and gaps", () => {
  assert.deepEqual(validateDeliveryZones([...zones, ciechanowZone]), []);
  assert.ok(validateDeliveryZones([]).some((message) => message.includes("Brak")));
  assert.ok(
    validateDeliveryZones([{ ...zones[0], min_distance_km: 1 }]).some(
      (message) => message.includes("0 km"),
    ),
  );
  assert.ok(
    validateDeliveryZones([
      { ...zones[0], max_distance_km: 8 },
      zones[1],
    ]).some((message) => message.includes("nakładają")),
  );
  assert.ok(
    validateDeliveryZones([
      zones[0],
      { ...zones[1], min_distance_km: 9 },
    ]).some((message) => message.includes("luka")),
  );
  assert.ok(
    validateDeliveryZones([
      ...zones,
      ciechanowZone,
      { ...ciechanowZone, min_distance_km: 10 },
    ]).some((message) => message.includes("nakładają")),
  );
});
