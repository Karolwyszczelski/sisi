import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function buildInsertPayload(body: ProductPayload) {
  if (!cleanText(body.name)) throw new Error("Nazwa produktu jest wymagana");

  return {
    name: cleanText(body.name),
    price: cleanPrice(body.price),
    description: cleanText(body.description),
    category: cleanText(body.category),
    subcategory: cleanText(body.subcategory),
    ingredients: cleanStringArray(body.ingredients),
    image_url: cleanText(body.image_url),
    available_addons: cleanStringArray(body.available_addons),
    available: typeof body.available === "boolean" ? body.available : true,
  };
}

export async function POST(request: Request) {
  const unauthorized = await requireStaff();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as ProductPayload;
    const payload = buildInsertPayload(body);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      product: data,
      posSync: {
        requested: false,
        success: false,
        status: "skipped",
        message: "Nowy produkt zapisano tylko na stronie. Utworzenie produktu w POS wymaga jawnego mapowania.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się dodać produktu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
