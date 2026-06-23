import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotypos from "@/lib/dotypos";
import { getSessionAndRole } from "@/lib/serverAuth";
import { DEFAULT_POS_PRODUCT_OVERRIDES } from "@/lib/posProductMappings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  id: string | number;
  name: string | null;
  price: string | number | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  ingredients: string[] | null;
  image_url?: string | null;
  available: boolean;
  available_addons?: string[] | null;
};

type ProductPayload = {
  name?: string | null;
  price?: string | number | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  ingredients?: unknown;
  image_url?: string | null;
  available_addons?: unknown;
  available?: boolean;
  syncPos?: boolean;
};

type PosProduct = {
  pos_id: number | string;
  name: string;
  price: number | string | null;
};

type PosSyncResult = {
  requested: boolean;
  success: boolean;
  status: "synced" | "skipped" | "failed";
  message: string;
  posId?: number;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireStaff() {
  const { session, role } = await getSessionAndRole();
  if (!session || (role !== "admin" && role !== "employee")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function hasOwn(body: ProductPayload, key: keyof ProductPayload) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return value == null ? null : String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanPrice(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Cena musi być poprawną liczbą");
  return parsed;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function buildUpdatePayload(body: ProductPayload) {
  const payload: Record<string, unknown> = {};
  if (hasOwn(body, "name")) payload.name = cleanText(body.name);
  if (hasOwn(body, "price")) payload.price = cleanPrice(body.price);
  if (hasOwn(body, "description")) payload.description = cleanText(body.description);
  if (hasOwn(body, "category")) payload.category = cleanText(body.category);
  if (hasOwn(body, "subcategory")) payload.subcategory = cleanText(body.subcategory);
  if (hasOwn(body, "ingredients")) payload.ingredients = cleanStringArray(body.ingredients);
  if (hasOwn(body, "image_url")) payload.image_url = cleanText(body.image_url);
  if (hasOwn(body, "available_addons")) payload.available_addons = cleanStringArray(body.available_addons);
  if (hasOwn(body, "available") && typeof body.available === "boolean") payload.available = body.available;
  return payload;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

async function resolvePosProductId(
  supabase: SupabaseClient,
  previous: ProductRow
): Promise<{ posId?: number; reason?: string }> {
  const numericInternalId = Number(previous.id);
  if (Number.isSafeInteger(numericInternalId)) {
    const { data: override } = await supabase
      .from("pos_product_overrides")
      .select("pos_id")
      .eq("internal_product_id", numericInternalId)
      .maybeSingle();

    const overridePosId = Number((override as { pos_id?: unknown } | null)?.pos_id);
    if (Number.isSafeInteger(overridePosId)) return { posId: overridePosId };

    const defaultPosId = DEFAULT_POS_PRODUCT_OVERRIDES[numericInternalId];
    if (Number.isSafeInteger(defaultPosId)) return { posId: defaultPosId };
  }

  const oldName = previous.name?.trim();
  if (!oldName) return { reason: "Produkt lokalny nie ma starej nazwy do dopasowania z POS." };

  const { data, error } = await supabase
    .from("pos_products")
    .select("pos_id,name,price")
    .eq("deleted", false);

  if (error) return { reason: `Nie udało się odczytać mapowań POS: ${error.message}` };

  const oldPrice = toNumber(previous.price);
  const exactName = ((data as PosProduct[] | null) ?? []).filter((product) => normalize(product.name) === normalize(oldName));
  const candidates = oldPrice == null
    ? exactName
    : exactName.filter((product) => {
        const posPrice = toNumber(product.price);
        return posPrice != null && Math.abs(posPrice - oldPrice) < 0.01;
      });

  const selected = candidates.length === 1 ? candidates[0] : exactName.length === 1 ? exactName[0] : null;
  if (!selected) {
    if (exactName.length > 1) return { reason: `W POS znaleziono kilka produktów o nazwie "${oldName}". Dodaj jawne mapowanie POS.` };
    return { reason: `Nie znaleziono w POS produktu "${oldName}". Najpierw zsynchronizuj produkty lub dodaj mapowanie.` };
  }

  const posId = Number(selected.pos_id);
  if (!Number.isSafeInteger(posId)) return { reason: "Dopasowany produkt POS ma niepoprawne ID." };
  return { posId };
}

async function syncProductToPos(
  supabase: SupabaseClient,
  previous: ProductRow,
  updated: ProductRow
): Promise<PosSyncResult> {
  const resolved = await resolvePosProductId(supabase, previous);
  if (!resolved.posId) {
    return {
      requested: true,
      success: false,
      status: "skipped",
      message: resolved.reason || "Nie udało się jednoznacznie dopasować produktu POS.",
    };
  }

  const price = toNumber(updated.price);
  const patch: Record<string, unknown> = {
    name: updated.name || previous.name || "",
    display: Boolean(updated.available),
  };

  if (price != null) patch.priceWithVat = price;
  if (typeof updated.description === "string") {
    patch.description = updated.description.slice(0, 1000);
  }

  try {
    await dotypos.updateProductPartial(resolved.posId, patch);
    const cacheUpdate: Record<string, unknown> = {
      name: patch.name,
      synced_at: new Date().toISOString(),
    };
    if (price != null) cacheUpdate.price = price;

    await supabase
      .from("pos_products")
      .update(cacheUpdate)
      .eq("pos_id", resolved.posId);

    return {
      requested: true,
      success: true,
      status: "synced",
      posId: resolved.posId,
      message: "Zapisano zmiany również w Dotypos POS.",
    };
  } catch (error) {
    return {
      requested: true,
      success: false,
      status: "failed",
      posId: resolved.posId,
      message: error instanceof Error ? error.message : "Nie udało się zaktualizować produktu w POS.",
    };
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const unauthorized = await requireStaff();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await request.json() as ProductPayload;
    const payload = buildUpdatePayload(body);
    const supabase = getSupabaseAdmin();

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "Brak danych do zapisu" }, { status: 400 });
    }

    const { data: previous, error: previousError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 });
    if (!previous) return NextResponse.json({ error: "Produkt nie istnieje" }, { status: 404 });

    const { data, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const posSync = body.syncPos
      ? await syncProductToPos(supabase, previous as ProductRow, data as ProductRow)
      : {
          requested: false,
          success: false,
          status: "skipped",
          message: "Zapisano tylko menu na stronie.",
        } satisfies PosSyncResult;

    return NextResponse.json({ product: data, posSync });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zapisać produktu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  void request;
  const unauthorized = await requireStaff();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await Promise.resolve(context.params);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      posSync: {
        requested: false,
        success: false,
        status: "skipped",
        message: "Usunięto tylko z menu strony. POS nie został zmieniony automatycznie.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się usunąć produktu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
