import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  calculateDeliveryQuote,
  type DeliveryZonePricing,
  validateDeliveryZones,
} from "@/lib/deliveryPricing";
import {
  getDrivingDistanceKmToPlace,
  isValidGooglePlaceId,
} from "@/lib/googleDelivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuoteRequest = z.object({
  destination_place_id: z
    .string()
    .min(10)
    .max(255)
    .refine(isValidGooglePlaceId, "Nieprawidłowy identyfikator adresu."),
  products_total: z.coerce.number().finite().nonnegative().max(100_000),
});

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = QuoteRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Wybierz pełny adres z listy Google." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const [{ data: zones, error: zonesError }, { data: restaurant, error: restaurantError }] =
    await Promise.all([
      supabase.from("delivery_zones").select("*").eq("active", true),
      supabase.from("restaurant_info").select("lat,lng").eq("id", 1).single(),
    ]);

  if (zonesError || restaurantError || !zones || !restaurant) {
    return NextResponse.json(
      { error: "Konfiguracja dostawy jest chwilowo niedostępna." },
      { status: 503 },
    );
  }

  const zoneValidationErrors = validateDeliveryZones(
    zones as DeliveryZonePricing[],
  );
  if (zoneValidationErrors.length) {
    console.error(
      "[delivery.quote] Invalid delivery zones:",
      zoneValidationErrors.join(" "),
    );
    return NextResponse.json(
      { error: "Konfiguracja stref dostawy wymaga poprawy." },
      { status: 503 },
    );
  }

  const origin = {
    lat: Number(restaurant.lat),
    lng: Number(restaurant.lng),
  };
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return NextResponse.json(
      { error: "Punkt startowy restauracji jest nieprawidłowy." },
      { status: 503 },
    );
  }

  let distanceKm: number;
  try {
    distanceKm = await getDrivingDistanceKmToPlace(
      origin,
      parsed.data.destination_place_id,
    );
  } catch (error) {
    console.error(
      "[delivery.quote] Google route error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Nie udało się wyznaczyć trasy drogowej. Spróbuj ponownie." },
      { status: 503 },
    );
  }

  const quote = calculateDeliveryQuote(
    distanceKm,
    zones as DeliveryZonePricing[],
    parsed.data.products_total,
  );
  if (!quote) {
    return NextResponse.json(
      {
        out_of_range: true,
        distance_km: Math.round(distanceKm * 100) / 100,
        billable_distance_km: Math.round(distanceKm),
        error: "Adres jest poza zasięgiem dostawy.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json(
    {
      out_of_range: false,
      distance_km: quote.distanceKm,
      billable_distance_km: quote.billableDistanceKm,
      cost: quote.cost,
      base_cost: quote.baseCost,
      min_order_value: quote.minOrderValue,
      min_order_ok: quote.minOrderOk,
      eta_min_minutes: quote.etaMinMinutes,
      eta_max_minutes: quote.etaMaxMinutes,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
