import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionAndRole } from "@/lib/serverAuth";
import { DOTYPOS_CALLBACK_PATH, DOTYPOS_STATE_COOKIE } from "@/lib/dotyposConnector";

export async function GET(req: NextRequest) {
  const { session, role } = await getSessionAndRole();
  const params = req.nextUrl.searchParams;
  const state = params.get("state");
  const cookie = req.cookies.get(DOTYPOS_STATE_COOKIE)?.value;
  if (!session || role !== "admin" || !state || cookie !== `${session.user.id}.${state}`) {
    return NextResponse.json(
      { error: "Invalid connector session" },
      { status: 403, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
    );
  }

  function redirect(key: "dotypos_error" | "dotypos_success", value: string) {
    const url = new URL("/admin/settings", req.url);
    url.searchParams.set(key, value);
    const response = NextResponse.redirect(url, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
    response.cookies.set(DOTYPOS_STATE_COOKIE, "", {
      path: DOTYPOS_CALLBACK_PATH, maxAge: 0, httpOnly: true, secure: true, sameSite: "lax",
    });
    return response;
  }

  if (params.has("error")) return redirect("dotypos_error", "provider_error");
  const refreshToken = params.get("token");
  const cloudId = params.get("cloudid");
  if (!refreshToken || !cloudId) return redirect("dotypos_error", "missing_params");

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const now = new Date().toISOString();
    const { error } = await supabase.from("integrations").upsert({
      id: "dotypos",
      cloud_id: cloudId,
      refresh_token: refreshToken,
      access_token: null,
      access_token_expires_at: null,
      connected_at: now,
      updated_at: now,
    }, { onConflict: "id" });
    if (error) {
      console.error("[Dotypos Callback] Integration save failed");
      return redirect("dotypos_error", "database_error");
    }
    return redirect("dotypos_success", "connected");
  } catch {
    console.error("[Dotypos Callback] Integration setup failed");
    return redirect("dotypos_error", "unexpected_error");
  }
}
