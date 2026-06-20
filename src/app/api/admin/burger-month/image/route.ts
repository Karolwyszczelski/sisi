export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";

const BUCKET = "products";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  const { session, role } = await getSessionAndRole();
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nie wybrano zdjęcia." }, { status: 400 });
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Dozwolone formaty to JPG, PNG, WEBP i GIF." },
      { status: 415 }
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Zdjęcie musi mieć maksymalnie 5 MB." },
      { status: 413 }
    );
  }

  const filePath = `images/burger-miesiaca-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabase = getSupabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, Buffer.from(await file.arrayBuffer()), {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[burger-month/image] Upload error:", uploadError);
    return NextResponse.json({ error: "Nie udało się zapisać zdjęcia." }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
