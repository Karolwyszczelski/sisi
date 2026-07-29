import "server-only";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const GOOGLE_TIMEOUT_MS = 8_000;

export type DeliveryPlace = {
  placeId: string;
  formattedAddress: string;
  street: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
};

const fetchGoogleJson = async (url: URL): Promise<any> => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured");
  }

  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Maps returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.status !== "OK") {
    throw new Error(payload?.error_message || payload?.status || "Google Maps error");
  }
  return payload;
};

export function isValidGooglePlaceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 255 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function getDrivingDistanceKmToPlace(
  origin: { lat: number; lng: number },
  destinationPlaceId: string,
): Promise<number> {
  if (
    !Number.isFinite(origin.lat) ||
    !Number.isFinite(origin.lng) ||
    !isValidGooglePlaceId(destinationPlaceId)
  ) {
    throw new Error("Invalid delivery route input");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destinations", `place_id:${destinationPlaceId}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("language", "pl");

  const payload = await fetchGoogleJson(url);
  const element = payload?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error(element?.status || "No driving route found");
  }

  const meters = Number(element.distance?.value);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new Error("Google Maps returned invalid distance");
  }
  return meters / 1000;
}

export async function getDeliveryPlace(
  destinationPlaceId: string,
): Promise<DeliveryPlace> {
  if (!isValidGooglePlaceId(destinationPlaceId)) {
    throw new Error("Invalid Google place ID");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("place_id", destinationPlaceId);
  url.searchParams.set("language", "pl");
  const payload = await fetchGoogleJson(url);
  const result = payload?.results?.[0];
  const location = result?.geometry?.location;
  if (
    !result ||
    !Number.isFinite(Number(location?.lat)) ||
    !Number.isFinite(Number(location?.lng))
  ) {
    throw new Error("Google Maps returned invalid address");
  }

  const components = Array.isArray(result.address_components)
    ? result.address_components
    : [];
  const component = (type: string) =>
    components.find((item: any) => item?.types?.includes(type))?.long_name || "";
  const route = component("route");
  const streetNumber = component("street_number");

  return {
    placeId: destinationPlaceId,
    formattedAddress: String(result.formatted_address || ""),
    street: [route, streetNumber].filter(Boolean).join(" ") || String(result.formatted_address || ""),
    city:
      component("locality") ||
      component("postal_town") ||
      component("administrative_area_level_3"),
    postalCode: component("postal_code"),
    lat: Number(location.lat),
    lng: Number(location.lng),
  };
}
