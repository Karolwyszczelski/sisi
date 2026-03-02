// src/app/api/dotypos/callback/route.ts
// ==========================================
// OAuth Callback Handler for Dotypos API v2
// ==========================================
// 
// This endpoint receives the OAuth callback from Dotypos after user authorization.
// It stores the refresh token and cloud ID in the database.
//
// Callback URL to register: https://sisiciechanow.pl/api/dotypos/callback
// ==========================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ============================================================
   Supabase Client
   ============================================================ */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ============================================================
   GET Handler - OAuth Callback
   ============================================================ */

/**
 * Handle OAuth callback from Dotypos
 * 
 * Expected query parameters:
 * - token: Refresh token
 * - cloudid: Cloud ID
 * - state: (optional) State parameter for CSRF protection
 * 
 * On success, redirects to admin settings page
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const refreshToken = searchParams.get("token");
  const cloudId = searchParams.get("cloudid");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  
  // Log callback for debugging
  console.log("[Dotypos Callback] Received:", {
    hasToken: !!refreshToken,
    cloudId,
    state,
    error,
  });
  
  // Handle error from Dotypos
  if (error) {
    console.error("[Dotypos Callback] Error from Dotypos:", error);
    const redirectUrl = new URL("/admin/settings", req.url);
    redirectUrl.searchParams.set("dotypos_error", error);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Validate required parameters
  if (!refreshToken || !cloudId) {
    console.error("[Dotypos Callback] Missing required parameters");
    const redirectUrl = new URL("/admin/settings", req.url);
    redirectUrl.searchParams.set("dotypos_error", "missing_params");
    return NextResponse.redirect(redirectUrl);
  }
  
  try {
    const supabase = getSupabase();
    
    // Store integration data
    const { error: upsertError } = await supabase
      .from("integrations")
      .upsert(
        {
          id: "dotypos",
          refresh_token: refreshToken,
          cloud_id: cloudId,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    
    if (upsertError) {
      console.error("[Dotypos Callback] Database error:", upsertError);
      const redirectUrl = new URL("/admin/settings", req.url);
      redirectUrl.searchParams.set("dotypos_error", "database_error");
      return NextResponse.redirect(redirectUrl);
    }
    
    console.log("[Dotypos Callback] Successfully stored integration for cloud:", cloudId);
    
    // Redirect to admin settings with success message
    const redirectUrl = new URL("/admin/settings", req.url);
    redirectUrl.searchParams.set("dotypos_success", "connected");
    redirectUrl.searchParams.set("cloudid", cloudId);
    
    return NextResponse.redirect(redirectUrl);
    
  } catch (err) {
    console.error("[Dotypos Callback] Unexpected error:", err);
    const redirectUrl = new URL("/admin/settings", req.url);
    redirectUrl.searchParams.set("dotypos_error", "unexpected_error");
    return NextResponse.redirect(redirectUrl);
  }
}

/* ============================================================
   POST Handler - Alternative callback method
   ============================================================ */

/**
 * Some OAuth providers send callbacks as POST requests
 * This handler supports that use case
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const refreshToken = body.token || body.refresh_token;
    const cloudId = body.cloudid || body.cloud_id;
    
    if (!refreshToken || !cloudId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }
    
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from("integrations")
      .upsert(
        {
          id: "dotypos",
          refresh_token: refreshToken,
          cloud_id: cloudId,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    
    if (error) {
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Integration connected successfully",
      cloudId,
    });
    
  } catch (err) {
    console.error("[Dotypos Callback POST] Error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
