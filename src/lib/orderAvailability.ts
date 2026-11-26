import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const fulfillmentSchema = z.enum(["local", "takeaway", "delivery"]);
export type Fulfillment = z.infer<typeof fulfillmentSchema>;

const modeFlags = {
  local: "local_enabled",
  takeaway: "takeaway_enabled",
  delivery: "delivery_enabled",
} as const;

export const orderSettingsSchema = z.object({
  orders_enabled: z.boolean(),
  local_enabled: z.boolean(),
  takeaway_enabled: z.boolean(),
  delivery_enabled: z.boolean(),
});

export type OrderSettings = z.infer<typeof orderSettingsSchema>;

export function canAcceptOrder(settings: OrderSettings, mode: Fulfillment): boolean {
  return settings.orders_enabled && settings[modeFlags[mode]];
}

export async function readOrderAvailability(supabase: SupabaseClient) {
  // Keep both persisted switches as vetoes, including during mixed-version deploys.
  const [restaurant, orderSettings] = await Promise.all([
    supabase.from("restaurant_info").select("ordering_open,packaging_cost").eq("id", 1).single(),
    supabase.from("order_settings").select("id,orders_enabled,local_enabled,takeaway_enabled,delivery_enabled").single(),
  ]);

  if (restaurant.error || orderSettings.error || typeof restaurant.data?.ordering_open !== "boolean") return null;
  const settings = orderSettingsSchema.safeParse(orderSettings.data);
  if (!settings.success || typeof orderSettings.data?.id !== "string") return null;

  return {
    id: orderSettings.data.id,
    effective: {
      ...settings.data,
      orders_enabled: restaurant.data.ordering_open && settings.data.orders_enabled,
    },
    packagingCost: restaurant.data.packaging_cost,
  };
}
